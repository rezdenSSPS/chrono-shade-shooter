// src/hooks/useGameLoop.tsx

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet, Enemy } from '@/types';
import { renderGame } from '@/utils/gameRenderer';
import {
  updatePlayer,
  updateBullets,
  updateEnemies,
  checkBulletEnemyCollisions,
  checkPlayerEnemyCollisions,
  checkPlayerBulletCollisions,
  spawnEnemy,
  spawnBoss,
  shoot
} from '@/utils/gameLogic';

interface UseGameLoopProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  gameState: GameUIState;
  setGameState: React.Dispatch<React.SetStateAction<GameUIState>>;
  onGameEnd: (score: number) => void;
  isMultiplayer?: boolean;
  isHost?: boolean;
  gameSettings: GameSettings;
  channel?: RealtimeChannel;
  playerId?: string;
  setIsSpectating: React.Dispatch<React.SetStateAction<boolean>>;
}

const useGameLoop = ({
  canvasRef,
  gameState,
  setGameState,
  onGameEnd,
  isMultiplayer = false,
  isHost = false,
  gameSettings,
  channel,
  playerId,
  setIsSpectating,
}: UseGameLoopProps) => {
  const gameDataRef = useRef<GameData>({
    player: {
      id: playerId || 'solo',
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      size: 20,
      health: 100,
      maxHealth: 100,
      isAlive: true,
      kills: 0,
    },
    otherPlayers: [],
    enemies: [],
    bullets: [],
    keys: {},
    mouse: { x: 0, y: 0 },
    lastShot: 0,
    lastEnemySpawn: 0,
    lastBossSpawn: 0,
    gameMode: gameSettings.gameMode,
    gameStartTime: Date.now(),
  });

  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());
  const lastPositionBroadcast = useRef(0);
  const lastStateBroadcast = useRef(0);

  // Effect to set up and tear down multiplayer listeners
  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    // --- Presence listener for players joining/leaving ---
    const handlePresenceSync = () => {
      const presenceState = channel.presenceState();
      const players = Object.values(presenceState)
        .flatMap((presences: any) => presences)
        .filter((p: any) => p.user_id !== playerId)
        .map((p: any): Player => ({
            id: p.user_id,
            x: p.x || 0, y: p.y || 0,
            health: p.health || 100, maxHealth: 100,
            isAlive: p.isAlive !== false, // Default to true if not specified
            team: p.team, role: p.role, size: 20, kills: p.kills || 0,
        }));
      gameDataRef.current.otherPlayers = players;
    };

    // --- Listener for game state updates from the HOST ---
    const handleGameStateUpdate = (payload: { payload: { enemies: Enemy[], players: Player[], timeLeft: number } }) => {
        // ONLY CLIENTS should accept state from the host
        if (!isHost) {
            gameDataRef.current.enemies = payload.payload.enemies;
            
            // Update other players' state, and find our own player's state
            const self = payload.payload.players.find(p => p.id === playerId);
            if (self) {
                gameDataRef.current.player.health = self.health;
                gameDataRef.current.player.isAlive = self.isAlive;
                gameDataRef.current.player.kills = self.kills;
                if (!self.isAlive) {
                    setIsSpectating(true);
                }
            }
            gameDataRef.current.otherPlayers = payload.payload.players.filter(p => p.id !== playerId);
            setGameState(prev => ({...prev, timeLeft: payload.payload.timeLeft}));
        }
    };
    
    // --- Listener for bullets fired by OTHER players ---
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) {
        gameDataRef.current.bullets.push(payload.payload.bullet);
      }
    };

    // --- Listener for player movement from OTHER players ---
    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
        if (payload.payload.id !== playerId) {
            const movedPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.id);
            if (movedPlayer) {
                movedPlayer.x = payload.payload.x;
                movedPlayer.y = payload.payload.y;
            }
        }
    };
    
    // --- Listener for UPGRADE purchases (affects everyone) ---
    const handleUpgradePurchase = (payload: { payload: { upgradeType: string, cost: number }}) => {
        const { upgradeType, cost } = payload.payload;
        setGameState(prev => ({
            ...prev,
            timeLeft: prev.timeLeft - cost,
            [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1
        }));
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'game-state-update' }, handleGameStateUpdate);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    
    handlePresenceSync(); // Sync once on join

    return () => {
        channel.off('presence', { event: 'sync' }, handlePresenceSync);
        channel.off('broadcast', { event: 'game-state-update' }, handleGameStateUpdate);
        channel.off('broadcast', { event: 'bullet-fired' }, handleBulletFired);
        channel.off('broadcast', { event: 'player-move' }, handlePlayerMove);
        channel.off('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating]);
  
  // Input handler effect (no changes needed here)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = false; };
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            gameDataRef.current.mouse.x = e.clientX - rect.left;
            gameDataRef.current.mouse.y = e.clientY - rect.top;
        }
    };
    const handleMouseClick = () => {
        // Player can only shoot if they are alive
        if (gameDataRef.current.player.isAlive) {
            shoot(gameDataRef.current, gameState, channel, isMultiplayer);
        }
    };
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleMouseClick);
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleMouseClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef, gameState, channel, isMultiplayer]);

  // Main game loop
  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { player, otherPlayers } = gameDataRef.current;
    
    // --- SHARED LOGIC (RUNS ON ALL CLIENTS) ---
    if (player.isAlive) {
        updatePlayer(gameDataRef.current, canvas);
    }
    updateBullets(gameDataRef.current, canvas);
    
    // --- HOST-ONLY LOGIC (THE "AUTHORITATIVE" SIMULATION) ---
    if (isHost || !isMultiplayer) {
      // Update timer
      const newTimeLeft = gameState.timeLeft - deltaTime;
      if (newTimeLeft <= 0) {
        onGameEnd(player.kills); // Use local player's kills
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));

      // Update game state
      updateEnemies(gameDataRef.current);
      const allPlayers = [player, ...otherPlayers];
      const timeGained = checkBulletEnemyCollisions(gameDataRef.current, setGameState, allPlayers);
      checkPlayerEnemyCollisions(gameDataRef.current, setGameState, allPlayers);
      
      if (timeGained > 0) {
          setGameState(prev => ({...prev, timeLeft: prev.timeLeft + timeGained}));
      }

      if (gameSettings.gameMode === 'team-vs-team') {
        checkPlayerBulletCollisions(gameDataRef.current, setGameState, allPlayers);
      } else {
        spawnEnemy(gameDataRef.current, canvas, setGameState, gameSettings);
        spawnBoss(gameDataRef.current, canvas, setGameState);
      }
    }
    
    // --- MULTIPLAYER BROADCAST LOGIC ---
    if (isMultiplayer && channel && playerId) {
        // Broadcast position updates frequently
        const positionBroadcastInterval = 50; // ms
        if (now - lastPositionBroadcast.current > positionBroadcastInterval && player.isAlive) {
            lastPositionBroadcast.current = now;
            channel.send({
                type: 'broadcast',
                event: 'player-move',
                payload: { id: playerId, x: player.x, y: player.y }
            });
        }

        // HOST ONLY: Broadcast the full game state periodically
        const stateBroadcastInterval = 100; // ms (10 times per second)
        if (isHost && now - lastStateBroadcast.current > stateBroadcastInterval) {
            lastStateBroadcast.current = now;
            channel.send({
                type: 'broadcast',
                event: 'game-state-update',
                payload: {
                    enemies: gameDataRef.current.enemies,
                    players: [gameDataRef.current.player, ...gameDataRef.current.otherPlayers],
                    timeLeft: gameState.timeLeft,
                }
            });
        }
    }

    // --- RENDER (SHARED) ---
    renderGame(canvas, gameDataRef.current, playerId);

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, gameState, onGameEnd, isHost]);

  // Start/Stop effect
  useEffect(() => {
    gameDataRef.current.player.team = gameSettings.gameMode === 'team-vs-team' ? (Math.random() < 0.5 ? 'red' : 'blue') : 'blue';
    gameDataRef.current.player.id = playerId || 'solo-player';
    lastUpdateTime.current = Date.now();
    
    // Initial track for multiplayer
    if (isMultiplayer && channel && playerId) {
      channel.track({
        user_id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y,
        team: gameDataRef.current.player.team, health: 100,
        isAlive: true, role: isHost ? 'host' : 'player', kills: 0,
      });
    }
    
    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameLoop, gameSettings.gameMode, playerId, isMultiplayer, channel, isHost]);

  return null;
};

export default useGameLoop;

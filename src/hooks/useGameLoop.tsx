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
      targetX: window.innerWidth / 2, // Initialize target
      targetY: window.innerHeight / 2, // Initialize target
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

    const handlePresenceSync = () => {
      const presenceState = channel.presenceState();
      const players = Object.values(presenceState)
        .flatMap((presences: any) => presences)
        .filter((p: any) => p.user_id !== playerId)
        .map((p: any): Player => ({
            id: p.user_id,
            x: p.x || 0, y: p.y || 0,
            targetX: p.x || 0, // Initialize target to current pos
            targetY: p.y || 0, // Initialize target to current pos
            health: p.health || 100, maxHealth: 100,
            isAlive: p.isAlive !== false,
            team: p.team, role: p.role, size: 20, kills: p.kills || 0,
        }));
      gameDataRef.current.otherPlayers = players;
    };

    const handleGameStateUpdate = (payload: { payload: { enemies: Enemy[], players: Player[], timeLeft: number } }) => {
        if (!isHost) {
            gameDataRef.current.enemies = payload.payload.enemies;
            
            // Smartly update player stats without overwriting interpolated position
            payload.payload.players.forEach(updatedPlayer => {
              if (updatedPlayer.id === playerId) {
                // Update our own player's state
                const self = gameDataRef.current.player;
                self.health = updatedPlayer.health;
                self.isAlive = updatedPlayer.isAlive;
                self.kills = updatedPlayer.kills;
                if (!self.isAlive) {
                    setIsSpectating(true);
                }
              } else {
                // Update other players' stats (health, kills etc)
                const otherPlayer = gameDataRef.current.otherPlayers.find(p => p.id === updatedPlayer.id);
                if (otherPlayer) {
                  otherPlayer.health = updatedPlayer.health;
                  otherPlayer.isAlive = updatedPlayer.isAlive;
                  otherPlayer.kills = updatedPlayer.kills;
                  // DO NOT update x and y here, to avoid snapping.
                }
              }
            });

            setGameState(prev => ({...prev, timeLeft: payload.payload.timeLeft}));
        }
    };
    
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) {
        gameDataRef.current.bullets.push(payload.payload.bullet);
      }
    };

    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
        if (payload.payload.id !== playerId) {
            const movedPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.id);
            if (movedPlayer) {
                // *** THIS IS THE KEY CHANGE ***
                // Instead of teleporting, set the TARGET position for interpolation.
                movedPlayer.targetX = payload.payload.x;
                movedPlayer.targetY = payload.payload.y;
            }
        }
    };
    
    const handleUpgradePurchase = (payload: { payload: { upgradeType: string, cost: number }}) => {
        if (!isHost) { // Host already updated its state locally
            const { upgradeType, cost } = payload.payload;
            setGameState(prev => ({
                ...prev,
                timeLeft: prev.timeLeft - cost,
                [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1
            }));
        }
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'game-state-update' }, handleGameStateUpdate);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    
    handlePresenceSync();

    return () => {
        channel.off('presence', { event: 'sync' }, handlePresenceSync);
        channel.off('broadcast', { event: 'game-state-update' }, handleGameStateUpdate);
        channel.off('broadcast', { event: 'bullet-fired' }, handleBulletFired);
        channel.off('broadcast', { event: 'player-move' }, handlePlayerMove);
        channel.off('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating]);
  
  // Input handler effect (no changes needed)
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

  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { player, otherPlayers } = gameDataRef.current;
    
    if (player.isAlive) {
        updatePlayer(gameDataRef.current, canvas);
    }
    updateBullets(gameDataRef.current, canvas);

    // +++ ADD THIS BLOCK FOR INTERPOLATION +++
    // Smoothly move other players towards their target position
    otherPlayers.forEach(p => {
      if (p.isAlive) {
        // Lerp (linear interpolation) factor. 0.2 is a good starting point.
        // Higher values are snappier, lower values are smoother but have more delay.
        const lerpFactor = 0.2;
        p.x += (p.targetX - p.x) * lerpFactor;
        p.y += (p.targetY - p.y) * lerpFactor;
      }
    });
    // +++ END OF INTERPOLATION BLOCK +++
    
    if (isHost || !isMultiplayer) {
      const newTimeLeft = gameState.timeLeft - deltaTime;
      if (newTimeLeft <= 0) {
        onGameEnd(player.kills);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));

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
    
    if (isMultiplayer && channel && playerId) {
        const positionBroadcastInterval = 50;
        if (now - lastPositionBroadcast.current > positionBroadcastInterval && player.isAlive) {
            lastPositionBroadcast.current = now;
            channel.send({
                type: 'broadcast',
                event: 'player-move',
                payload: { id: playerId, x: player.x, y: player.y }
            });
        }

        const stateBroadcastInterval = 100;
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

    renderGame(canvas, gameDataRef.current, playerId);

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, gameState, onGameEnd, isHost]);

  // Start/Stop effect (no changes needed)
  useEffect(() => {
    gameDataRef.current.player.team = gameSettings.gameMode === 'team-vs-team' ? (Math.random() < 0.5 ? 'red' : 'blue') : 'blue';
    gameDataRef.current.player.id = playerId || 'solo-player';
    lastUpdateTime.current = Date.now();
    
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

// src/hooks/useGameLoop.tsx (FINAL, High-Speed Version)

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet } from '@/types';
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
  gameSettings: GameSettings;
  channel?: RealtimeChannel;
  playerId?: string;
}

const useGameLoop = ({
  canvasRef,
  gameState,
  setGameState,
  onGameEnd,
  isMultiplayer = false,
  gameSettings,
  channel,
  playerId,
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

  // Effect to set up and tear down multiplayer listeners
  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    // --- Presence listener for players joining/leaving ---
    const handlePresenceSync = () => {
      const presenceState = channel.presenceState();
      const players = Object.values(presenceState)
        .flatMap((presences: any) => presences)
        .filter((p: any) => p.user_id !== playerId);

      gameDataRef.current.otherPlayers = players.map((p: any): Player => ({
        id: p.user_id, x: p.x, y: p.y, health: p.health, maxHealth: 100,
        isAlive: p.isAlive, team: p.team, role: p.role, size: 20, kills: p.kills || 0,
      }));
    };
    
    // --- Broadcast listener for BULLETS ---
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) {
        gameDataRef.current.bullets.push(payload.payload.bullet);
      }
    };

    // --- Broadcast listener for PLAYER MOVEMENT (The new, fast part) ---
    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
        if (payload.payload.id !== playerId) {
            const movedPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.id);
            if (movedPlayer) {
                movedPlayer.x = payload.payload.x;
                movedPlayer.y = payload.payload.y;
            }
        }
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove); // <-- ADD LISTENER
    
    // Announce presence once on join
    channel.track({
        user_id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y,
        team: gameDataRef.current.player.team, health: gameDataRef.current.player.health,
        isAlive: gameDataRef.current.player.isAlive, role: 'player',
    });

    return () => {
        channel.off('presence', { event: 'sync' }, handlePresenceSync);
        channel.off('broadcast', { event: 'bullet-fired' }, handleBulletFired);
        channel.off('broadcast', { event: 'player-move' }, handlePlayerMove); // <-- CLEAN UP LISTENER
    };
  }, [isMultiplayer, channel, playerId]);
  
  // Input handler effect (no changes needed here)
  useEffect(() => {
    // ... same as before
    const handleKeyDown = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = false; };
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            gameDataRef.current.mouse.x = e.clientX - rect.left;
            gameDataRef.current.mouse.y = e.clientY - rect.top;
        }
    };
    const handleMouseClick = () => shoot(gameDataRef.current, gameState, channel);
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
  }, [canvasRef, gameState, channel]);

  // Main game loop
  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- UPDATE ---
    updatePlayer(gameDataRef.current, canvas);
    updateBullets(gameDataRef.current, canvas);
    updateEnemies(gameDataRef.current);
    checkBulletEnemyCollisions(gameDataRef.current, setGameState);
    checkPlayerEnemyCollisions(gameDataRef.current, setGameState);

    if (gameDataRef.current.gameMode === 'team-vs-team') {
      checkPlayerBulletCollisions(gameDataRef.current, setGameState);
    } else {
      spawnEnemy(gameDataRef.current, canvas, setGameState, gameSettings);
      spawnBoss(gameDataRef.current, canvas, setGameState);
    }
    
    // --- MULTIPLAYER SEND LOGIC (The crucial change) ---
    if (isMultiplayer && channel && playerId) {
        // Broadcast position updates at a high frequency (e.g., 20 times per second)
        const broadcastInterval = 16; // ms, 1000/50 = 20hz
        if (now - lastPositionBroadcast.current > broadcastInterval) {
            lastPositionBroadcast.current = now;
            channel.send({
                type: 'broadcast',
                event: 'player-move',
                payload: {
                    id: playerId,
                    x: gameDataRef.current.player.x,
                    y: gameDataRef.current.player.y
                }
            });
        }
    }

    // --- RENDER ---
    renderGame(canvas, gameDataRef.current);

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, gameState, onGameEnd]);

  // Start/Stop effect (no changes needed here)
  useEffect(() => {
    // ... same as before
    gameDataRef.current.player.team = gameSettings.gameMode === 'team-vs-team' ? (Math.random() < 0.5 ? 'red' : 'blue') : 'blue';
    gameDataRef.current.player.id = playerId || 'solo-player';
    lastUpdateTime.current = Date.now();
    
    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameLoop, gameSettings.gameMode, playerId]);

  return null;
};

export default useGameLoop;

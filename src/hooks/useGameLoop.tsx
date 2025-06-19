// src/hooks/useGameLoop.tsx (Corrected Version)

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet } from '@/types';
import { renderGame } from '@/utils/gameRenderer'; // Make sure this import is correct

// --- THIS SECTION IS NOW CORRECT ---
// We are importing the REAL functions from your gameLogic.ts file
// The placeholder functions have been removed.
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
// --- END OF CORRECTED SECTION ---

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

  // Effect to set up and tear down multiplayer listeners
  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePresenceSync = () => {
      const presenceState = channel.presenceState();
      const players = Object.values(presenceState)
        .flatMap((presences: any) => presences)
        .filter((p: any) => p.user_id !== playerId);

      gameDataRef.current.otherPlayers = players.map((p: any): Player => ({
        id: p.user_id,
        x: p.x,
        y: p.y,
        health: p.health,
        maxHealth: 100,
        isAlive: p.isAlive,
        team: p.team,
        role: p.role,
        size: 20,
        kills: p.kills || 0,
      }));
    };

    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) {
        gameDataRef.current.bullets.push(payload.payload.bullet);
      }
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    
    channel.track({
        user_id: playerId,
        x: gameDataRef.current.player.x,
        y: gameDataRef.current.player.y,
        team: gameDataRef.current.player.team,
        health: gameDataRef.current.player.health,
        isAlive: gameDataRef.current.player.isAlive,
        role: 'player',
    });

    return () => {
        channel.off('presence', { event: 'sync' }, handlePresenceSync);
        channel.off('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    };
  }, [isMultiplayer, channel, playerId]);
  
  // Effect for handling user input
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

    setGameState(prev => {
      const newTimeLeft = Math.max(0, prev.timeLeft - deltaTime);
      if (newTimeLeft <= 0 && prev.timeLeft > 0) { // Only trigger onGameEnd once
        onGameEnd(Math.floor((Date.now() - gameDataRef.current.gameStartTime) / 1000));
        return { ...prev, timeLeft: 0 };
      }
      return { ...prev, timeLeft: newTimeLeft };
    });

    if (isMultiplayer && channel && playerId && Math.random() < 0.2) {
      channel.track({
        user_id: playerId,
        x: gameDataRef.current.player.x,
        y: gameDataRef.current.player.y,
        team: gameDataRef.current.player.team,
        health: gameDataRef.current.player.health,
        isAlive: gameDataRef.current.player.isAlive,
      });
    }

    // --- RENDER ---
    renderGame(canvas, gameDataRef.current);

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, onGameEnd, setGameState, channel, playerId, canvasRef, gameState]);

  // Effect to start and stop the game loop
  useEffect(() => {
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

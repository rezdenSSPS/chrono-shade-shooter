// src/hooks/useGameLoop.tsx

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet } from '@/types';
import { renderGame } from '@/utils/gameRenderer'; // Make sure this import is correct

// --- PLACEHOLDER UTILS ---
// You should have your own implementations for these.
const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => { /* Your logic */ };
const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => { /* Your logic */ };
const updateEnemies = (gameData: GameData) => { /* Your logic */ };
const checkBulletEnemyCollisions = (gameData: GameData, setGameState: any) => { /* Your logic */ };
const checkPlayerEnemyCollisions = (gameData: GameData, setGameState: any) => { /* Your logic */ };
const checkPlayerBulletCollisions = (gameData: GameData, setGameState: any) => { /* Your logic for PvP */ };
const spawnEnemy = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: any, gameSettings?: GameSettings) => { /* Your logic */ };
const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: any) => { /* Your logic */ };
const shoot = (gameData: GameData, gameState: GameUIState, channel?: RealtimeChannel | null) => { /* Your logic, must now handle broadcasting bullets */ };
// --- END PLACEHOLDER UTILS ---

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
  });
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());

  // Effect to set up and tear down multiplayer listeners
  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    console.log(`[GameLoop] Setting up listeners for channel: ${channel.topic} and player: ${playerId}`);

    const handlePresenceSync = () => {
      const presenceState = channel.presenceState();
      console.log("[Presence SYNC] Raw State: ", presenceState);

      const players = Object.values(presenceState)
        .flatMap((presences: any) => presences)
        .filter((p: any) => p.user_id !== playerId); // Filter out myself

      console.log("[Presence SYNC] Filtered others: ", players);

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
        
      console.log("[Presence SYNC] Updated gameDataRef.otherPlayers: ", gameDataRef.current.otherPlayers);
    };

    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) {
        console.log("[Broadcast] Received bullet from other player", payload.payload.bullet);
        gameDataRef.current.bullets.push(payload.payload.bullet);
      }
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    
    // Initial track to announce presence
    console.log(`[GameLoop] First time tracking for player ${playerId}`);
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
        console.log(`[GameLoop] Cleaning up listeners for channel: ${channel.topic}`);
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
  }, [canvasRef, gameState, channel]); // Add channel to dependencies

  // The main game loop function, wrapped in useCallback for performance
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

    if (gameSettings.gameMode === 'team-vs-team') {
      checkPlayerBulletCollisions(gameDataRef.current, setGameState);
    } else {
      spawnEnemy(gameDataRef.current, canvas, setGameState, gameSettings);
      spawnBoss(gameDataRef.current, canvas, setGameState);
    }

    setGameState(prev => {
      const newTimeLeft = Math.max(0, prev.timeLeft - deltaTime);
      if (newTimeLeft <= 0) {
        onGameEnd(Math.floor((Date.now() - prev.gameStartTime) / 1000));
        return { ...prev, timeLeft: 0 };
      }
      return { ...prev, timeLeft: newTimeLeft };
    });

    if (isMultiplayer && channel && playerId && Math.random() < 0.2) { // Throttle presence updates
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
  }, [canvasRef, gameSettings, isMultiplayer, onGameEnd, setGameState, channel, playerId]);

  // Effect to start and stop the game loop
  useEffect(() => {
    // Initial player setup
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

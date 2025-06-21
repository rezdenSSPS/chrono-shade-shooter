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
      x: window.innerWidth / 2, y: window.innerHeight / 2,
      targetX: window.innerWidth / 2, targetY: window.innerHeight / 2,
      size: 20, health: 100, maxHealth: 100,
      isAlive: true, kills: 0,
    },
    otherPlayers: [], enemies: [], bullets: [],
    keys: {}, mouse: { x: 0, y: 0, isDown: false }, // Initialize isDown
    lastShot: 0, lastEnemySpawn: 0, lastBossSpawn: 0,
    gameMode: gameSettings.gameMode, gameStartTime: Date.now(),
  });

  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());
  const lastPositionBroadcast = useRef(0);
  const lastStateBroadcast = useRef(0);
  const respawnTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Authoritative hit processing (no changes from previous step)
  const processHit = useCallback((victimId: string, killerId: string, damage: number) => {
    if (!isHost) return;
    const allPlayers = [gameDataRef.current.player, ...gameDataRef.current.otherPlayers];
    const victim = allPlayers.find(p => p.id === victimId);
    const killer = allPlayers.find(p => p.id === killerId);

    if (victim && victim.isAlive) {
      victim.health -= damage;
      if (victim.health <= 0) {
        victim.health = 0;
        victim.isAlive = false;
        if (killer && killer.team !== victim.team) {
          killer.kills += 1;
          if (killer.team === 'red') setGameState(prev => ({ ...prev, teamScores: { ...prev.teamScores, red: prev.teamScores.red + 1 } }));
          else if (killer.team === 'blue') setGameState(prev => ({ ...prev, teamScores: { ...prev.teamScores, blue: prev.teamScores.blue + 1 } }));
        }
        const respawnTimer = setTimeout(() => {
          victim.health = victim.maxHealth;
          victim.isAlive = true;
          if (canvasRef.current) {
            victim.x = Math.random() * canvasRef.current.width;
            victim.y = Math.random() * canvasRef.current.height;
            victim.targetX = victim.x;
            victim.targetY = victim.y;
          }
          respawnTimeouts.current.delete(victimId);
        }, 3000);
        respawnTimeouts.current.set(victimId, respawnTimer);
      }
    }
  }, [isHost, setGameState, canvasRef]);
  
  // PvP Collision Logic (no changes from previous step)
  const checkPlayerBulletCollisions = useCallback(() => {
    const { bullets, player, otherPlayers } = gameDataRef.current;
    const allPlayers = [player, ...otherPlayers];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      for (const p of allPlayers) {
        if (p.team !== bullet.team && p.isAlive) {
          const dist = Math.hypot(bullet.x - p.x, bullet.y - p.y);
          if (dist < p.size + bullet.size) {
            if (isHost) {
              processHit(p.id, bullet.playerId, bullet.damage || 10);
            } else if (playerId === bullet.playerId) {
              channel?.send({
                type: 'broadcast', event: 'player-hit',
                payload: { victimId: p.id, killerId: bullet.playerId, damage: bullet.damage || 10 }
              });
            }
            bullets.splice(i, 1);
            break; 
          }
        }
      }
    }
  }, [isHost, channel, processHit, playerId]);

  // Restructured Input and Canvas Setup Effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = false; };
    const handleMouseDown = () => { gameDataRef.current.mouse.isDown = true; };
    const handleMouseUp = () => { gameDataRef.current.mouse.isDown = false; };

    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            gameDataRef.current.mouse.x = e.clientX - rect.left;
            gameDataRef.current.mouse.y = e.clientY - rect.top;
        }
    };

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
          // This is the fix for the zoom issue.
          // Set the internal drawing surface size to match the window.
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Call resize immediately on mount to set the initial canvas size correctly
    handleResize();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef]); // This effect should only run once when the component mounts

  // Multiplayer Listeners Effect (no changes from previous step)
  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePlayerHit = (payload: { payload: { victimId: string, killerId: string, damage: number }}) => { /* ...same... */ };
    const handlePresenceSync = () => { /* ...same... */ };
    const handleGameStateUpdate = (payload: any) => { /* ...same... */ };
    const handleBulletFired = (payload: any) => { /* ...same... */ };
    const handlePlayerMove = (payload: any) => { /* ...same... */ };
    const handleUpgradePurchase = (payload: any) => { /* ...same... */ };

    channel.on('broadcast', { event: 'player-hit' }, handlePlayerHit);
    // ... all other channel listeners
    handlePresenceSync();

    return () => {
      // ... all channel listener cleanup
      respawnTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating, processHit]);

  // Main Game Loop
  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { player, otherPlayers, mouse } = gameDataRef.current;
    
    // NEW: Handle shooting inside the game loop based on mouse state
    if (mouse.isDown && player.isAlive) {
        shoot(gameDataRef.current, gameState, channel, isMultiplayer);
    }

    if (player.isAlive) {
        updatePlayer(gameDataRef.current, canvas);
    }
    updateBullets(gameDataRef.current, canvas);

    otherPlayers.forEach(p => {
      if (p.isAlive) {
        const lerpFactor = 0.2;
        p.x += (p.targetX - p.x) * lerpFactor;
        p.y += (p.targetY - p.y) * lerpFactor;
      }
    });
    
    if (gameSettings.gameMode === 'team-vs-team') {
      checkPlayerBulletCollisions();
    }
    
    if (isHost || !isMultiplayer) {
      // ... host logic is the same as previous step
      const newTimeLeft = gameState.timeLeft - deltaTime;
      if (newTimeLeft <= 0) {
        const finalScore = gameSettings.gameMode === 'team-vs-team' ? Math.max(gameState.teamScores.red, gameState.teamScores.blue) : player.kills;
        onGameEnd(finalScore);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));
      if (gameSettings.gameMode !== 'team-vs-team') {
        // PvE logic
      }
    }
    
    if (isMultiplayer && channel && playerId) {
      // ... broadcast logic is the same
    }

    renderGame(canvas, gameDataRef.current, playerId);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [
    gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, 
    gameState, onGameEnd, isHost, checkPlayerBulletCollisions
  ]);

  // Start/Stop Effect
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
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameLoop, gameSettings.gameMode, playerId, isMultiplayer, channel, isHost]);

  return null;
};

export default useGameLoop;

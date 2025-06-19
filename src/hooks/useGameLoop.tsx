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
      id: playerId || 'solo', x: window.innerWidth / 2, y: window.innerHeight / 2,
      size: 20, health: 100, maxHealth: 100, isAlive: true, kills: 0,
    },
    otherPlayers: [], enemies: [], bullets: [], keys: {},
    mouse: { x: 0, y: 0 }, lastShot: 0, lastEnemySpawn: 0, lastBossSpawn: 0,
    gameMode: gameSettings.gameMode, gameStartTime: Date.now(),
  });
  
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());
  const lastPositionBroadcast = useRef(0);
  const lastTimeBroadcast = useRef(0);

  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePlayerHit = (payload: { payload: { playerId: string; newHealth: number; by: string }}) => {
        const { playerId: hitPlayerId, newHealth } = payload.payload;
        
        // Update local player
        if (hitPlayerId === playerId) {
            gameDataRef.current.player.health = newHealth;
            if (newHealth <= 0 && gameDataRef.current.player.isAlive) {
                gameDataRef.current.player.isAlive = false;
                setIsSpectating(true);
                // Host broadcasts death
                if (isHost) {
                    channel.send({ type: 'broadcast', event: 'player-died', payload: { playerId } });
                }
            }
        } else { // Update other players
            const otherPlayer = gameDataRef.current.otherPlayers.find(p => p.id === hitPlayerId);
            if(otherPlayer) otherPlayer.health = newHealth;
        }
    };
    
    const handlePlayerDied = (payload: { payload: { playerId: string }}) => {
        const otherPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.playerId);
        if(otherPlayer) otherPlayer.isAlive = false;
    };

    const handleUpgradePurchase = (payload: { payload: { upgradeType: string; cost: number } }) => {
        const { upgradeType, cost } = payload.payload;
        setGameState(prev => {
            const levelKey = `${upgradeType}Level` as 'gunLevel' | 'fireRateLevel' | 'bulletSizeLevel';
            return {
                ...prev,
                timeLeft: prev.timeLeft - cost,
                [levelKey]: prev[levelKey] + 1
            };
        });
    };

    const handlePresenceSync = () => { /* ... existing code ... */ };
    const handleBulletFired = (payload: any) => { /* ... existing code ... */ };
    const handlePlayerMove = (payload: any) => { /* ... existing code ... */ };
    const handleTimeUpdate = (payload: any) => { /* ... existing code ... */ };

    channel.on('broadcast', { event: 'player-hit' }, handlePlayerHit);
    channel.on('broadcast', { event: 'player-died' }, handlePlayerDied);
    channel.on('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    // ... other listeners ...
    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'time-update' }, (payload: { payload: { timeLeft: number }}) => {
      if (!isHost) setGameState(prev => ({ ...prev, timeLeft: payload.payload.timeLeft }));
    });

    channel.track({ user_id: playerId, /* ... */ });

    return () => {
      channel.off('broadcast', { event: 'player-hit' });
      channel.off('broadcast', { event: 'player-died' });
      channel.off('broadcast', { event: 'purchase-upgrade' });
      // ... other cleanup ...
      channel.off('presence', { event: 'sync' });
      channel.off('broadcast', { event: 'bullet-fired' });
      channel.off('broadcast', { event: 'player-move' });
      channel.off('broadcast', { event: 'time-update' });
    };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating]);

  useEffect(() => { /* ... input handlers ... */ }, [canvasRef, gameState, channel]);

  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isMultiplayer || isHost) {
      const newTimeLeft = gameState.timeLeft - deltaTime;
      if (newTimeLeft <= 0) {
        onGameEnd(gameDataRef.current.player.kills);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));
      if (isMultiplayer && channel && now - lastTimeBroadcast.current > 1000) {
        lastTimeBroadcast.current = now;
        channel.send({ type: 'broadcast', event: 'time-update', payload: { timeLeft: newTimeLeft } });
      }
    }
    
    // Authoritative game logic for host
    if (!isMultiplayer || isHost) {
        updateEnemies(gameDataRef.current);
        checkBulletEnemyCollisions(gameDataRef.current, setGameState);
        checkPlayerEnemyCollisions(gameDataRef.current, setGameState, channel);
        if (gameSettings.gameMode === 'team-vs-team') {
            checkPlayerBulletCollisions(gameDataRef.current, setGameState, channel);
        } else {
            spawnEnemy(gameDataRef.current, canvas, setGameState, gameSettings);
            if (gameSettings.bossEnabled) {
                spawnBoss(gameDataRef.current, canvas, setGameState);
            }
        }
    }

    // Client-side prediction/updates
    updatePlayer(gameDataRef.current, canvas);
    updateBullets(gameDataRef.current, canvas);

    if (isMultiplayer && channel && playerId && gameDataRef.current.player.isAlive) {
        const broadcastInterval = 16;
        if (now - lastPositionBroadcast.current > broadcastInterval) {
            lastPositionBroadcast.current = now;
            channel.send({
                type: 'broadcast', event: 'player-move',
                payload: { id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y }
            });
        }
    }

    renderGame(canvas, gameDataRef.current);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, isHost, setGameState, channel, playerId, canvasRef, gameState, onGameEnd]);

  useEffect(() => {
    gameDataRef.current.player.team = gameSettings.gameMode === 'team-vs-team' ? (Math.random() < 0.5 ? 'red' : 'blue') : 'blue';
    gameDataRef.current.player.id = playerId || 'solo-player';
    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [gameLoop, gameSettings.gameMode, playerId]);

  return null;
};

export default useGameLoop;

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet, Enemy } from '@/types';
import { renderGame } from '@/utils/gameRenderer';
import { updatePlayer, updateBullets, updateEnemies, checkBulletEnemyCollisions, checkPlayerEnemyCollisions, checkPlayerBulletCollisions, spawnEnemy, spawnBoss, shoot } from '@/utils/gameLogic';
import { supabase } from '@/integrations/supabase/client';

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
  canvasRef, gameState, setGameState, onGameEnd,
  isMultiplayer = false, isHost = false, gameSettings,
  channel, playerId, setIsSpectating,
}: UseGameLoopProps) => {
  const gameDataRef = useRef<GameData>({
    player: { id: playerId || 'solo', x: 0, y: 0, size: 25, health: 100, maxHealth: 100, isAlive: true, kills: 0 },
    otherPlayers: [], enemies: [], bullets: [], keys: {}, mouse: { x: 0, y: 0 },
    lastShot: 0, lastEnemySpawn: 0, lastBossSpawn: 0,
    gameMode: gameSettings.gameMode, gameStartTime: Date.now(),
  });
  
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());
  const lastPositionBroadcast = useRef(0);
  const lastTimeBroadcast = useRef(0);

  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePlayerHit = (payload: { payload: { playerId: string; newHealth: number }}) => {
      const { playerId: hitPlayerId, newHealth } = payload.payload;
      const player = hitPlayerId === playerId ? gameDataRef.current.player : gameDataRef.current.otherPlayers.find(p => p.id === hitPlayerId);
      if (player) {
        player.health = newHealth;
        if (newHealth <= 0 && player.isAlive) {
          if (isHost) channel.send({ type: 'broadcast', event: 'player-died', payload: { playerId: hitPlayerId } });
        }
      }
    };
    
    const handlePlayerDied = (payload: { payload: { playerId: string }}) => {
      const targetPlayerId = payload.payload.playerId;
      if (targetPlayerId === playerId && gameDataRef.current.player.isAlive) {
          gameDataRef.current.player.isAlive = false;
          setIsSpectating(true);
      } else {
        const p = gameDataRef.current.otherPlayers.find(p => p.id === targetPlayerId);
        if(p) p.isAlive = false;
      }
    };
    
    const handleUpgradePurchase = (payload: { payload: { upgradeType: 'gun' | 'fireRate' | 'bulletSize'; cost: number } }) => {
      const { upgradeType, cost } = payload.payload;
      setGameState(prev => ({ ...prev, timeLeft: prev.timeLeft - cost, [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1 }));
    };

    const handleEnemySpawn = (payload: { payload: { enemy: Enemy } }) => { if (!isHost) gameDataRef.current.enemies.push(payload.payload.enemy); };
    const handleEnemyHit = (payload: { payload: { enemyId: string, newHealth: number } }) => { const e = gameDataRef.current.enemies.find(en => en.id === payload.payload.enemyId); if (e) e.health = payload.payload.newHealth; };
    const handleEnemyKilled = (payload: { payload: { enemyId: string, killerId: string } }) => {
        gameDataRef.current.enemies = gameDataRef.current.enemies.filter(en => en.id !== payload.payload.enemyId);
        setGameState(prev => ({ ...prev, enemiesKilled: prev.enemiesKilled + 1 }));
    };
    
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => { if (payload.payload.bullet.playerId !== playerId) gameDataRef.current.bullets.push(payload.payload.bullet); };
    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number, health: number, isAlive: boolean } }) => {
      if (payload.payload.id !== playerId) { 
        const p = gameDataRef.current.otherPlayers.find(pl => pl.id === payload.payload.id);
        if (p) { p.x = payload.payload.x; p.y = payload.payload.y; p.health = payload.payload.health; p.isAlive = payload.payload.isAlive; }
      }
    };
    const handleTimeUpdate = (payload: { payload: { timeLeft: number }}) => { if (!isHost) setGameState(prev => ({ ...prev, timeLeft: payload.payload.timeLeft })); };
    const handleGameOver = () => { if(!isHost) onGameEnd(gameState.enemiesKilled); };

    channel.on('broadcast', { event: 'player-hit' }, handlePlayerHit);
    channel.on('broadcast', { event: 'player-died' }, handlePlayerDied);
    channel.on('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    channel.on('broadcast', { event: 'enemy-spawn' }, handleEnemySpawn);
    channel.on('broadcast', { event: 'enemy-hit' }, handleEnemyHit);
    channel.on('broadcast', { event: 'enemy-killed' }, handleEnemyKilled);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'time-update' }, handleTimeUpdate);
    channel.on('broadcast', { event: 'game-over' }, handleGameOver);

    return () => { supabase.removeChannel(channel); };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating, onGameEnd]);

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
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('click', handleMouseClick);
    return () => {
        window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('click', handleMouseClick);
    };
  }, [canvasRef, gameState, channel]);

  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isMultiplayer || isHost) {
      const newTimeLeft = gameState.timeLeft - deltaTime;
      const allPlayersDead = isMultiplayer && gameDataRef.current.otherPlayers.every(p => !p.isAlive) && !gameDataRef.current.player.isAlive;
      if (newTimeLeft <= 0 || (gameSettings.gameMode === 'team-vs-enemies' && allPlayersDead)) {
        onGameEnd(gameState.enemiesKilled);
        if(isMultiplayer && channel) channel.send({type: 'broadcast', event: 'game-over' });
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));
      if (isMultiplayer && channel && now - lastTimeBroadcast.current > 1000) {
        lastTimeBroadcast.current = now;
        channel.send({ type: 'broadcast', event: 'time-update', payload: { timeLeft: newTimeLeft } });
      }
    }
    
    if (!isMultiplayer || isHost) {
        updateEnemies(gameDataRef.current);
        checkBulletEnemyCollisions(gameDataRef.current, channel);
        checkPlayerEnemyCollisions(gameDataRef.current, channel);
        if (gameSettings.gameMode === 'team-vs-team') {
            checkPlayerBulletCollisions(gameDataRef.current, channel);
        } else {
            const newEnemy = spawnEnemy(gameDataRef.current, canvas, gameSettings);
            if (newEnemy) {
                gameDataRef.current.enemies.push(newEnemy);
                if (channel) channel.send({ type: 'broadcast', event: 'enemy-spawn', payload: { enemy: newEnemy } });
            }
            if (gameSettings.bossEnabled) spawnBoss(gameDataRef.current, canvas, setGameState);
        }
    }

    updatePlayer(gameDataRef.current, canvas);
    updateBullets(gameDataRef.current, canvas);

    if (isMultiplayer && channel && playerId && gameDataRef.current.player.isAlive) {
        if (now - lastPositionBroadcast.current > 16) {
            lastPositionBroadcast.current = now;
            channel.send({ type: 'broadcast', event: 'player-move', payload: { id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y, health: gameDataRef.current.player.health, isAlive: gameDataRef.current.player.isAlive } });
        }
    }
    renderGame(canvas, gameDataRef.current);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameState, gameSettings, isMultiplayer, isHost, channel, playerId, onGameEnd]);

  useEffect(() => {
    const { width, height } = canvasRef.current!.getBoundingClientRect();
    gameDataRef.current.player.x = width / 2;
    gameDataRef.current.player.y = height / 2;
    gameDataRef.current.player.team = gameSettings.gameMode === 'team-vs-team' ? (isHost ? 'red' : 'blue') : 'blue';
    
    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [gameLoop]);

  return null;
};
export default useGameLoop;

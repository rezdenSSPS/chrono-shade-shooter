import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet, Enemy } from '@/types';
import { renderGame } from '@/utils/gameRenderer';
import { updatePlayer, updateBullets, updateEnemies, checkCollisions, spawnEnemy, spawnBoss, shoot } from '@/utils/gameLogic';
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
    player: { id: playerId || 'solo', x: window.innerWidth/2, y: window.innerHeight/2, size: 20, health: 100, maxHealth: 100, isAlive: true, kills: 0 },
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

    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
      if (payload.payload.id !== playerId) {
        const p = gameDataRef.current.otherPlayers.find(pl => pl.id === payload.payload.id);
        if (p) { p.x = payload.payload.x; p.y = payload.payload.y; }
      }
    };
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => { if (payload.payload.bullet.playerId !== playerId) gameDataRef.current.bullets.push(payload.payload.bullet); };
    const handleTimeUpdate = (payload: { payload: { timeLeft: number }}) => { if (!isHost) setGameState(prev => ({ ...prev, timeLeft: payload.payload.timeLeft })); };

    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'time-update' }, handleTimeUpdate);

    return () => { supabase.removeChannel(channel); };
  }, [isMultiplayer, channel, playerId, isHost, setGameState]);

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

    // Timer logic (Authoritative: SP or Host only)
    if (!isMultiplayer || isHost) {
      const newTimeLeft = gameState.timeLeft - deltaTime;
      if (newTimeLeft <= 0) {
        onGameEnd(gameState.enemiesKilled);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));
      if (isMultiplayer && channel && now - lastTimeBroadcast.current > 1000) {
        lastTimeBroadcast.current = now;
        channel.send({ type: 'broadcast', event: 'time-update', payload: { timeLeft: newTimeLeft } });
      }
    }
    
    updatePlayer(gameDataRef.current, canvas);
    updateBullets(gameDataRef.current, canvas);

    if (isMultiplayer && channel && playerId && gameDataRef.current.player.isAlive) {
        if (now - lastPositionBroadcast.current > 32) {
            lastPositionBroadcast.current = now;
            channel.send({ type: 'broadcast', event: 'player-move', payload: { id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y } });
        }
    }
    renderGame(canvas, gameDataRef.current);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameState, gameSettings, isMultiplayer, isHost, channel, playerId, onGameEnd]);

  useEffect(() => {
    const { width, height } = canvasRef.current!.getBoundingClientRect();
    gameDataRef.current.player.x = width / 2;
    gameDataRef.current.player.y = height / 2;
    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [gameLoop]);

  return null;
};
export default useGameLoop;

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet } from '@/types';
import { renderGame } from '@/utils/gameRenderer';
import {
  updatePlayer,
  updateOtherPlayers,
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
  setPlacement: React.Dispatch<React.SetStateAction<number | null>>;
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
  setPlacement,
}: UseGameLoopProps) => {
  const gameDataRef = useRef<GameData>({
    player: {
      id: playerId || 'solo', x: window.innerWidth / 2, y: window.innerHeight / 2,
      targetX: window.innerWidth / 2, targetY: window.innerHeight / 2,
      size: 20, health: 100, maxHealth: 100, isAlive: true, kills: 0,
    },
    otherPlayers: [], enemies: [], bullets: [], keys: {},
    mouse: { x: 0, y: 0 }, lastShot: 0, lastEnemySpawn: 0, lastBossSpawn: 0,
    gameMode: gameSettings.gameMode, gameStartTime: Date.now(),
  });
  const localPlayerDied = useRef(false);
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());
  const lastPositionBroadcast = useRef(0);

  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePresenceSync = () => {
        const presenceState = channel.presenceState();
        const players = Object.values(presenceState).flatMap((p: any) => p).filter((p: any) => p.user_id !== playerId);
        
        players.forEach((p: any) => {
            let existingPlayer = gameDataRef.current.otherPlayers.find(op => op.id === p.user_id);
            if (existingPlayer) {
                if (p.isAlive !== undefined) existingPlayer.isAlive = p.isAlive;
            } else {
                gameDataRef.current.otherPlayers.push({
                    id: p.user_id, x: p.x, y: p.y,
                    targetX: p.x, targetY: p.y,
                    health: p.health || 100, maxHealth: 100, isAlive: p.isAlive !== false,
                    team: p.team, role: p.role, size: 20, kills: p.kills || 0,
                });
            }
        });
        gameDataRef.current.otherPlayers = gameDataRef.current.otherPlayers.filter(op => players.some((p: any) => p.user_id === op.id));
    };
    
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) gameDataRef.current.bullets.push(payload.payload.bullet);
    };

    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
        if (payload.payload.id !== playerId) {
            const movedPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.id);
            if (movedPlayer) {
                movedPlayer.targetX = payload.payload.x;
                movedPlayer.targetY = payload.payload.y;
            }
        }
    };

    const handleRequestUpgrade = ({ payload }: { payload: { upgradeType: string }}) => {
        if (!isHost) return;
        const costMap = { gun: [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285], fireRate: [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210], bulletSize: [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335] };
        const levelKey = `${payload.upgradeType}Level` as keyof GameUIState;
        const currentLevel = gameState[levelKey] as number;
        const cost = costMap[payload.upgradeType as keyof typeof costMap][currentLevel];
        if (gameState.timeLeft >= cost && currentLevel < 10) {
            channel.send({ type: 'broadcast', event: 'apply-upgrade', payload: { upgradeType: payload.upgradeType, newTimeLeft: gameState.timeLeft - cost } });
        }
    };

    const handleApplyUpgrade = ({ payload }: { payload: { upgradeType: string, newTimeLeft: number }}) => {
        const levelKey = `${payload.upgradeType}Level` as keyof GameUIState;
        setGameState(prev => ({ ...prev, timeLeft: payload.newTimeLeft, [levelKey]: (prev[levelKey] as number) + 1 }));
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'request-upgrade' }, handleRequestUpgrade);
    channel.on('broadcast', { event: 'apply-upgrade' }, handleApplyUpgrade);
    
    channel.track({ user_id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y, team: gameDataRef.current.player.team, health: 100, isAlive: true, role: 'player' });

    return () => {
        channel.off('presence', { event: 'sync' }, handlePresenceSync);
        channel.off('broadcast', { event: 'bullet-fired' }, handleBulletFired);
        channel.off('broadcast', { event: 'player-move' }, handlePlayerMove);
        channel.off('broadcast', { event: 'request-upgrade' }, handleRequestUpgrade);
        channel.off('broadcast', { event: 'apply-upgrade' }, handleApplyUpgrade);
    };
  }, [isMultiplayer, channel, playerId, isHost, gameState, setGameState]);
  
  useEffect(() => { /* Input handler effect - no changes */ }, [canvasRef, gameState, channel]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    updatePlayer(gameDataRef.current, canvas);
    updateOtherPlayers(gameDataRef.current);
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
    
    if (isMultiplayer && gameDataRef.current.gameMode === 'team-vs-team' && !localPlayerDied.current) {
        if (!gameDataRef.current.player.isAlive) {
            localPlayerDied.current = true;
            const alivePlayers = gameDataRef.current.otherPlayers.filter(p => p.isAlive);
            setPlacement(alivePlayers.length + 1);
            if (channel && playerId) channel.track({ user_id: playerId, isAlive: false });
        }
    }

    const now = Date.now();
    setGameState(prev => {
        const newTimeLeft = Math.max(0, prev.timeLeft - (now - lastUpdateTime.current)/1000);
        if (newTimeLeft <= 0 && prev.timeLeft > 0) {
            onGameEnd(Math.floor((now - gameDataRef.current.gameStartTime) / 1000));
            return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: newTimeLeft };
    });
    lastUpdateTime.current = now;

    if (isMultiplayer && channel && playerId) {
        if (now - lastPositionBroadcast.current > 33) {
            lastPositionBroadcast.current = now;
            channel.send({ type: 'broadcast', event: 'player-move', payload: { id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y } });
        }
    }

    renderGame(canvas, gameDataRef.current);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, onGameEnd, setGameState, channel, playerId, canvasRef, setPlacement, gameState]);

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

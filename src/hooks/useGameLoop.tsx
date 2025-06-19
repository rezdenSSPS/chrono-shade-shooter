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
    
    // --- Presence & Broadcast Listeners ---
    const handlePresenceSync = () => { /* ... same as before, with targetX/Y init ... */ };
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => { /* ... same as before ... */ };
    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => { /* ... same as before ... */ };
    
    const handleRequestUpgrade = ({ payload }: { payload: { upgradeType: string }}) => {
        if (!isHost) return;
        const costMap = {
            gun: [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285],
            fireRate: [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210],
            bulletSize: [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335],
        };
        const levelKey = `${payload.upgradeType}Level` as 'gunLevel' | 'fireRateLevel' | 'bulletSizeLevel';
        const currentLevel = gameState[levelKey];
        const cost = costMap[payload.upgradeType as keyof typeof costMap][currentLevel];
        if (gameState.timeLeft >= cost && currentLevel < 10) {
            channel.send({
                type: 'broadcast',
                event: 'apply-upgrade',
                payload: { upgradeType: payload.upgradeType, newTimeLeft: gameState.timeLeft - cost }
            });
        }
    };

    const handleApplyUpgrade = ({ payload }: { payload: { upgradeType: string, newTimeLeft: number }}) => {
        const levelKey = `${payload.upgradeType}Level` as 'gunLevel' | 'fireRateLevel' | 'bulletSizeLevel';
        setGameState(prev => ({ ...prev, timeLeft: payload.newTimeLeft, [levelKey]: prev[levelKey] + 1 }));
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'request-upgrade' }, handleRequestUpgrade);
    channel.on('broadcast', { event: 'apply-upgrade' }, handleApplyUpgrade);
    
    channel.track({ /* ... same as before ... */ });

    return () => {
        channel.off('presence', { event: 'sync' }, handlePresenceSync);
        channel.off('broadcast', { event: 'bullet-fired' }, handleBulletFired);
        channel.off('broadcast', { event: 'player-move' }, handlePlayerMove);
        channel.off('broadcast', { event: 'request-upgrade' }, handleRequestUpgrade);
        channel.off('broadcast', { event: 'apply-upgrade' }, handleApplyUpgrade);
    };
  }, [isMultiplayer, channel, playerId, isHost, gameState, setGameState]);
  
  // Input handler effect (no changes)
  useEffect(() => { /* ... same as before ... */ }, [canvasRef, gameState, channel]);

  const gameLoop = useCallback(() => {
    // ... setup (now, deltaTime, etc) same as before ...
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- UPDATE ---
    updatePlayer(gameDataRef.current, canvas);
    updateOtherPlayers(gameDataRef.current);
    updateBullets(gameDataRef.current, canvas);
    updateEnemies(gameDataRef.current);

    // --- Collision and Death Checks ---
    checkBulletEnemyCollisions(gameDataRef.current, setGameState);
    checkPlayerEnemyCollisions(gameDataRef.current, setGameState);
    if (gameDataRef.current.gameMode === 'team-vs-team') {
      checkPlayerBulletCollisions(gameDataRef.current, setGameState);
    }
    
    // Check for local player death to set placement
    if (isMultiplayer && gameDataRef.current.gameMode === 'team-vs-team' && !localPlayerDied.current) {
        const myPlayer = gameDataRef.current.player;
        if (!myPlayer.isAlive) {
            localPlayerDied.current = true;
            const alivePlayers = gameDataRef.current.otherPlayers.filter(p => p.isAlive);
            const myPlacement = alivePlayers.length + 1;
            setPlacement(myPlacement);
            if (channel && playerId) channel.track({ user_id: playerId, isAlive: false });
        }
    }

    // --- Game Timer and End Condition ---
    setGameState(prev => {
        const newTimeLeft = Math.max(0, prev.timeLeft - (Date.now() - lastUpdateTime.current)/1000);
        if (newTimeLeft <= 0 && prev.timeLeft > 0) {
            onGameEnd(Math.floor((Date.now() - gameDataRef.current.gameStartTime) / 1000));
            return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: newTimeLeft };
    });
    lastUpdateTime.current = Date.now();

    // --- Network Send ---
    if (isMultiplayer && channel && playerId) {
        // ... broadcast logic same as before ...
    }

    // --- RENDER ---
    renderGame(canvas, gameDataRef.current);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, onGameEnd, setGameState, channel, playerId, canvasRef, setPlacement, gameState]);

  // Start/Stop effect (no changes)
  useEffect(() => { /* ... same as before ... */ }, [gameLoop, gameSettings.gameMode, playerId]);

  return null;
};

export default useGameLoop;

// src/hooks/useGameLoop.tsx
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameData, GameState } from '@/types/game';
import { renderGame } from '@/utils/gameRenderer';
import { updatePlayer, updateBullets, updateEnemies, checkBulletEnemyCollisions, checkPlayerEnemyCollisions, checkPlayerBulletCollisions } from '@/utils/gameLogic';
import { spawnEnemy, spawnBoss } from '@/utils/enemySpawner';
import { shoot } from '@/utils/shooting';

const useGameLoop = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onGameEnd: (score: number) => void,
  isMultiplayer: boolean = false,
  isHost: boolean = false,
  lobbyCode?: string,
  gameSettings?: {
    enemyCount: number;
    enemySpeed: number;
    enemyDamage: number;
    gameMode?: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  }
) => {
  const gameDataRef = useRef<GameData>({
    player: { 
      id: Math.random().toString(36).substring(2, 10),
      x: window.innerWidth / 2, 
      y: window.innerHeight / 2, 
      size: 20,
      health: 100,
      maxHealth: 100,
      isAlive: true,
      kills: 0
    },
    otherPlayers: [],
    enemies: [],
    bullets: [],
    keys: {},
    mouse: { x: 0, y: 0 },
    lastShot: 0,
    lastEnemySpawn: 0,
    lastBossSpawn: 0,
    gameStartTime: Date.now(),
    isHost: isHost,
    lastSyncTime: 0,
    multiplayerChannel: null,
    gameMode: gameSettings?.gameMode || 'survival',
    playerId: ''
  });
  gameDataRef.current.playerId = gameDataRef.current.player.id;

  const animationRef = useRef<number>();
  const channelRef = useRef<any>(null);

  const hostSetGameState = useCallback((updater: React.SetStateAction<GameState>) => {
    setGameState(currentState => {
        const newState = typeof updater === 'function' ? updater(currentState) : updater;
        const channel = gameDataRef.current.multiplayerChannel;
        if (channel && isHost && JSON.stringify(currentState) !== JSON.stringify(newState)) {
            try {
                channel.send({ type: 'broadcast', event: 'game-state-update', payload: { newState } });
            } catch (e) {
                console.error("Broadcast game-state-update failed", e);
            }
        }
        return newState;
    });
  }, [setGameState, isHost]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameData = gameDataRef.current;
    gameData.gameStartTime = gameState.gameStartTime;
    gameData.gameMode = gameSettings?.gameMode || 'survival';
    gameData.isHost = isHost;
    
    // Player setup
    if (gameSettings?.gameMode === 'team-vs-team') {
      gameData.player.team = Math.random() < 0.5 ? 'red' : 'blue';
    } else if (gameSettings?.gameMode === 'team-vs-enemies') {
      gameData.player.team = 'blue';
    }

    // Multiplayer setup
    if (isMultiplayer && lobbyCode && !channelRef.current) {
      const channel = supabase.channel(`game-lobby-${lobbyCode}`);
      channelRef.current = channel;
      gameData.multiplayerChannel = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          gameData.otherPlayers = Object.values(state)
            .flat()
            .filter((p: any) => p.user_id !== gameData.playerId)
            .map((p: any) => ({
              id: p.user_id, x: p.x, y: p.y, size: 20, team: p.team,
              health: 100, maxHealth: 100, isAlive: true, kills: 0
            }));
        })
        .on('broadcast', { event: 'bullet-fired' }, ({ payload }) => {
          if (payload.bullet.playerId !== gameData.playerId) gameData.bullets.push(payload.bullet);
        })
        .on('broadcast', { event: 'full-state-sync' }, ({ payload }) => {
          if (!isHost) {
            gameData.enemies = payload.enemies;
            const myState = payload.players.find(p => p.id === gameData.playerId);
            if (myState) {
              gameData.player.health = myState.health;
              gameData.player.isAlive = myState.isAlive;
            }
            gameData.otherPlayers.forEach(op => {
              const opState = payload.players.find(p => p.id === op.id);
              if (opState) {
                op.health = opState.health;
                op.isAlive = opState.isAlive;
              }
            });
          }
        })
        .on('broadcast', { event: 'game-state-update' }, ({ payload }) => {
          if (!isHost) setGameState(payload.newState);
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            channel.track({
              user_id: gameData.playerId,
              x: gameData.player.x, y: gameData.player.y,
              team: gameData.player.team
            });
          }
        });
    }

    const handleKeyDown = (e: KeyboardEvent) => { gameData.keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameData.keys[e.key.toLowerCase()] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      gameData.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseClick = () => {
      const newBullets = shoot(gameData, gameState);
      if (isMultiplayer && newBullets.length > 0) {
        newBullets.forEach(bullet => {
          try {
            gameData.multiplayerChannel?.send({ type: 'broadcast', event: 'bullet-fired', payload: { bullet } });
          } catch (error) { console.warn('Failed to broadcast bullet:', error); }
        });
      }
    };
    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleMouseClick);
    window.addEventListener('resize', handleResize);
    handleResize();

    const gameLoop = () => {
      updatePlayer(gameData, canvas);
      updateBullets(gameData, canvas);

      if (isHost) {
        const effectiveSetState = isMultiplayer ? hostSetGameState : setGameState;
        updateEnemies(gameData);
        checkBulletEnemyCollisions(gameData, effectiveSetState);
        checkPlayerEnemyCollisions(gameData, effectiveSetState);
        if (gameData.gameMode === 'team-vs-team') {
            checkPlayerBulletCollisions(gameData, effectiveSetState);
        }
        if (gameData.gameMode !== 'team-vs-team') {
          spawnEnemy(gameData, canvas, effectiveSetState, gameSettings);
          spawnBoss(gameData, canvas, effectiveSetState);
        }
      }

      if (!isMultiplayer || isHost) {
        const newTime = Math.max(0, gameState.timeLeft - 1 / 60);
        if (newTime <= 0) {
          onGameEnd(Math.floor((Date.now() - gameData.gameStartTime) / 1000));
        } else if (newTime !== gameState.timeLeft) {
          hostSetGameState(prev => ({ ...prev, timeLeft: newTime }));
        }
      }

      if (isMultiplayer) {
        gameData.multiplayerChannel.track({
          user_id: gameData.playerId,
          x: gameData.player.x, y: gameData.player.y,
          team: gameData.player.team
        });

        if (isHost && Date.now() - gameData.lastSyncTime > 100) { // Sync 10 times/sec
          gameData.lastSyncTime = Date.now();
          const allPlayersState = [gameData.player, ...gameData.otherPlayers].map(p => ({
            id: p.id, health: p.health, isAlive: p.isAlive
          }));
          try {
            gameData.multiplayerChannel.send({
              type: 'broadcast',
              event: 'full-state-sync',
              payload: { enemies: gameData.enemies, players: allPlayersState }
            });
          } catch (e) { console.warn('State sync failed:', e); }
        }
      }

      renderGame(canvas, gameData);
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleMouseClick);
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [isMultiplayer, isHost, lobbyCode, gameSettings, onGameEnd, setGameState, hostSetGameState]);

  return null;
};

export default useGameLoop;

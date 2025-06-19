import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameData, GameState } from '@/types/game';
import { renderGame } from '@/utils/gameRenderer';
import { updatePlayer, updateBullets, updateEnemies, checkBulletEnemyCollisions, checkPlayerEnemyCollisions } from '@/utils/gameLogic';
import { spawnEnemy, spawnBoss } from '@/utils/enemySpawner';
import { shoot } from '@/utils/shooting';

const useGameLoop = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onGameEnd: (score: number) => void,
  isMultiplayer: boolean = false,
  lobbyCode?: string,
  gameSettings?: {
    enemyCount: number;
    enemySpeed: number;
    enemyDamage: number;
    gameMode?: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  }
) => {
  const gameDataRef = useRef<GameData>({
    player: { x: window.innerWidth / 2, y: window.innerHeight / 2, size: 20 },
    enemies: [],
    bullets: [],
    keys: {},
    mouse: { x: 0, y: 0 },
    lastShot: 0,
    lastEnemySpawn: 0,
    lastBossSpawn: 0,
    gameStartTime: Date.now(),
    multiplayerChannel: null
  });

  const animationRef = useRef<number>();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameDataRef.current.gameStartTime = gameState.gameStartTime;
    gameDataRef.current.player.x = window.innerWidth / 2;
    gameDataRef.current.player.y = window.innerHeight / 2;

    // Setup multiplayer if needed
    if (isMultiplayer && lobbyCode && !channelRef.current) {
      const channelName = `game-lobby-${lobbyCode}`;
      
      // Remove any existing channel first
      if (gameDataRef.current.multiplayerChannel) {
        supabase.removeChannel(gameDataRef.current.multiplayerChannel);
        gameDataRef.current.multiplayerChannel = null;
      }

      // Create new channel
      const channel = supabase.channel(channelName);
      
      // Configure the channel before subscribing
      channel
        .on('presence', { event: 'sync' }, () => {
          // Handle player sync
          console.log('Players synced');
        })
        .on('broadcast', { event: 'player-update' }, (payload) => {
          // Handle other players' positions
          console.log('Player update received:', payload);
        });

      // Subscribe to the channel
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to multiplayer channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to multiplayer channel');
        }
      });

      channelRef.current = channel;
      gameDataRef.current.multiplayerChannel = channel;
    }

    // Event handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      gameDataRef.current.keys[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameDataRef.current.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      gameDataRef.current.mouse.x = e.clientX - rect.left;
      gameDataRef.current.mouse.y = e.clientY - rect.top;
    };

    const handleMouseClick = () => {
      shoot(gameDataRef.current, gameState);
    };

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleMouseClick);
    window.addEventListener('resize', handleResize);

    // Initial resize
    handleResize();

    const updateGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gameData = gameDataRef.current;
      
      updatePlayer(gameData, canvas);
      updateBullets(gameData, canvas);
      updateEnemies(gameData);
      checkBulletEnemyCollisions(gameData, setGameState);
      checkPlayerEnemyCollisions(gameData, setGameState);
      spawnEnemy(gameData, canvas, setGameState, gameSettings);
      spawnBoss(gameData, canvas, setGameState);

      // Update timer
      setGameState(prev => {
        const newTime = Math.max(0, prev.timeLeft - 1/60);
        if (newTime <= 0) {
          const survivalTime = Math.floor((Date.now() - gameDataRef.current.gameStartTime) / 1000);
          onGameEnd(survivalTime);
        }
        return { ...prev, timeLeft: newTime };
      });

      // Broadcast position in multiplayer (throttled)
      if (isMultiplayer && gameDataRef.current.multiplayerChannel && Math.random() < 0.1) {
        try {
          gameDataRef.current.multiplayerChannel.send({
            type: 'broadcast',
            event: 'player-update',
            payload: {
              position: { x: gameData.player.x, y: gameData.player.y },
              stats: gameState
            }
          });
        } catch (error) {
          console.warn('Failed to broadcast player update:', error);
        }
      }
    };

    const gameLoop = () => {
      updateGame();
      renderGame(canvasRef.current!, gameDataRef.current);
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      // Cleanup
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleMouseClick);
      window.removeEventListener('resize', handleResize);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.gunLevel, gameState.fireRateLevel, gameState.bulletSizeLevel, onGameEnd, setGameState, gameState.gameStartTime, gameSettings]);

  // Separate effect for multiplayer cleanup
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        gameDataRef.current.multiplayerChannel = null;
      }
    };
  }, [isMultiplayer, lobbyCode]);

  return null;
};

export default useGameLoop;
import { useEffect, useRef } from 'react';
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
    multiplayerChannel: null,
    gameMode: gameSettings?.gameMode || 'survival',
    playerId: Math.random().toString(36).substring(2, 10)
  });

  const animationRef = useRef<number>();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameDataRef.current.gameStartTime = gameState.gameStartTime;
    gameDataRef.current.gameMode = gameSettings?.gameMode || 'survival';
    
    // Initialize player based on game mode
    if (gameSettings?.gameMode === 'team-vs-team') {
      // Assign random team
      gameDataRef.current.player.team = Math.random() < 0.5 ? 'red' : 'blue';
      gameDataRef.current.player.health = 100;
      gameDataRef.current.player.maxHealth = 100;
      
      // Initialize team scores
      setGameState(prev => ({
        ...prev,
        teamScores: { red: 0, blue: 0 }
      }));
    } else if (gameSettings?.gameMode === 'team-vs-enemies') {
      gameDataRef.current.player.team = 'blue'; // All players on same team vs enemies
      gameDataRef.current.player.health = 100;
      gameDataRef.current.player.maxHealth = 100;
      
      setGameState(prev => ({
        ...prev,
        teamScores: { red: 0, blue: 0 }
      }));
    }

    gameDataRef.current.player.x = window.innerWidth / 2;
    gameDataRef.current.player.y = window.innerHeight / 2;
    gameDataRef.current.player.id = gameDataRef.current.playerId;

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
          const state = channel.presenceState();
          const players = Object.values(state).flat();
          
          // Update other players list
          gameDataRef.current.otherPlayers = players
            .filter((p: any) => p.user_id !== gameDataRef.current.playerId)
            .map((p: any) => ({
              id: p.user_id,
              x: p.x || window.innerWidth / 2,
              y: p.y || window.innerHeight / 2,
              size: 20,
              team: p.team,
              health: p.health || 100,
              maxHealth: 100,
              isAlive: p.isAlive !== false,
              kills: p.kills || 0
            }));
        })
        .on('broadcast', { event: 'player-update' }, (payload) => {
          const { playerId, position, health, isAlive, team } = payload.payload;
          
          // Update other player's position and status
          const playerIndex = gameDataRef.current.otherPlayers.findIndex(p => p.id === playerId);
          if (playerIndex >= 0) {
            gameDataRef.current.otherPlayers[playerIndex] = {
              ...gameDataRef.current.otherPlayers[playerIndex],
              x: position.x,
              y: position.y,
              health,
              isAlive,
              team
            };
          } else if (playerId !== gameDataRef.current.playerId) {
            // Add new player
            gameDataRef.current.otherPlayers.push({
              id: playerId,
              x: position.x,
              y: position.y,
              size: 20,
              team,
              health: health || 100,
              maxHealth: 100,
              isAlive: isAlive !== false,
              kills: 0
            });
          }
        })
        .on('broadcast', { event: 'bullet-fired' }, (payload) => {
          const { bullet } = payload.payload;
          if (bullet.playerId !== gameDataRef.current.playerId) {
            gameDataRef.current.bullets.push(bullet);
          }
        });

      // Subscribe to the channel
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to multiplayer channel');
          // Track presence
          channel.track({
            user_id: gameDataRef.current.playerId,
            x: gameDataRef.current.player.x,
            y: gameDataRef.current.player.y,
            team: gameDataRef.current.player.team,
            health: gameDataRef.current.player.health,
            isAlive: gameDataRef.current.player.isAlive
          });
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
      const bulletsBefore = gameDataRef.current.bullets.length;
      shoot(gameDataRef.current, gameState);
      const bulletsAfter = gameDataRef.current.bullets.length;
      
      // Broadcast new bullets in multiplayer
      if (isMultiplayer && gameDataRef.current.multiplayerChannel && bulletsAfter > bulletsBefore) {
        const newBullets = gameDataRef.current.bullets.slice(bulletsBefore);
        newBullets.forEach(bullet => {
          try {
            gameDataRef.current.multiplayerChannel.send({
              type: 'broadcast',
              event: 'bullet-fired',
              payload: { bullet }
            });
          } catch (error) {
            console.warn('Failed to broadcast bullet:', error);
          }
        });
      }
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
      
      // Check player vs player collisions in team vs team mode
      if (gameData.gameMode === 'team-vs-team') {
        checkPlayerBulletCollisions(gameData, setGameState);
      }
      
      // Only spawn enemies in survival and team-vs-enemies modes
      if (gameData.gameMode !== 'team-vs-team') {
        spawnEnemy(gameData, canvas, setGameState, gameSettings);
        spawnBoss(gameData, canvas, setGameState);
      }

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
          gameDataRef.current.multiplayerChannel.track({
            user_id: gameDataRef.current.playerId,
            x: gameData.player.x,
            y: gameData.player.y,
            team: gameData.player.team,
            health: gameData.player.health,
            isAlive: gameData.player.isAlive
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
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  x: number;
  y: number;
  size: number;
}

interface Enemy {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  darkness: number;
  hp: number;
  isBoss: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

interface GameState {
  timeLeft: number;
  gunLevel: number;
  fireRateLevel: number;
  bulletSizeLevel: number;
  enemiesKilled: number;
  bossActive: boolean;
  gameStartTime: number;
  wave: number;
}

const useGameLoop = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onGameEnd: (score: number) => void,
  isMultiplayer: boolean = false,
  lobbyCode?: string
) => {
  const gameDataRef = useRef({
    player: { x: 640, y: 360, size: 20 } as Player,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    keys: {} as Record<string, boolean>,
    mouse: { x: 0, y: 0 },
    lastShot: 0,
    lastEnemySpawn: 0,
    lastBossSpawn: 0,
    gameStartTime: Date.now(),
    multiplayerChannel: null as any
  });

  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameDataRef.current.gameStartTime = gameState.gameStartTime;

    // Setup multiplayer if needed
    if (isMultiplayer && lobbyCode) {
      const channel = supabase.channel(`game-lobby-${lobbyCode}`)
        .on('presence', { event: 'sync' }, () => {
          // Handle player sync
        })
        .on('broadcast', { event: 'player-update' }, (payload) => {
          // Handle other players' positions
        })
        .subscribe();
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
      const rect = canvas.getBoundingClientRect();
      gameDataRef.current.mouse.x = e.clientX - rect.left;
      gameDataRef.current.mouse.y = e.clientY - rect.top;
    };

    const handleMouseClick = () => {
      shoot();
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleMouseClick);

    const drawHumanSilhouette = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, isPlayer = false) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = isPlayer ? '#00ff00' : color;
      ctx.lineWidth = isPlayer ? 3 : 1;
      
      const scale = size / 25;
      
      // Head
      ctx.beginPath();
      ctx.arc(x, y - 12 * scale, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      if (isPlayer) ctx.stroke();
      
      // Body (torso)
      ctx.beginPath();
      ctx.rect(x - 4 * scale, y - 6 * scale, 8 * scale, 15 * scale);
      ctx.fill();
      if (isPlayer) ctx.stroke();
      
      // Arms
      ctx.beginPath();
      ctx.rect(x - 12 * scale, y - 3 * scale, 6 * scale, 12 * scale);
      ctx.rect(x + 6 * scale, y - 3 * scale, 6 * scale, 12 * scale);
      ctx.fill();
      if (isPlayer) ctx.stroke();
      
      // Legs
      ctx.beginPath();
      ctx.rect(x - 3 * scale, y + 9 * scale, 5 * scale, 12 * scale);
      ctx.rect(x - 2 * scale, y + 9 * scale, 5 * scale, 12 * scale);
      ctx.fill();
      if (isPlayer) ctx.stroke();
    };

    const shoot = () => {
      const now = Date.now();
      const fireRateDelays = [400, 250, 150];
      const shootDelay = fireRateDelays[gameState.fireRateLevel - 1] || 150;
      
      if (now - gameDataRef.current.lastShot < shootDelay) return;
      
      const player = gameDataRef.current.player;
      const mouse = gameDataRef.current.mouse;
      
      const dx = mouse.x - player.x;
      const dy = mouse.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const speed = 15;
      const vx = (dx / distance) * speed;
      const vy = (dy / distance) * speed;

      const bulletSizes = [6, 10, 16];
      const bulletSize = bulletSizes[gameState.bulletSizeLevel - 1] || 6;

      const bulletConfigs = [
        { count: 1, spread: 0, color: '#ffff00' },
        { count: 5, spread: 0.6, color: '#ff4400' },
        { count: 3, spread: 0.3, color: '#00ff44' }
      ];

      const config = bulletConfigs[gameState.gunLevel - 1];
      
      for (let i = 0; i < config.count; i++) {
        let angle = Math.atan2(vy, vx);
        if (config.count > 1) {
          const offset = (i - (config.count - 1) / 2) * config.spread;
          angle += offset;
        }
        
        gameDataRef.current.bullets.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: bulletSize,
          color: config.color
        });
      }
      
      gameDataRef.current.lastShot = now;
    };

    const spawnEnemy = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const now = Date.now();
      const timeSinceStart = (now - gameDataRef.current.gameStartTime) / 1000;
      const wave = Math.floor(timeSinceStart / 30) + 1;
      
      // Update wave
      setGameState(prev => ({ ...prev, wave }));
      
      // Wave-based spawn rate
      const baseSpawnRate = 800;
      const waveMultiplier = Math.max(0.3, 1 - (wave - 1) * 0.1);
      const spawnRate = baseSpawnRate * waveMultiplier;
      
      if (now - gameDataRef.current.lastEnemySpawn < spawnRate) return;

      // Spawn from edges
      const side = Math.floor(Math.random() * 4);
      let x, y;
      
      switch (side) {
        case 0: x = Math.random() * canvas.width; y = -40; break;
        case 1: x = canvas.width + 40; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + 40; break;
        default: x = -40; y = Math.random() * canvas.height;
      }

      const darkness = Math.random();
      gameDataRef.current.enemies.push({
        x,
        y,
        size: 30, // Bigger enemies
        vx: 0,
        vy: 0,
        darkness,
        hp: Math.floor(darkness * 2) + 1,
        isBoss: false
      });

      gameDataRef.current.lastEnemySpawn = now;
    };

    const spawnBoss = () => {
      const now = Date.now();
      const timeSinceLastBoss = (now - gameDataRef.current.lastBossSpawn) / 1000;
      
      if (timeSinceLastBoss >= 90) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        gameDataRef.current.enemies.push({
          x: canvas.width / 2,
          y: -80,
          size: 80,
          vx: 0,
          vy: 1.2,
          darkness: 1,
          hp: 20,
          isBoss: true
        });

        setGameState(prev => ({ ...prev, bossActive: true }));
        gameDataRef.current.lastBossSpawn = now;
      }
    };

    const updateGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gameData = gameDataRef.current;
      
      // Update player position
      const speed = 8;
      if (gameData.keys['w']) gameData.player.y = Math.max(gameData.player.size, gameData.player.y - speed);
      if (gameData.keys['s']) gameData.player.y = Math.min(canvas.height - gameData.player.size, gameData.player.y + speed);
      if (gameData.keys['a']) gameData.player.x = Math.max(gameData.player.size, gameData.player.x - speed);
      if (gameData.keys['d']) gameData.player.x = Math.min(canvas.width - gameData.player.size, gameData.player.x + speed);

      // Update bullets
      gameData.bullets = gameData.bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.x > -20 && bullet.x < canvas.width + 20 && bullet.y > -20 && bullet.y < canvas.height + 20;
      });

      // Update enemies with improved AI
      gameData.enemies.forEach((enemy, index) => {
        const dx = gameData.player.x - enemy.x;
        const dy = gameData.player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        let speed = enemy.isBoss ? 1.5 : 0.8; // Slower enemies
        
        // Only chase if close enough (unless boss)
        if (enemy.isBoss || distance < 150) {
          if (distance > 0) {
            enemy.vx = (dx / distance) * speed;
            enemy.vy = (dy / distance) * speed;
          }
        } else {
          // Random movement when not chasing
          enemy.vx += (Math.random() - 0.5) * 0.2;
          enemy.vy += (Math.random() - 0.5) * 0.2;
          enemy.vx = Math.max(-speed, Math.min(speed, enemy.vx));
          enemy.vy = Math.max(-speed, Math.min(speed, enemy.vy));
        }
        
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Enemy collision with other enemies
        gameData.enemies.forEach((otherEnemy, otherIndex) => {
          if (index !== otherIndex) {
            const dx2 = enemy.x - otherEnemy.x;
            const dy2 = enemy.y - otherEnemy.y;
            const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            if (dist < enemy.size + otherEnemy.size && dist > 0) {
              const pushForce = 2;
              enemy.x += (dx2 / dist) * pushForce;
              enemy.y += (dy2 / dist) * pushForce;
            }
          }
        });
      });

      // Check bullet-enemy collisions
      gameData.bullets = gameData.bullets.filter(bullet => {
        let hit = false;
        gameData.enemies = gameData.enemies.filter(enemy => {
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < bullet.size + enemy.size) {
            enemy.hp--;
            hit = true;
            
            if (enemy.hp <= 0) {
              const timeReward = enemy.isBoss ? 45 : Math.floor(enemy.darkness * 15) + 2;
              setGameState(prev => ({ 
                ...prev, 
                timeLeft: prev.timeLeft + timeReward,
                enemiesKilled: prev.enemiesKilled + 1,
                bossActive: enemy.isBoss ? false : prev.bossActive
              }));
              return false;
            }
          }
          return true;
        });
        return !hit;
      });

      // Check player-enemy collisions
      for (const enemy of gameData.enemies) {
        const dx = gameData.player.x - enemy.x;
        const dy = gameData.player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < gameData.player.size + enemy.size) {
          setGameState(prev => ({ ...prev, timeLeft: Math.max(0, prev.timeLeft - 8) }));
          gameData.enemies = gameData.enemies.filter(e => e !== enemy);
          break;
        }
      }

      spawnEnemy();
      spawnBoss();

      // Update timer
      setGameState(prev => {
        const newTime = Math.max(0, prev.timeLeft - 1/60);
        if (newTime <= 0) {
          const survivalTime = Math.floor((Date.now() - gameDataRef.current.gameStartTime) / 1000);
          onGameEnd(survivalTime);
        }
        return { ...prev, timeLeft: newTime };
      });

      // Broadcast position in multiplayer
      if (isMultiplayer && gameDataRef.current.multiplayerChannel) {
        gameDataRef.current.multiplayerChannel.send({
          type: 'broadcast',
          event: 'player-update',
          payload: {
            position: { x: gameData.player.x, y: gameData.player.y },
            stats: gameState
          }
        });
      }
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Enhanced background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0f0f23');
      gradient.addColorStop(0.5, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid pattern
      ctx.strokeStyle = '#2a2a4a';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 60) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      const gameData = gameDataRef.current;

      // Draw player
      drawHumanSilhouette(ctx, gameData.player.x, gameData.player.y, gameData.player.size, '#00ff00', true);

      // Draw enemies
      gameData.enemies.forEach(enemy => {
        const grayValue = Math.floor((1 - enemy.darkness) * 255);
        const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        drawHumanSilhouette(ctx, enemy.x, enemy.y, enemy.size, color);
        
        if (enemy.isBoss) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 25;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.size + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // Draw bullets with enhanced effects
      gameData.bullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Enhanced crosshair
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(gameData.mouse.x - 20, gameData.mouse.y);
      ctx.lineTo(gameData.mouse.x + 20, gameData.mouse.y);
      ctx.moveTo(gameData.mouse.x, gameData.mouse.y - 20);
      ctx.lineTo(gameData.mouse.x, gameData.mouse.y + 20);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const gameLoop = () => {
      updateGame();
      render();
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      // Cleanup multiplayer channel
      if (gameDataRef.current.multiplayerChannel) {
        supabase.removeChannel(gameDataRef.current.multiplayerChannel);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.gunLevel, gameState.fireRateLevel, gameState.bulletSizeLevel, onGameEnd, setGameState, gameState.gameStartTime, isMultiplayer, lobbyCode]);

  return null;
};

export default useGameLoop;

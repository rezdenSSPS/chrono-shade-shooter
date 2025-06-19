
import { useEffect, useRef } from 'react';

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
  enemiesKilled: number;
  bossActive: boolean;
  gameStartTime: number;
}

const useGameLoop = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onGameEnd: (score: number) => void
) => {
  const gameDataRef = useRef({
    player: { x: 400, y: 300, size: 15 } as Player,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    keys: {} as Record<string, boolean>,
    mouse: { x: 0, y: 0 },
    lastShot: 0,
    lastEnemySpawn: 0,
    lastBossSpawn: 0,
    gameStartTime: Date.now()
  });

  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameDataRef.current.gameStartTime = gameState.gameStartTime;

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
      ctx.lineWidth = isPlayer ? 2 : 1;
      
      // Scale factor
      const scale = size / 20;
      
      // Head
      ctx.beginPath();
      ctx.arc(x, y - 8 * scale, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      if (isPlayer) ctx.stroke();
      
      // Body
      ctx.beginPath();
      ctx.rect(x - 3 * scale, y - 4 * scale, 6 * scale, 10 * scale);
      ctx.fill();
      if (isPlayer) ctx.stroke();
      
      // Arms
      ctx.beginPath();
      ctx.rect(x - 8 * scale, y - 2 * scale, 4 * scale, 8 * scale);
      ctx.rect(x + 4 * scale, y - 2 * scale, 4 * scale, 8 * scale);
      ctx.fill();
      if (isPlayer) ctx.stroke();
      
      // Legs
      ctx.beginPath();
      ctx.rect(x - 2 * scale, y + 6 * scale, 3 * scale, 8 * scale);
      ctx.rect(x - 1 * scale, y + 6 * scale, 3 * scale, 8 * scale);
      ctx.fill();
      if (isPlayer) ctx.stroke();
    };

    const shoot = () => {
      const now = Date.now();
      const shootDelays = [300, 200, 150, 100, 50]; // Different delays for each gun level
      const shootDelay = shootDelays[gameState.gunLevel - 1] || 50;
      
      if (now - gameDataRef.current.lastShot < shootDelay) return;
      
      const player = gameDataRef.current.player;
      const mouse = gameDataRef.current.mouse;
      
      const dx = mouse.x - player.x;
      const dy = mouse.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const speed = 12;
      const vx = (dx / distance) * speed;
      const vy = (dy / distance) * speed;

      // Different bullet colors and patterns for each gun level
      const bulletConfigs = [
        { count: 1, spread: 0, color: '#ffff00', size: 4 }, // Level 1: Single yellow
        { count: 2, spread: 0.3, color: '#ff8800', size: 4 }, // Level 2: Dual orange
        { count: 5, spread: 0.8, color: '#ff0088', size: 5 }, // Level 3: Shotgun pink
        { count: 3, spread: 0.4, color: '#00ff88', size: 6 }, // Level 4: Triple green
        { count: 1, spread: 0, color: '#8800ff', size: 8 }, // Level 5: Plasma purple
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
          size: config.size,
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
      const spawnRate = Math.max(400 - timeSinceStart * 8, 150);
      
      if (now - gameDataRef.current.lastEnemySpawn < spawnRate) return;

      // Spawn from edges
      const side = Math.floor(Math.random() * 4);
      let x, y;
      
      switch (side) {
        case 0: // top
          x = Math.random() * canvas.width;
          y = -30;
          break;
        case 1: // right
          x = canvas.width + 30;
          y = Math.random() * canvas.height;
          break;
        case 2: // bottom
          x = Math.random() * canvas.width;
          y = canvas.height + 30;
          break;
        default: // left
          x = -30;
          y = Math.random() * canvas.height;
      }

      const darkness = Math.random();
      gameDataRef.current.enemies.push({
        x,
        y,
        size: 18,
        vx: 0,
        vy: 0,
        darkness,
        hp: Math.floor(darkness * 3) + 1,
        isBoss: false
      });

      gameDataRef.current.lastEnemySpawn = now;
    };

    const spawnBoss = () => {
      const now = Date.now();
      const timeSinceLastBoss = (now - gameDataRef.current.lastBossSpawn) / 1000;
      
      if (timeSinceLastBoss >= 60) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        gameDataRef.current.enemies.push({
          x: canvas.width / 2,
          y: -60,
          size: 50,
          vx: 0,
          vy: 1,
          darkness: 1,
          hp: 15,
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
      const speed = 6;
      if (gameData.keys['w']) gameData.player.y = Math.max(gameData.player.size, gameData.player.y - speed);
      if (gameData.keys['s']) gameData.player.y = Math.min(canvas.height - gameData.player.size, gameData.player.y + speed);
      if (gameData.keys['a']) gameData.player.x = Math.max(gameData.player.size, gameData.player.x - speed);
      if (gameData.keys['d']) gameData.player.x = Math.min(canvas.width - gameData.player.size, gameData.player.x + speed);

      // Update bullets
      gameData.bullets = gameData.bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.x > -10 && bullet.x < canvas.width + 10 && bullet.y > -10 && bullet.y < canvas.height + 10;
      });

      // Update enemies
      gameData.enemies.forEach(enemy => {
        const dx = gameData.player.x - enemy.x;
        const dy = gameData.player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = enemy.isBoss ? 0.8 : 1.5 + enemy.darkness * 0.5;
        if (distance > 0) {
          enemy.vx = (dx / distance) * speed;
          enemy.vy = (dy / distance) * speed;
        }
        
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
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

      // Update timer (whole seconds)
      setGameState(prev => {
        const newTime = Math.max(0, prev.timeLeft - 1/60);
        if (newTime <= 0) {
          const survivalTime = Math.floor((Date.now() - gameDataRef.current.gameStartTime) / 1000);
          onGameEnd(survivalTime);
        }
        return { ...prev, timeLeft: newTime };
      });
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Enhanced background with gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.5, '#16213e');
      gradient.addColorStop(1, '#0f0f23');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add grid pattern
      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      const gameData = gameDataRef.current;

      // Draw player as human silhouette
      drawHumanSilhouette(ctx, gameData.player.x, gameData.player.y, gameData.player.size, '#00ff00', true);

      // Draw enemies as human silhouettes
      gameData.enemies.forEach(enemy => {
        const grayValue = Math.floor((1 - enemy.darkness) * 255);
        const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        drawHumanSilhouette(ctx, enemy.x, enemy.y, enemy.size, color);
        
        if (enemy.isBoss) {
          // Boss glow effect
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 20;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.size + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // Draw enhanced bullets
      gameData.bullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw enhanced crosshair
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(gameData.mouse.x - 15, gameData.mouse.y);
      ctx.lineTo(gameData.mouse.x + 15, gameData.mouse.y);
      ctx.moveTo(gameData.mouse.x, gameData.mouse.y - 15);
      ctx.lineTo(gameData.mouse.x, gameData.mouse.y + 15);
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
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleMouseClick);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.gunLevel, onGameEnd, setGameState, gameState.gameStartTime]);

  return null;
};

export default useGameLoop;

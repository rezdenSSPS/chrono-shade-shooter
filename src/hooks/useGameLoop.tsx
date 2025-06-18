
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
  darkness: number; // 0 = white, 1 = black
  hp: number;
  isBoss: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface GameState {
  timeLeft: number;
  gunLevel: number;
  enemiesKilled: number;
  bossActive: boolean;
}

const useGameLoop = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onGameEnd: (score: number) => void
) => {
  const gameDataRef = useRef({
    player: { x: 400, y: 300, size: 20 } as Player,
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

    const shoot = () => {
      const now = Date.now();
      const shootDelay = gameState.gunLevel === 3 ? 100 : 200;
      
      if (now - gameDataRef.current.lastShot < shootDelay) return;
      
      const player = gameDataRef.current.player;
      const mouse = gameDataRef.current.mouse;
      
      const dx = mouse.x - player.x;
      const dy = mouse.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const speed = 10;
      const vx = (dx / distance) * speed;
      const vy = (dy / distance) * speed;

      // Different shooting patterns based on gun level
      if (gameState.gunLevel === 1) {
        gameDataRef.current.bullets.push({
          x: player.x,
          y: player.y,
          vx,
          vy,
          size: 4
        });
      } else if (gameState.gunLevel === 2) {
        // Dual shot with spread
        const spreadAngle = 0.2;
        for (let i = -1; i <= 1; i += 2) {
          const angle = Math.atan2(vy, vx) + i * spreadAngle;
          gameDataRef.current.bullets.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 4
          });
        }
      } else if (gameState.gunLevel === 3) {
        // Triple shot
        const spreadAngle = 0.3;
        for (let i = -1; i <= 1; i++) {
          const angle = Math.atan2(vy, vx) + i * spreadAngle;
          gameDataRef.current.bullets.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 4
          });
        }
      }
      
      gameDataRef.current.lastShot = now;
    };

    const spawnEnemy = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const now = Date.now();
      const timeSinceStart = (now - gameDataRef.current.gameStartTime) / 1000;
      const spawnRate = Math.max(500 - timeSinceStart * 10, 200);
      
      if (now - gameDataRef.current.lastEnemySpawn < spawnRate) return;

      // Spawn from edges
      const side = Math.floor(Math.random() * 4);
      let x, y;
      
      switch (side) {
        case 0: // top
          x = Math.random() * canvas.width;
          y = -20;
          break;
        case 1: // right
          x = canvas.width + 20;
          y = Math.random() * canvas.height;
          break;
        case 2: // bottom
          x = Math.random() * canvas.width;
          y = canvas.height + 20;
          break;
        default: // left
          x = -20;
          y = Math.random() * canvas.height;
      }

      const darkness = Math.random();
      gameDataRef.current.enemies.push({
        x,
        y,
        size: 15,
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
          y: -50,
          size: 40,
          vx: 0,
          vy: 1,
          darkness: 1,
          hp: 10,
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
      const speed = 5;
      if (gameData.keys['w']) gameData.player.y = Math.max(gameData.player.size, gameData.player.y - speed);
      if (gameData.keys['s']) gameData.player.y = Math.min(canvas.height - gameData.player.size, gameData.player.y + speed);
      if (gameData.keys['a']) gameData.player.x = Math.max(gameData.player.size, gameData.player.x - speed);
      if (gameData.keys['d']) gameData.player.x = Math.min(canvas.width - gameData.player.size, gameData.player.x + speed);

      // Update bullets
      gameData.bullets = gameData.bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height;
      });

      // Update enemies
      gameData.enemies.forEach(enemy => {
        const dx = gameData.player.x - enemy.x;
        const dy = gameData.player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = enemy.isBoss ? 0.5 : 1 + enemy.darkness;
        enemy.vx = (dx / distance) * speed;
        enemy.vy = (dy / distance) * speed;
        
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
              // Enemy killed
              const timeReward = enemy.isBoss ? 30 : Math.floor(enemy.darkness * 10) + 1;
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
          setGameState(prev => ({ ...prev, timeLeft: Math.max(0, prev.timeLeft - 5) }));
          // Remove enemy on collision
          gameData.enemies = gameData.enemies.filter(e => e !== enemy);
          break;
        }
      }

      // Spawn enemies and bosses
      spawnEnemy();
      spawnBoss();

      // Update timer
      setGameState(prev => {
        const newTime = Math.max(0, prev.timeLeft - 1/60);
        if (newTime <= 0) {
          onGameEnd(Math.floor(prev.timeLeft));
        }
        return { ...prev, timeLeft: newTime };
      });
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gameData = gameDataRef.current;

      // Draw player
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(gameData.player.x, gameData.player.y, gameData.player.size, 0, Math.PI * 2);
      ctx.fill();

      // Draw enemies
      gameData.enemies.forEach(enemy => {
        const grayValue = Math.floor((1 - enemy.darkness) * 255);
        ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        if (enemy.isBoss) {
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });

      // Draw bullets
      ctx.fillStyle = '#ffff00';
      gameData.bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw crosshair
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gameData.mouse.x - 10, gameData.mouse.y);
      ctx.lineTo(gameData.mouse.x + 10, gameData.mouse.y);
      ctx.moveTo(gameData.mouse.x, gameData.mouse.y - 10);
      ctx.lineTo(gameData.mouse.x, gameData.mouse.y + 10);
      ctx.stroke();
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
  }, [gameState.gunLevel, onGameEnd, setGameState]);

  return null;
};

export default useGameLoop;

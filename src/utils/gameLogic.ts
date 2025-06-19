import { GameData, GameState } from '@/types/game';

export const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => {
  const speed = 5;
  const { keys, player } = gameData;
  
  if (keys['w'] || keys['arrowup']) player.y -= speed;
  if (keys['s'] || keys['arrowdown']) player.y += speed;
  if (keys['a'] || keys['arrowleft']) player.x -= speed;
  if (keys['d'] || keys['arrowright']) player.x += speed;
  
  // Keep player within bounds
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
};

export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  gameData.bullets = gameData.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    
    return bullet.x > 0 && bullet.x < canvas.width && 
           bullet.y > 0 && bullet.y < canvas.height;
  });
};

export const updateEnemies = (gameData: GameData) => {
  const player = gameData.player;
  
  gameData.enemies.forEach(enemy => {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (enemy.isBoss || distance < 200) {
      // Chase player if boss or player is close
      const speed = enemy.speed || 1;
      enemy.vx = (dx / distance) * speed;
      enemy.vy = (dy / distance) * speed;
    } else {
      // Random movement when player is far
      if (Math.random() < 0.02) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (enemy.speed || 1) * 0.5;
        enemy.vx = Math.cos(angle) * speed;
        enemy.vy = Math.sin(angle) * speed;
      }
    }
    
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;
  });

  // Enemy-to-enemy collisions
  for (let i = 0; i < gameData.enemies.length; i++) {
    for (let j = i + 1; j < gameData.enemies.length; j++) {
      const enemy1 = gameData.enemies[i];
      const enemy2 = gameData.enemies[j];
      
      const dx = enemy2.x - enemy1.x;
      const dy = enemy2.y - enemy1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = (enemy1.size + enemy2.size) / 2;
      
      if (distance < minDistance && distance > 0) {
        // Bounce enemies apart
        const pushForce = 2;
        const pushX = (dx / distance) * pushForce;
        const pushY = (dy / distance) * pushForce;
        
        enemy1.vx -= pushX;
        enemy1.vy -= pushY;
        enemy2.vx += pushX;
        enemy2.vy += pushY;
      }
    }
  }
};

export const checkBulletEnemyCollisions = (
  gameData: GameData,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  gameData.bullets.forEach((bullet, bulletIndex) => {
    gameData.enemies.forEach((enemy, enemyIndex) => {
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < bullet.size + enemy.size / 2) {
        // Hit detected
        enemy.hp--;
        gameData.bullets.splice(bulletIndex, 1);
        
        if (enemy.hp <= 0) {
          // Enemy defeated
          const timeBonus = Math.floor(enemy.darkness * 10) + (enemy.isBoss ? 30 : 5);
          setGameState(prev => ({
            ...prev,
            timeLeft: prev.timeLeft + timeBonus,
            enemiesKilled: prev.enemiesKilled + 1,
            bossActive: enemy.isBoss ? false : prev.bossActive
          }));
          gameData.enemies.splice(enemyIndex, 1);
        }
      }
    });
  });
};

export const checkPlayerEnemyCollisions = (
  gameData: GameData,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  const player = gameData.player;
  
  gameData.enemies.forEach(enemy => {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < player.size + enemy.size / 2) {
      // Player hit - end game
      const survivalTime = Math.floor((Date.now() - gameData.gameStartTime) / 1000);
      setGameState(prev => ({ ...prev, timeLeft: 0 }));
    }
  });
};

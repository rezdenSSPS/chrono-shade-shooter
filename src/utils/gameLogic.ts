
import { GameData, GameState } from '@/types/game';

export const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => {
  const speed = 8;
  if (gameData.keys['w']) gameData.player.y = Math.max(gameData.player.size, gameData.player.y - speed);
  if (gameData.keys['s']) gameData.player.y = Math.min(canvas.height - gameData.player.size, gameData.player.y + speed);
  if (gameData.keys['a']) gameData.player.x = Math.max(gameData.player.size, gameData.player.x - speed);
  if (gameData.keys['d']) gameData.player.x = Math.min(canvas.width - gameData.player.size, gameData.player.x + speed);
};

export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  gameData.bullets = gameData.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    return bullet.x > -20 && bullet.x < canvas.width + 20 && bullet.y > -20 && bullet.y < canvas.height + 20;
  });
};

export const updateEnemies = (gameData: GameData) => {
  gameData.enemies.forEach((enemy, index) => {
    const dx = gameData.player.x - enemy.x;
    const dy = gameData.player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let speed = enemy.isBoss ? 1.5 : 0.8;
    
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
};

export const checkBulletEnemyCollisions = (
  gameData: GameData,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
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
};

export const checkPlayerEnemyCollisions = (
  gameData: GameData,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
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
};

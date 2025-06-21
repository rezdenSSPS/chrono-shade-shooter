// src/utils/gameLogic.ts

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameUIState, Bullet, Enemy, Player, GameSettings } from '@/types';

// Player Updates
export const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => {
  const { player, keys } = gameData;
  const speed = 5;
  if (keys['w'] || keys['arrowup']) player.y -= speed;
  if (keys['s'] || keys['arrowdown']) player.y += speed;
  if (keys['a'] || keys['arrowleft']) player.x -= speed;
  if (keys['d'] || keys['arrowright']) player.x += speed;

  // Clamp player position to canvas bounds
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
};

// Bullet Updates
export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  const now = Date.now();
  gameData.bullets = gameData.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    const isOutofBounds = bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height;
    const hasExpired = now - bullet.birthTime > 3000; // Bullets live for 3 seconds
    return !isOutofBounds && !hasExpired;
  });
};

// Enemy Updates
export const updateEnemies = (gameData: GameData) => {
  const { enemies, player } = gameData;
  enemies.forEach(enemy => {
    if (enemy.isBoss) {
      // Boss behavior (e.g., move towards player)
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * 0.5;
      enemy.y += Math.sin(angle) * 0.5;
    } else {
      // Regular enemy behavior
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;
      // Simple wall bouncing
      if (enemy.x < 0 || enemy.x > window.innerWidth) enemy.vx *= -1;
      if (enemy.y < 0 || enemy.y > window.innerHeight) enemy.vy *= -1;
    }
  });
};

// Shooting Logic
export const shoot = (gameData: GameData, gameState: GameUIState, channel?: RealtimeChannel, isMultiplayer?: boolean) => {
  const { player, bullets, mouse, lastShot } = gameData;
  const now = Date.now();
  const fireRate = 500 / (1 + (gameState.fireRateLevel - 1) * 0.4);

  if (now - lastShot < fireRate) return;

  gameData.lastShot = now;
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const bulletSpeed = 10;
  
  const bullet: Bullet = {
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * bulletSpeed,
    vy: Math.sin(angle) * bulletSpeed,
    size: 5 + (gameState.bulletSizeLevel - 1),
    damage: 10 + (gameState.gunLevel - 1) * 5,
    playerId: player.id,
    team: player.team, // CRITICAL: Assign team to bullet to prevent friendly fire issues
    birthTime: now,
  };

  bullets.push(bullet);

  if (isMultiplayer && channel) {
    channel.send({
      type: 'broadcast',
      event: 'bullet-fired',
      payload: { bullet },
    });
  }
};

// PvE Collision Checks
export const checkBulletEnemyCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>, allPlayers: Player[]) => {
    let totalTimeGained = 0;
    const { bullets, enemies } = gameData;
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            const bullet = bullets[i];
            const enemy = enemies[j];
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (dist < enemy.size + bullet.size) {
                enemy.health -= bullet.damage;
                bullets.splice(i, 1);

                if (enemy.health <= 0) {
                    const shooter = allPlayers.find(p => p.id === bullet.playerId);
                    if(shooter) shooter.kills += 1;
                    
                    const timeGained = enemy.isBoss ? 30 : Math.floor(enemy.colorValue / 25.5);
                    totalTimeGained += timeGained;
                    
                    setGameState(prev => ({ ...prev, enemiesKilled: prev.enemiesKilled + 1 }));
                    enemies.splice(j, 1);
                }
                break;
            }
        }
    }
    return totalTimeGained;
};

export const checkPlayerEnemyCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>, allPlayers: Player[]) => {
    const { enemies } = gameData;
    allPlayers.forEach(player => {
        if (!player.isAlive) return;

        for (const enemy of enemies) {
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (dist < player.size + enemy.size) {
                player.health -= enemy.isBoss ? 10 : 1;
                if (player.health <= 0) {
                    player.isAlive = false;
                }
            }
        }
    });
};

// Enemy Spawning
export const spawnEnemy = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>, gameSettings: GameSettings) => {
    const now = Date.now();
    if (now - gameData.lastEnemySpawn > 1000 && gameData.enemies.length < gameSettings.enemyCount) {
        gameData.lastEnemySpawn = now;
        const size = Math.random() * 15 + 10;
        const colorValue = Math.floor(Math.random() * 255);
        const enemy: Enemy = {
            id: Math.random().toString(36).substring(2, 10),
            x: Math.random() < 0.5 ? 0 - size : canvas.width + size,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size,
            health: 50,
            maxHealth: 50,
            isBoss: false,
            colorValue
        };
        gameData.enemies.push(enemy);
    }
};

export const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {
    // Implement boss spawning logic if needed, e.g., based on time or kills
};

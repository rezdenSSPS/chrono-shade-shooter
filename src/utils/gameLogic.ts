// src/utils/gameLogic.ts

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, Bullet, Player, GameSettings } from '@/types';

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
    // Regular enemy behavior: move and bounce
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;
    if (enemy.x < 0 || enemy.x > window.innerWidth) enemy.vx *= -1;
    if (enemy.y < 0 || enemy.y > window.innerHeight) enemy.vy *= -1;
  });
};

// Shooting Logic - now uses the shooter's individual stats
export const shoot = (gameData: GameData, shooter: Player, channel?: RealtimeChannel, isMultiplayer?: boolean) => {
  const { bullets, mouse, lastShot } = gameData;
  const now = Date.now();
  const fireRate = 500 / (1 + (shooter.fireRateLevel - 1) * 0.4);

  if (now - lastShot < fireRate) return;

  gameData.lastShot = now;
  const angle = Math.atan2(mouse.y - shooter.y, mouse.x - shooter.x);
  const bulletSpeed = 10;
  
  const bullet: Bullet = {
    x: shooter.x,
    y: shooter.y,
    vx: Math.cos(angle) * bulletSpeed,
    vy: Math.sin(angle) * bulletSpeed,
    size: 5 + (shooter.bulletSizeLevel - 1),
    damage: 10 + (shooter.gunLevel - 1) * 5,
    playerId: shooter.id,
    team: shooter.team,
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

// PvE/PvPvE Collision Checks
export const checkBulletEnemyCollisions = (gameData: GameData, allPlayers: Player[], isPvpMode: boolean) => {
    let killsToAdd: { [playerId: string]: number } = {};
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
                    if(shooter) {
                         if (isPvpMode) {
                            // In PvPvE, killing an enemy gives 1 kill point for upgrades
                            killsToAdd[shooter.id] = (killsToAdd[shooter.id] || 0) + 1;
                        } else {
                            shooter.kills++; // In PvE, just increment kills score
                            const timeGained = enemy.isBoss ? 30 : Math.floor(enemy.colorValue / 25.5);
                            totalTimeGained += timeGained;
                        }
                    }
                    enemies.splice(j, 1);
                }
                break;
            }
        }
    }
    // Apply the kills to the players for PvPvE mode
    for (const playerId in killsToAdd) {
        const player = allPlayers.find(p => p.id === playerId);
        if (player) {
            player.kills += killsToAdd[playerId];
        }
    }
    return totalTimeGained;
};

export const checkPlayerEnemyCollisions = (gameData: GameData, allPlayers: Player[]) => {
    const { enemies } = gameData;
    allPlayers.forEach(player => {
        if (!player.isAlive) return;

        for (const enemy of enemies) {
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (dist < player.size + enemy.size) {
                player.health -= enemy.isBoss ? 10 : 2; // Make them a bit more dangerous
                if (player.health <= 0) {
                    player.health = 0;
                    player.isAlive = false;
                }
            }
        }
    });
};

// Enemy Spawning
export const spawnEnemy = (gameData: GameData, canvas: HTMLCanvasElement, gameSettings: GameSettings) => {
    const now = Date.now();
    const spawnInterval = gameSettings.gameMode === 'team-vs-team' ? 2000 : 1000;
    if (now - gameData.lastEnemySpawn > spawnInterval && gameData.enemies.length < gameSettings.enemyCount) {
        gameData.lastEnemySpawn = now;
        const size = Math.random() * 15 + 10;
        const colorValue = Math.floor(Math.random() * 255);
        const enemy = {
            id: Math.random().toString(36).substring(2, 10),
            x: Math.random() < 0.5 ? 0 - size : canvas.width + size,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 4 * gameSettings.enemySpeed,
            vy: (Math.random() - 0.5) * 4 * gameSettings.enemySpeed,
            size,
            health: 50,
            maxHealth: 50,
            isBoss: false,
            colorValue
        };
        gameData.enemies.push(enemy);
    }
};

export const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement) => {
    // Implement boss spawning logic if needed
};

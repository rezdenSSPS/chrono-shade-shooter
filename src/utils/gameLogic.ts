import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameData, GameUIState, Enemy, Bullet, GameSettings } from "@/types";

export const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => {
  if (!gameData.player.isAlive) return;
  const speed = 5;
  if (gameData.keys['w']) gameData.player.y -= speed;
  if (gameData.keys['s']) gameData.player.y += speed;
  if (gameData.keys['a']) gameData.player.x -= speed;
  if (gameData.keys['d']) gameData.player.x += speed;
  gameData.player.x = Math.max(0, Math.min(canvas.width, gameData.player.x));
  gameData.player.y = Math.max(0, Math.min(canvas.height, gameData.player.y));
};

export const shoot = (gameData: GameData, gameState: GameUIState, channel?: RealtimeChannel) => {
    if (!gameData.player.isAlive) return;
    const fireRate = 250 - (gameState.fireRateLevel * 20);
    if (Date.now() - gameData.lastShot < fireRate) return;
    gameData.lastShot = Date.now();
    const angle = Math.atan2(gameData.mouse.y - gameData.player.y, gameData.mouse.x - gameData.player.x);
    const speed = 10;
    const newBullet: Bullet = {
        id: `${gameData.player.id}-${Date.now()}`, x: gameData.player.x, y: gameData.player.y,
        size: 5 + gameState.bulletSizeLevel, damage: 10 + (gameState.gunLevel * 5),
        playerId: gameData.player.id, team: gameData.player.team,
        color: gameData.player.team === 'red' ? '#ff8080' : '#80a0ff',
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    };
    gameData.bullets.push(newBullet);
    if (channel) channel.send({ type: 'broadcast', event: 'bullet-fired', payload: { bullet: newBullet } });
};

export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  for (let i = gameData.bullets.length - 1; i >= 0; i--) {
    const b = gameData.bullets[i];
    b.x += b.vx; b.y += b.vy;
    if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) gameData.bullets.splice(i, 1);
  }
};

export const updateEnemies = (gameData: GameData) => {
  const allPlayers = [gameData.player, ...gameData.otherPlayers].filter(p => p.isAlive);
  if (allPlayers.length === 0) return;
  gameData.enemies.forEach(enemy => {
    let closestPlayer = allPlayers[0]; let minDistance = Infinity;
    allPlayers.forEach(p => {
        const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if(dist < minDistance){ minDistance = dist; closestPlayer = p; }
    });
    if (closestPlayer) {
        const angle = Math.atan2(closestPlayer.y - enemy.y, closestPlayer.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed; enemy.y += Math.sin(angle) * enemy.speed;
    }
  });
};

export const spawnEnemy = (gameData: GameData, canvas: HTMLCanvasElement, gameSettings: GameSettings): Enemy | null => {
    const now = Date.now();
    if (now - gameData.lastEnemySpawn < (3000 / (gameSettings.enemyCount / 10))) return null;
    if (gameData.enemies.length >= gameSettings.enemyCount) return null;
    gameData.lastEnemySpawn = now;
    const side = Math.floor(Math.random() * 4); let x, y;
    if (side === 0) { x = 0; y = Math.random() * canvas.height; }
    else if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
    else if (side === 2) { x = Math.random() * canvas.width; y = 0; }
    else { x = Math.random() * canvas.width; y = canvas.height; }
    return {
        id: `enemy-${Date.now()}`, x, y, size: 25, speed: gameSettings.enemySpeed,
        health: 50, maxHealth: 50, isBoss: false, darkness: Math.random() * 0.6 + 0.2, isAlive: true
    };
};

export const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement) => {};

// --- Authoritative Collision Logic (Host only) ---
export const checkCollisions = (gameData: GameData, channel: RealtimeChannel) => {
    // Player-Bullet Collisions
    for (let i = gameData.bullets.length - 1; i >= 0; i--) {
        const bullet = gameData.bullets[i];
        const allPlayers = [gameData.player, ...gameData.otherPlayers];
        for (const player of allPlayers) {
            if (!player.isAlive || bullet.team === player.team || bullet.playerId === player.id) continue;
            const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
            if (dist < bullet.size + player.size) {
                const newHealth = Math.max(0, player.health - bullet.damage);
                channel.send({ type: 'broadcast', event: 'player-hit', payload: { playerId: player.id, newHealth } });
                gameData.bullets.splice(i, 1);
                break;
            }
        }
    }
    // Bullet-Enemy Collisions
    for (let i = gameData.bullets.length - 1; i >= 0; i--) {
        for (let j = gameData.enemies.length - 1; j >= 0; j--) {
            const bullet = gameData.bullets[i];
            const enemy = gameData.enemies[j];
            if (!bullet || !enemy) continue;
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (dist < bullet.size + enemy.size) {
                enemy.health -= bullet.damage;
                gameData.bullets.splice(i, 1);
                if (enemy.health <= 0) {
                    channel.send({ type: 'broadcast', event: 'enemy-killed', payload: { enemyId: enemy.id, killerId: bullet.playerId } });
                } else {
                    channel.send({ type: 'broadcast', event: 'enemy-hit', payload: { enemyId: enemy.id, newHealth: enemy.health } });
                }
                break;
            }
        }
    }
};

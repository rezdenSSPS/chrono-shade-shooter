import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameData, GameUIState, Enemy, Bullet, GameSettings, Player } from "@/types";

// Player Logic
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
        id: `${gameData.player.id}-${Date.now()}`,
        x: gameData.player.x, y: gameData.player.y,
        size: 5 + gameState.bulletSizeLevel,
        damage: 10 + (gameState.gunLevel * 5),
        playerId: gameData.player.id,
        team: gameData.player.team,
        color: gameData.player.team === 'red' ? '#ff8080' : '#8080ff',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
    };
    gameData.bullets.push(newBullet);
    if (channel) {
        channel.send({ type: 'broadcast', event: 'bullet-fired', payload: { bullet: newBullet } });
    }
};

// Bullet Logic
export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  for (let i = gameData.bullets.length - 1; i >= 0; i--) {
    const bullet = gameData.bullets[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
      gameData.bullets.splice(i, 1);
    }
  }
};

// Enemy Logic
export const updateEnemies = (gameData: GameData) => {
  const allPlayers = [gameData.player, ...gameData.otherPlayers].filter(p => p.isAlive);
  if (allPlayers.length === 0) return;
  gameData.enemies.forEach(enemy => {
    let closestPlayer = allPlayers[0];
    let minDistance = Infinity;
    allPlayers.forEach(p => {
        const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if(distance < minDistance){
            minDistance = distance;
            closestPlayer = p;
        }
    });
    if (closestPlayer) {
        const angle = Math.atan2(closestPlayer.y - enemy.y, closestPlayer.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed;
        enemy.y += Math.sin(angle) * enemy.speed;
    }
  });
};

export const spawnEnemy = (gameData: GameData, canvas: HTMLCanvasElement, gameSettings: GameSettings) => {
    const now = Date.now();
    if (now - gameData.lastEnemySpawn < (3000 / (gameSettings.enemyCount / 5))) return;
    if (gameData.enemies.length >= gameSettings.enemyCount) return;
    gameData.lastEnemySpawn = now;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = 0; y = Math.random() * canvas.height; }
    else if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
    else if (side === 2) { x = Math.random() * canvas.width; y = 0; }
    else { x = Math.random() * canvas.width; y = canvas.height; }
    const newEnemy: Enemy = {
        id: `enemy-${Date.now()}-${Math.random()}`, x, y, size: 20,
        health: 50, maxHealth: 50, speed: gameSettings.enemySpeed, isBoss: false,
        color: `hsl(0, 0%, ${Math.random() * 40}%)`
    };
    return newEnemy;
};

export const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {};

// Collision Logic
export const checkBulletEnemyCollisions = (gameData: GameData, channel?: RealtimeChannel) => {
    for (let i = gameData.bullets.length - 1; i >= 0; i--) {
        for (let j = gameData.enemies.length - 1; j >= 0; j--) {
            const bullet = gameData.bullets[i];
            const enemy = gameData.enemies[j];
            if (!bullet || !enemy) continue;
            const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (distance < bullet.size + enemy.size) {
                gameData.bullets.splice(i, 1);
                enemy.health -= bullet.damage;
                if (channel) {
                    channel.send({ type: 'broadcast', event: 'enemy-hit', payload: { enemyId: enemy.id, newHealth: enemy.health } });
                    if (enemy.health <= 0) {
                        channel.send({ type: 'broadcast', event: 'enemy-killed', payload: { enemyId: enemy.id, killerId: bullet.playerId } });
                    }
                }
                break;
            }
        }
    }
};

export const checkPlayerEnemyCollisions = (gameData: GameData, channel?: RealtimeChannel) => {
    const allPlayers = [gameData.player, ...gameData.otherPlayers];
    for (const player of allPlayers) {
        if(!player.isAlive) continue;
        for (let i = gameData.enemies.length - 1; i >= 0; i--) {
            const enemy = gameData.enemies[i];
            const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (distance < player.size + enemy.size) {
                const newHealth = Math.max(0, player.health - 20);
                if (channel) {
                     channel.send({ type: 'broadcast', event: 'player-hit', payload: { playerId: player.id, newHealth, by: 'enemy' } });
                     channel.send({ type: 'broadcast', event: 'enemy-killed', payload: { enemyId: enemy.id, killerId: player.id } });
                }
            }
        }
    }
};

export const checkPlayerBulletCollisions = (gameData: GameData, channel?: RealtimeChannel) => {
    const allPlayers = [gameData.player, ...gameData.otherPlayers];
    for (let i = gameData.bullets.length - 1; i >= 0; i--) {
        const bullet = gameData.bullets[i];
        if (!bullet) continue;
        for (const player of allPlayers) {
            if (!player.isAlive || bullet.team === player.team || bullet.playerId === player.id) continue;
            const distance = Math.hypot(bullet.x - player.x, bullet.y - player.y);
            if (distance < bullet.size + player.size) {
                const newHealth = Math.max(0, player.health - bullet.damage);
                gameData.bullets.splice(i, 1);
                if (channel) {
                     channel.send({ type: 'broadcast', event: 'player-hit', payload: { playerId: player.id, newHealth, by: bullet.playerId } });
                }
                break;
            }
        }
    }
};

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
    const newBullet: Bullet = {
        id: `${gameData.player.id}-${Date.now()}`, x: gameData.player.x, y: gameData.player.y,
        size: 5 + gameState.bulletSizeLevel, speed: 10, angle, playerId: gameData.player.id,
        team: gameData.player.team, damage: 10 + (gameState.gunLevel * 5),
    };
    gameData.bullets.push(newBullet);
    if (channel) channel.send({ type: 'broadcast', event: 'bullet-fired', payload: { bullet: newBullet } });
};

export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  gameData.bullets.forEach((bullet, index) => {
    bullet.x += Math.cos(bullet.angle) * bullet.speed;
    bullet.y += Math.sin(bullet.angle) * bullet.speed;
    if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
      gameData.bullets.splice(index, 1);
    }
  });
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

export const spawnEnemy = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>, gameSettings: GameSettings) => {
    const now = Date.now();
    if (now - gameData.lastEnemySpawn < (3000 / (gameSettings.enemyCount / 5))) return;
    if (gameData.enemies.length >= gameSettings.enemyCount) return;
    gameData.lastEnemySpawn = now;
    const side = Math.floor(Math.random() * 4); let x, y;
    if (side === 0) { x = 0; y = Math.random() * canvas.height; }
    else if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
    else if (side === 2) { x = Math.random() * canvas.width; y = 0; }
    else { x = Math.random() * canvas.width; y = canvas.height; }
    const newEnemy: Enemy = {
        id: `enemy-${Date.now()}`, x, y, size: 20, health: 50, maxHealth: 50,
        speed: gameSettings.enemySpeed, isBoss: false, color: `hsl(0, 0%, ${Math.random() * 40}%)`
    };
    gameData.enemies.push(newEnemy);
};

export const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {};

export const checkBulletEnemyCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {
    for (let i = gameData.bullets.length - 1; i >= 0; i--) {
        for (let j = gameData.enemies.length - 1; j >= 0; j--) {
            const bullet = gameData.bullets[i]; const enemy = gameData.enemies[j];
            if (!bullet || !enemy) continue;
            if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.size + enemy.size) {
                enemy.health -= bullet.damage; gameData.bullets.splice(i, 1);
                if(enemy.health <= 0){
                    gameData.enemies.splice(j, 1);
                    setGameState(prev => ({...prev, enemiesKilled: prev.enemiesKilled + 1}));
                }
                break;
            }
        }
    }
};

export const checkPlayerEnemyCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {
    const p = gameData.player;
    for (let i = gameData.enemies.length - 1; i >= 0; i--) {
        const e = gameData.enemies[i];
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.size + e.size) {
            gameData.enemies.splice(i, 1); p.health -= 20;
        }
    }
};

export const checkPlayerBulletCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {};

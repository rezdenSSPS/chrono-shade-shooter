// /src/utils/gameLogic.ts (Unified and Corrected)

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameUIState, Bullet, Enemy, GameSettings, Player } from '@/types';


// ==================================
// NEW SHOOTING LOGIC
// ==================================
export function shoot(gameData: GameData, gameState: GameUIState, channel?: RealtimeChannel | null) {
  if (!gameData.player.isAlive) return;
  
  const now = Date.now();
  const fireRate = 500 - (gameState.fireRateLevel * 40);
  
  if (now - gameData.lastShot < fireRate) {
    return;
  }
  gameData.lastShot = now;

  const angle = Math.atan2(
    gameData.mouse.y - gameData.player.y,
    gameData.mouse.x - gameData.player.x
  );
  
  const bulletSpeed = 10;

  const newBullet: Bullet = {
    x: gameData.player.x,
    y: gameData.player.y,
    size: 5 + gameState.bulletSizeLevel,
    damage: 10 * gameState.gunLevel,
    playerId: gameData.player.id,
    team: gameData.player.team,
    color: gameData.player.team === 'red' ? '#ff6666' : '#66b2ff',
    // Calculate velocity based on angle and speed
    vx: Math.cos(angle) * bulletSpeed,
    vy: Math.sin(angle) * bulletSpeed,
  };

  gameData.bullets.push(newBullet);

  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'bullet-fired',
      payload: { bullet: newBullet }
    });
  }
}

// ==================================
// NEW SPAWNING LOGIC
// ==================================
export function spawnEnemy(gameData: GameData, canvas: HTMLCanvasElement, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>, gameSettings?: GameSettings) {
  const now = Date.now();
  const spawnInterval = 3000 - (gameData.enemies.length * 100);
  const maxEnemies = gameSettings?.enemyCount || 10;

  if (now - gameData.lastEnemySpawn > spawnInterval && gameData.enemies.length < maxEnemies) {
    gameData.lastEnemySpawn = now;

    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * canvas.width; y = -20; }
    else if (edge === 1) { x = canvas.width + 20; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 20; }
    else { x = -20; y = Math.random() * canvas.height; }
    
    const newEnemy: Enemy = {
        x, y,
        size: 20,
        speed: gameSettings?.enemySpeed || 1,
        health: 100,
        maxHealth: 100,
        isBoss: false,
        darkness: Math.random() * 0.5 + 0.2,
        vx: 0, // Initialize velocity
        vy: 0, // Initialize velocity
    };
    gameData.enemies.push(newEnemy);
  }
}

export const spawnBoss = (gameData: GameData, canvas: HTMLCanvasElement, setGameState: any) => { /* Your Boss Logic Here */ };


// ==================================
// YOUR EXISTING LOGIC (WITH CORRECTIONS)
// ==================================

export const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => {
  const speed = 5;
  const { keys, player } = gameData;
  if (player.isAlive === false) return;
  if (keys['w'] || keys['arrowup']) player.y -= speed;
  if (keys['s'] || keys['arrowdown']) player.y += speed;
  if (keys['a'] || keys['arrowleft']) player.x -= speed;
  if (keys['d'] || keys['arrowright']) player.x += speed;
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
};

export const updateBullets = (gameData: GameData, canvas: HTMLCanvasElement) => {
  gameData.bullets = gameData.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    return bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height;
  });
};

export const updateEnemies = (gameData: GameData) => {
  const player = gameData.player;
  gameData.enemies.forEach(enemy => {
    let targetPlayer: Player = player;
    if (gameData.gameMode === 'team-vs-enemies') {
      const alivePlayers = [player, ...gameData.otherPlayers].filter(p => p.isAlive !== false);
      if (alivePlayers.length > 0) {
        let closestDistance = Infinity;
        alivePlayers.forEach(p => {
          const dist = Math.sqrt((p.x - enemy.x) ** 2 + (p.y - enemy.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            targetPlayer = p;
          }
        });
      }
    }
    const dx = targetPlayer.x - enemy.x;
    const dy = targetPlayer.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (enemy.isBoss || distance < 200) {
      const speed = enemy.speed || 1;
      enemy.vx = (dx / distance) * speed;
      enemy.vy = (dy / distance) * speed;
    } else {
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

  for (let i = 0; i < gameData.enemies.length; i++) {
    for (let j = i + 1; j < gameData.enemies.length; j++) {
      const enemy1 = gameData.enemies[i];
      const enemy2 = gameData.enemies[j];
      const dx = enemy2.x - enemy1.x;
      const dy = enemy2.y - enemy1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = (enemy1.size + enemy2.size) / 2;
      if (distance < minDistance && distance > 0) {
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

export const checkBulletEnemyCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {
  for (let i = gameData.bullets.length - 1; i >= 0; i--) {
    for (let j = gameData.enemies.length - 1; j >= 0; j--) {
      const bullet = gameData.bullets[i];
      const enemy = gameData.enemies[j];
      if (!bullet || !enemy) continue;

      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < bullet.size + enemy.size / 2) {
        enemy.health--; // *** CORRECTION: Use health instead of hp ***
        gameData.bullets.splice(i, 1);
        
        if (enemy.health <= 0) {
          const timeBonus = Math.floor(enemy.darkness * 10) + (enemy.isBoss ? 30 : 5);
          setGameState(prev => ({
            ...prev,
            timeLeft: prev.timeLeft + timeBonus,
            enemiesKilled: prev.enemiesKilled + 1,
            bossActive: enemy.isBoss ? false : prev.bossActive,
            teamScores: (gameData.gameMode === 'team-vs-enemies' && bullet.team) 
                ? { ...prev.teamScores, [bullet.team]: (prev.teamScores[bullet.team] || 0) + 1 } 
                : prev.teamScores
          }));
          gameData.enemies.splice(j, 1);
        }
        break; // Bullet is gone, move to next bullet
      }
    }
  }
};

export const checkPlayerEnemyCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {
  const allPlayers = [gameData.player, ...gameData.otherPlayers];
  allPlayers.forEach(player => {
    if (player.isAlive === false) return;
    gameData.enemies.forEach(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < player.size + enemy.size / 2) {
        if (gameData.gameMode === 'team-vs-enemies' || gameData.gameMode === 'survival') {
          player.health = Math.max(0, player.health - 25);
          if (player.health <= 0) {
            player.isAlive = false;
            // In single player, end game immediately
            if (player.id === gameData.player.id && gameData.gameMode === 'survival') {
                setGameState(prev => ({ ...prev, timeLeft: 0 }));
            }
          }
        }
      }
    });
  });
};

export const checkPlayerBulletCollisions = (gameData: GameData, setGameState: React.Dispatch<React.SetStateAction<GameUIState>>) => {
  if (gameData.gameMode !== 'team-vs-team') return;
  const allPlayers = [gameData.player, ...gameData.otherPlayers];
  for (let i = gameData.bullets.length - 1; i >= 0; i--) {
      const bullet = gameData.bullets[i];
      if (!bullet) continue;

      for (const player of allPlayers) {
        if (!player.isAlive || bullet.team === player.team) continue;
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < bullet.size + player.size / 2) {
          player.health = Math.max(0, player.health - bullet.damage);
          gameData.bullets.splice(i, 1);
          
          if (player.health <= 0) {
            player.isAlive = false;
            setGameState(prev => ({
              ...prev,
              teamScores: bullet.team ? { ...prev.teamScores, [bullet.team]: (prev.teamScores[bullet.team] || 0) + 1 } : prev.teamScores
            }));
          }
          break; // Bullet is gone, move to next bullet
        }
      }
  }
};

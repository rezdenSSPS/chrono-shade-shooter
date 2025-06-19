import { GameData, GameState, Player } from '@/types/game';

export const updatePlayer = (gameData: GameData, canvas: HTMLCanvasElement) => {
  const speed = 5;
  const { keys, player } = gameData;
  
  // Only move if player is alive
  if (player.isAlive === false) return;
  
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
    let targetPlayer = player;
    
    // In team vs enemies mode, enemies target the closest alive player
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
      // Chase target player if boss or player is close
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
          
          setGameState(prev => {
            const newState = {
              ...prev,
              timeLeft: prev.timeLeft + timeBonus,
              enemiesKilled: prev.enemiesKilled + 1,
              bossActive: enemy.isBoss ? false : prev.bossActive
            };
            
            // Update team scores in team modes
            if (gameData.gameMode === 'team-vs-enemies' && bullet.team) {
              newState.teamScores = {
                ...prev.teamScores,
                [bullet.team]: (prev.teamScores?.[bullet.team] || 0) + 1
              };
            }
            
            return newState;
          });
          
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
  const allPlayers = [gameData.player, ...gameData.otherPlayers];
  
  allPlayers.forEach(player => {
    if (player.isAlive === false) return;
    
    gameData.enemies.forEach(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < player.size + enemy.size / 2) {
        // Player hit
        if (gameData.gameMode === 'team-vs-enemies' || gameData.gameMode === 'team-vs-team') {
          // In team modes, players have health
          player.health = Math.max(0, (player.health || 100) - 25);
          if (player.health <= 0) {
            player.isAlive = false;
            
            // Check if all players are dead
            const alivePlayers = allPlayers.filter(p => p.isAlive !== false);
            if (alivePlayers.length === 0) {
              const survivalTime = Math.floor((Date.now() - gameData.gameStartTime) / 1000);
              setGameState(prev => ({ ...prev, timeLeft: 0 }));
            }
          }
        } else {
          // Single player mode - instant death
          const survivalTime = Math.floor((Date.now() - gameData.gameStartTime) / 1000);
          setGameState(prev => ({ ...prev, timeLeft: 0 }));
        }
      }
    });
  });
};

export const checkPlayerBulletCollisions = (
  gameData: GameData,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  if (gameData.gameMode !== 'team-vs-team') return;
  
  const allPlayers = [gameData.player, ...gameData.otherPlayers];
  
  gameData.bullets.forEach((bullet, bulletIndex) => {
    allPlayers.forEach(player => {
      if (player.isAlive === false) return;
      if (bullet.playerId === player.id) return; // Can't hit yourself
      if (bullet.team === player.team) return; // Can't hit teammates
      
      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < bullet.size + player.size / 2) {
        // Player hit by bullet
        player.health = Math.max(0, (player.health || 100) - 20);
        gameData.bullets.splice(bulletIndex, 1);
        
        if (player.health <= 0) {
          player.isAlive = false;
          
          // Award kill to shooter's team
          setGameState(prev => {
            const newState = { ...prev };
            if (bullet.team && newState.teamScores) {
              newState.teamScores[bullet.team] = (newState.teamScores[bullet.team] || 0) + 1;
            }
            return newState;
          });
          
          // Check win condition
          const redPlayersAlive = allPlayers.filter(p => p.team === 'red' && p.isAlive !== false).length;
          const bluePlayersAlive = allPlayers.filter(p => p.team === 'blue' && p.isAlive !== false).length;
          
          if (redPlayersAlive === 0 || bluePlayersAlive === 0) {
            const survivalTime = Math.floor((Date.now() - gameData.gameStartTime) / 1000);
            setGameState(prev => ({ ...prev, timeLeft: 0 }));
          }
        }
      }
    });
  });
};
import { GameData, GameState } from '@/types/game';

export const shoot = (gameData: GameData, gameState: GameState) => {
  const now = Date.now();
  const fireRateDelays = [400, 250, 150, 100, 75, 50, 25];
  const shootDelay = fireRateDelays[gameState.fireRateLevel - 1] || 25;
  
  if (now - gameData.lastShot < shootDelay) return;
  
  // Can't shoot if dead
  if (gameData.player.isAlive === false) return;
  
  const player = gameData.player;
  const mouse = gameData.mouse;
  
  const dx = mouse.x - player.x;
  const dy = mouse.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  const speed = 15;
  const vx = (dx / distance) * speed;
  const vy = (dy / distance) * speed;

  const bulletSizes = [6, 10, 16, 22, 28, 34, 40];
  const bulletSize = bulletSizes[gameState.bulletSizeLevel - 1] || 6;

  const bulletConfigs = [
    { count: 1, spread: 0, color: '#ffff00' },
    { count: 5, spread: 0.6, color: '#ff4400' },
    { count: 3, spread: 0.3, color: '#00ff44' },
    { count: 7, spread: 0.4, color: '#ff00ff' },
    { count: 9, spread: 0.8, color: '#00ffff' },
    { count: 11, spread: 0.5, color: '#ff8800' },
    { count: 15, spread: 1.0, color: '#8800ff' }
  ];

  const config = bulletConfigs[gameState.gunLevel - 1] || bulletConfigs[0];
  
  // Team-based bullet colors
  let bulletColor = config.color;
  if (gameData.gameMode === 'team-vs-team') {
    bulletColor = player.team === 'red' ? '#ff0000' : '#0000ff';
  } else if (gameData.gameMode === 'team-vs-enemies') {
    bulletColor = '#00ff00'; // Green for team vs enemies
  }
  
  for (let i = 0; i < config.count; i++) {
    let angle = Math.atan2(vy, vx);
    if (config.count > 1) {
      const offset = (i - (config.count - 1) / 2) * config.spread;
      angle += offset;
    }
    
    gameData.bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: bulletSize,
      color: bulletColor,
      playerId: gameData.playerId,
      team: player.team
    });
  }
  
  gameData.lastShot = now;
};
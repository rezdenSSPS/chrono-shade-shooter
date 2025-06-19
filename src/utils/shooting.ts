
import { GameData, GameState } from '@/types/game';

export const shoot = (gameData: GameData, gameState: GameState) => {
  const now = Date.now();
  const fireRateDelays = [400, 250, 150];
  const shootDelay = fireRateDelays[gameState.fireRateLevel - 1] || 150;
  
  if (now - gameData.lastShot < shootDelay) return;
  
  const player = gameData.player;
  const mouse = gameData.mouse;
  
  const dx = mouse.x - player.x;
  const dy = mouse.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  const speed = 15;
  const vx = (dx / distance) * speed;
  const vy = (dy / distance) * speed;

  const bulletSizes = [6, 10, 16];
  const bulletSize = bulletSizes[gameState.bulletSizeLevel - 1] || 6;

  const bulletConfigs = [
    { count: 1, spread: 0, color: '#ffff00' },
    { count: 5, spread: 0.6, color: '#ff4400' },
    { count: 3, spread: 0.3, color: '#00ff44' }
  ];

  const config = bulletConfigs[gameState.gunLevel - 1];
  
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
      color: config.color
    });
  }
  
  gameData.lastShot = now;
};


import { GameData } from '@/types/game';

export const drawHumanSilhouette = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  size: number, 
  color: string, 
  isPlayer = false
) => {
  ctx.fillStyle = color;
  ctx.strokeStyle = isPlayer ? '#00ff00' : color;
  ctx.lineWidth = isPlayer ? 3 : 1;
  
  const scale = size / 25;
  
  // Head
  ctx.beginPath();
  ctx.arc(x, y - 12 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) ctx.stroke();
  
  // Body (torso)
  ctx.beginPath();
  ctx.rect(x - 4 * scale, y - 6 * scale, 8 * scale, 15 * scale);
  ctx.fill();
  if (isPlayer) ctx.stroke();
  
  // Arms
  ctx.beginPath();
  ctx.rect(x - 12 * scale, y - 3 * scale, 6 * scale, 12 * scale);
  ctx.rect(x + 6 * scale, y - 3 * scale, 6 * scale, 12 * scale);
  ctx.fill();
  if (isPlayer) ctx.stroke();
  
  // Legs
  ctx.beginPath();
  ctx.rect(x - 3 * scale, y + 9 * scale, 5 * scale, 12 * scale);
  ctx.rect(x - 2 * scale, y + 9 * scale, 5 * scale, 12 * scale);
  ctx.fill();
  if (isPlayer) ctx.stroke();
};

export const renderGame = (
  canvas: HTMLCanvasElement,
  gameData: GameData
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size to full screen
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Enhanced background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f0f23');
  gradient.addColorStop(0.5, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid pattern
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += 60) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  // Draw player
  drawHumanSilhouette(ctx, gameData.player.x, gameData.player.y, gameData.player.size, '#00ff00', true);

  // Draw enemies
  gameData.enemies.forEach(enemy => {
    const grayValue = Math.floor((1 - enemy.darkness) * 255);
    const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    drawHumanSilhouette(ctx, enemy.x, enemy.y, enemy.size, color);
    
    if (enemy.isBoss) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 25;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  });

  // Draw bullets with enhanced effects
  gameData.bullets.forEach(bullet => {
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Enhanced crosshair
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(gameData.mouse.x - 20, gameData.mouse.y);
  ctx.lineTo(gameData.mouse.x + 20, gameData.mouse.y);
  ctx.moveTo(gameData.mouse.x, gameData.mouse.y - 20);
  ctx.lineTo(gameData.mouse.x, gameData.mouse.y + 20);
  ctx.stroke();
  ctx.shadowBlur = 0;
};

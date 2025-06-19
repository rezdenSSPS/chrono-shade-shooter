import type { GameData, Player, Enemy, Bullet } from '@/types';

function drawHumanSilhouette(
  ctx: CanvasRenderingContext2D,
  entity: Player | Enemy,
  isMainPlayer: boolean = false
) {
  const { x, y, size, isAlive } = entity;
  const { team, health, maxHealth } = entity as Player;
  const { isBoss, darkness } = entity as Enemy;

  if (!isAlive) {
    ctx.globalAlpha = 0.4;
  }

  // Determine color based on type and team
  if (isMainPlayer) {
      ctx.fillStyle = '#00ff00';
  } else if (team) { // It's another player
      ctx.fillStyle = team === 'red' ? '#E53E3E' : '#3B82F6';
  } else { // It's an enemy
      const grayValue = Math.floor((1 - (darkness || 0.5)) * 200) + 55;
      ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
  }
  
  if (isMainPlayer) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
  } else if (team) {
    ctx.strokeStyle = team === 'red' ? '#ff0000' : '#0000ff';
    ctx.lineWidth = 4;
  } else {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
  }

  const scale = size / 25;
  ctx.beginPath();
  ctx.arc(x, y - 12 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - 4 * scale, y - 6 * scale, 8 * scale, 15 * scale);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - 12 * scale, y - 3 * scale, 6 * scale, 12 * scale);
  ctx.rect(x + 6 * scale, y - 3 * scale, 6 * scale, 12 * scale);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - 4 * scale, y + 9 * scale, 6 * scale, 12 * scale);
  ctx.rect(x - 2 * scale, y + 9 * scale, 6 * scale, 12 * scale);
  ctx.fill(); ctx.stroke();
  
  ctx.globalAlpha = 1.0;

  if (isBoss) {
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 25;
      ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, size + 8, 0, Math.PI * 2);
      ctx.stroke(); ctx.shadowBlur = 0;
  }

  if (isAlive && health !== undefined && maxHealth !== undefined && health < maxHealth) {
    const barWidth = size * 1.5;
    const barHeight = 6;
    const barX = x - barWidth / 2;
    const barY = y - size - 15;
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const healthPercent = health / maxHealth;
    ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, mouse: {x: number, y: number}) {
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3;
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 20, mouse.y); ctx.lineTo(mouse.x + 20, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 20); ctx.lineTo(mouse.x, mouse.y + 20);
    ctx.stroke(); ctx.shadowBlur = 0;
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
    ctx.fillStyle = bullet.color; ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 15; ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill(); ctx.shadowBlur = 0;
}

export function renderGame(canvas: HTMLCanvasElement, gameData: GameData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f0f23');
  gradient.addColorStop(0.5, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  gameData.otherPlayers.forEach(player => {
    drawHumanSilhouette(ctx, player);
    if(player.isAlive) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.id.substring(7, 12), player.x, player.y - player.size - 25);
    }
  });

  gameData.enemies.forEach(enemy => drawHumanSilhouette(ctx, enemy));
  gameData.bullets.forEach(bullet => drawBullet(ctx, bullet));
  drawHumanSilhouette(ctx, gameData.player, true);
  if (gameData.player.isAlive) drawCrosshair(ctx, gameData.mouse);
}

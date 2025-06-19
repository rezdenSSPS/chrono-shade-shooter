// src/utils/gameRenderer.ts (Updated and Refactored)

import type { GameData, Player, Enemy, Bullet } from '@/types';

function drawHumanSilhouette(
  ctx: CanvasRenderingContext2D,
  entity: Player | Enemy, // Accept the whole object
  isMainPlayer: boolean = false
) {
  const { x, y, size, isAlive, team, health, maxHealth } = entity as Player; // Assume Player for properties like team
  const { isBoss } = entity as Enemy; // Assume Enemy for boss property

  if (!isAlive) {
    // Draw dead player as gray outline
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'transparent';
  } else {
    // Determine color based on type and team
    if (isMainPlayer) {
        ctx.fillStyle = '#00ff00';
    } else if (team) { // It's another player
        ctx.fillStyle = team === 'red' ? '#E53E3E' : '#3B82F6';
    } else { // It's an enemy
        const darkness = (entity as Enemy).darkness || 1;
        const grayValue = Math.floor((1 - darkness) * 200) + 55;
        ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    }
    
    if (isMainPlayer) {
      ctx.strokeStyle = '#00ff00'; // Green outline for main player
      ctx.lineWidth = 3;
    } else if (team) {
      ctx.strokeStyle = team === 'red' ? '#ff0000' : '#0000ff';
      ctx.lineWidth = 4;
    } else {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
    }
  }

  const scale = size / 25;

  // Head, Body, Arms, Legs (same as your original code)
  ctx.beginPath();
  ctx.arc(x, y - 12 * scale, 6 * scale, 0, Math.PI * 2);
  if (isAlive) ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x - 4 * scale, y - 6 * scale, 8 * scale, 15 * scale);
  if (isAlive) ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x - 12 * scale, y - 3 * scale, 6 * scale, 12 * scale);
  ctx.rect(x + 6 * scale, y - 3 * scale, 6 * scale, 12 * scale);
  if (isAlive) ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x - 3 * scale, y + 9 * scale, 5 * scale, 12 * scale);
  ctx.rect(x - 2 * scale, y + 9 * scale, 5 * scale, 12 * scale);
  if (isAlive) ctx.fill();
  ctx.stroke();

  // Boss glow
  if (isBoss) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 25;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
  }

  // Health bar
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
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 20, mouse.y);
    ctx.lineTo(mouse.x + 20, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 20);
    ctx.lineTo(mouse.x, mouse.y + 20);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}


export function renderGame(canvas: HTMLCanvasElement, gameData: GameData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas and draw background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f0f23');
  gradient.addColorStop(0.5, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw main player
  drawHumanSilhouette(ctx, gameData.player, true);

  // Draw other players
  gameData.otherPlayers.forEach(player => {
    drawHumanSilhouette(ctx, player);
    
    // Player name/ID
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.id.substring(0, 8), player.x, player.y - player.size - 25);
  });

  // Draw enemies
  gameData.enemies.forEach(enemy => {
    drawHumanSilhouette(ctx, enemy);
  });

  // Draw bullets
  gameData.bullets.forEach(bullet => {
    drawBullet(ctx, bullet);
  });

  // Draw crosshair
  if (gameData.player.isAlive) {
    drawCrosshair(ctx, gameData.mouse);
  }
}

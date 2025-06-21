// src/utils/gameRenderer.ts

import type { GameData, Player } from '@/types';

const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player) => {
  if (!player.isAlive) return;

  // Main body
  ctx.fillStyle = player.team === 'red' ? '#E53E3E' : '#3B82F6';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fill();

  // Health bar
  if (player.health < player.maxHealth) {
    const healthBarWidth = player.size * 2;
    const healthBarHeight = 5;
    const healthBarX = player.x - player.size;
    const healthBarY = player.y + player.size + 5;

    ctx.fillStyle = '#4A5568'; // Background
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

    ctx.fillStyle = '#48BB78'; // Health
    const healthWidth = (player.health / player.maxHealth) * healthBarWidth;
    ctx.fillRect(healthBarX, healthBarY, healthWidth, healthBarHeight);
  }
};

export const renderGame = (canvas: HTMLCanvasElement, gameData: GameData, localPlayerId?: string) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background (optional)
  ctx.fillStyle = '#1A202C';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw enemies
  gameData.enemies.forEach(enemy => {
    ctx.fillStyle = `rgb(${enemy.colorValue}, 0, 0)`;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw local player
  drawPlayer(ctx, gameData.player);

  // Draw other players
  gameData.otherPlayers.forEach(p => drawPlayer(ctx, p));

  // Draw bullets
  gameData.bullets.forEach(bullet => {
    ctx.fillStyle = bullet.team === 'red' ? '#F56565' : '#63B3ED';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  });
};

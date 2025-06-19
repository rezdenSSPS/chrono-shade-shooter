import type { GameData, Player } from "@/types";

const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player, isLocalPlayer: boolean) => {
    if (!player.isAlive) return;

    // Team color outline
    ctx.strokeStyle = player.team === 'red' ? '#ff6666' : '#6666ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.stroke();

    // Player body
    ctx.fillStyle = isLocalPlayer ? '#00c2c7' : '#dddddd'; // Cyan for local, white for others
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();

    // Health bar
    const healthBarWidth = 40;
    const healthBarHeight = 5;
    const healthPercentage = player.health / player.maxHealth;
    
    // Background
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(player.x - healthBarWidth / 2, player.y - player.size - 15, healthBarWidth, healthBarHeight);

    // Foreground
    ctx.fillStyle = '#4dff4d';
    ctx.fillRect(player.x - healthBarWidth / 2, player.y - player.size - 15, healthBarWidth * healthPercentage, healthBarHeight);

    // "YOU" indicator for local player
    if (isLocalPlayer) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOU', player.x, player.y - player.size - 25);
    }
};


export const renderGame = (canvas: HTMLCanvasElement, gameData: GameData) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw enemies
    gameData.enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw bullets
    gameData.bullets.forEach(bullet => {
        ctx.fillStyle = bullet.team === 'red' ? '#ff8080' : '#8080ff';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw other players
    gameData.otherPlayers.forEach(player => drawPlayer(ctx, player, false));

    // Draw local player on top
    drawPlayer(ctx, gameData.player, true);

    // Draw cursor
    if (gameData.player.isAlive) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gameData.mouse.x, gameData.mouse.y, 10, 0, Math.PI * 2);
        ctx.stroke();
    }
};

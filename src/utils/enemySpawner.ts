
import { GameData, GameState } from '@/types/game';

export const spawnEnemy = (
  gameData: GameData,
  canvas: HTMLCanvasElement,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  const now = Date.now();
  const timeSinceStart = (now - gameData.gameStartTime) / 1000;
  const wave = Math.floor(timeSinceStart / 30) + 1;
  
  // Update wave
  setGameState(prev => ({ ...prev, wave }));
  
  // Wave-based spawn rate
  const baseSpawnRate = 800;
  const waveMultiplier = Math.max(0.3, 1 - (wave - 1) * 0.1);
  const spawnRate = baseSpawnRate * waveMultiplier;
  
  if (now - gameData.lastEnemySpawn < spawnRate) return;

  // Spawn from edges
  const side = Math.floor(Math.random() * 4);
  let x, y;
  
  switch (side) {
    case 0: x = Math.random() * canvas.width; y = -40; break;
    case 1: x = canvas.width + 40; y = Math.random() * canvas.height; break;
    case 2: x = Math.random() * canvas.width; y = canvas.height + 40; break;
    default: x = -40; y = Math.random() * canvas.height;
  }

  const darkness = Math.random();
  gameData.enemies.push({
    x,
    y,
    size: 30,
    vx: 0,
    vy: 0,
    darkness,
    hp: Math.floor(darkness * 2) + 1,
    isBoss: false
  });

  gameData.lastEnemySpawn = now;
};

export const spawnBoss = (
  gameData: GameData,
  canvas: HTMLCanvasElement,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  const now = Date.now();
  const timeSinceLastBoss = (now - gameData.lastBossSpawn) / 1000;
  
  if (timeSinceLastBoss >= 90) {
    gameData.enemies.push({
      x: canvas.width / 2,
      y: -80,
      size: 80,
      vx: 0,
      vy: 1.2,
      darkness: 1,
      hp: 20,
      isBoss: true
    });

    setGameState(prev => ({ ...prev, bossActive: true }));
    gameData.lastBossSpawn = now;
  }
};

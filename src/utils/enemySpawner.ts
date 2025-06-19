
import { GameData, GameState } from '@/types/game';

interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  gameMode?: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

export const spawnEnemy = (
  gameData: GameData,
  canvas: HTMLCanvasElement,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameSettings?: GameSettings
) => {
  const now = Date.now();
  const timeSinceStart = (now - gameData.gameStartTime) / 1000;
  const wave = Math.floor(timeSinceStart / 30) + 1;
  
  // Update wave
  setGameState(prev => ({ ...prev, wave }));
  
  // Wave-based spawn rate with game settings
  const baseSpawnRate = 800;
  const waveMultiplier = Math.max(0.3, 1 - (wave - 1) * 0.1);
  const settingsMultiplier = gameSettings ? (1 / gameSettings.enemyCount) : 1;
  const spawnRate = baseSpawnRate * waveMultiplier * settingsMultiplier;
  
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
  const baseSpeed = gameSettings?.enemySpeed || 1;
  
  gameData.enemies.push({
    x,
    y,
    size: 40, // Bigger enemies
    vx: 0,
    vy: 0,
    darkness,
    hp: Math.floor(darkness * 2) + 1,
    isBoss: false,
    speed: baseSpeed * 0.8 // Slower enemies
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
      isBoss: true,
      speed: 1
    });

    setGameState(prev => ({ ...prev, bossActive: true }));
    gameData.lastBossSpawn = now;
  }
};

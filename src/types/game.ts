
export interface Player {
  x: number;
  y: number;
  size: number;
}

export interface Enemy {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  darkness: number;
  hp: number;
  isBoss: boolean;
  speed: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export interface GameState {
  timeLeft: number;
  gunLevel: number;
  fireRateLevel: number;
  bulletSizeLevel: number;
  enemiesKilled: number;
  bossActive: boolean;
  gameStartTime: number;
  wave: number;
}

export interface GameData {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  keys: Record<string, boolean>;
  mouse: { x: number; y: number };
  lastShot: number;
  lastEnemySpawn: number;
  lastBossSpawn: number;
  gameStartTime: number;
  multiplayerChannel: any;
}

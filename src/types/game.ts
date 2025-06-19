export interface Player {
  x: number;
  y: number;
  size: number;
  id?: string;
  team?: 'red' | 'blue';
  health?: number;
  maxHealth?: number;
  isAlive?: boolean;
  kills?: number;
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
  playerId?: string;
  team?: 'red' | 'blue';
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
  gameMode?: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  teamScores?: {
    red: number;
    blue: number;
  };
  playersAlive?: number;
}

export interface GameData {
  player: Player;
  otherPlayers: Player[];
  enemies: Enemy[];
  bullets: Bullet[];
  keys: Record<string, boolean>;
  mouse: { x: number; y: number };
  lastShot: number;
  lastEnemySpawn: number;
  lastBossSpawn: number;
  gameStartTime: number;
  multiplayerChannel: any;
  gameMode?: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  playerId?: string;
}
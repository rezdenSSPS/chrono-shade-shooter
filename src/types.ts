// src/types.ts

export interface Player {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  kills: number;
  team?: 'red' | 'blue';
  role?: 'host' | 'player';
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  damage: number;
  playerId: string;
  team?: 'red' | 'blue';
  birthTime: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  health: number;
  maxHealth: number;
  isBoss: boolean;
  colorValue: number;
}

export interface GameData {
  player: Player;
  otherPlayers: Player[];
  enemies: Enemy[];
  bullets: Bullet[];
  keys: { [key: string]: boolean };
  mouse: { x: number; y: number; isDown: boolean };
  lastShot: number;
  lastEnemySpawn: number;
  lastBossSpawn: number;
  gameMode: string;
  gameStartTime: number;
}

export interface GameUIState {
  timeLeft: number;
  gunLevel: number;
  fireRateLevel: number;
  bulletSizeLevel: number;
  enemiesKilled: number;
  bossActive: boolean;
  gameStartTime: number;
  wave: number;
  gameMode: string;
  teamScores: { red: number; blue: number };
}

export type GameScreen = 'menu' | 'playing' | 'gameOver' | 'leaderboard' | 'multiplayerLobby' | 'multiplayerGame';

export interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  bossEnabled: boolean;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

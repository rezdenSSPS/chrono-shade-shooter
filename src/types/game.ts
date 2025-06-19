// src/types/game.ts

// The state object managed by GameCanvas.tsx and used by the game loop.
export interface GameState {
  timeLeft: number;
  gunLevel: number;
  fireRateLevel: number;
  bulletSizeLevel: number;
  enemiesKilled: number;
  bossActive: boolean;
  gameStartTime: number;
  wave: number;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  teamScores: { red: number, blue: number };
  playersAlive: number;
}

// Represents an individual player
export interface Player {
  id: string;
  x: number;
  y: number;
  size: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  kills: number;
  team?: 'red' | 'blue';
}

// Represents an individual enemy
export interface Enemy {
  id: string;
  x: number;
  y: number;
  size: number;
  health: number;
  speed: number;
  type: 'normal' | 'fast' | 'strong' | 'boss';
}

// Represents a projectile
export interface Bullet {
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  damage: number;
  playerId: string;
  team?: 'red' | 'blue';
}

// The internal data object used by useGameLoop.tsx, managed with a ref.
export interface GameData {
  player: Player;
  otherPlayers: Player[];
  enemies: Enemy[];
  bullets: Bullet[];
  keys: { [key: string]: boolean };
  mouse: { x: number; y: number };
  lastShot: number;
  lastEnemySpawn: number;
  lastBossSpawn: number;
  gameStartTime: number;
  multiplayerChannel: any | null; // Supabase RealtimeChannel
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  playerId: string;
  isHost: boolean;
  lastSyncTime: number;
}

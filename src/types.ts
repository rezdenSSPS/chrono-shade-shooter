import type { RealtimeChannel } from "@supabase/supabase-js";

export type GameScreen = 'menu' | 'playing' | 'multiplayerLobby' | 'multiplayerGame' | 'gameOver' | 'leaderboard';

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
  role?: 'host' | 'player';
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  size: number;
  health: number;
  maxHealth: number;
  speed: number;
  isBoss: boolean;
  color: string;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  angle: number;
  playerId: string;
  team?: 'red' | 'blue';
  damage: number;
}

export interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  bossEnabled: boolean;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
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
  gameMode: GameSettings['gameMode'];
  teamScores: { red: number; blue: number };
}

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
  gameMode: GameSettings['gameMode'];
  gameStartTime: number;
}

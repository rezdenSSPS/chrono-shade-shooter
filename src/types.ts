// src/types.ts
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---- GAME STATE & SETTINGS ----
export type GameScreen = 'menu' | 'playing' | 'leaderboard' | 'gameOver' | 'multiplayerLobby' | 'multiplayerGame';

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


// ---- GAME ENTITIES ----
export interface Player {
  id: string;
  x: number;
  y: number;
  // ADD THESE TWO LINES FOR INTERPOLATION
  targetX: number; // The destination X coordinate from the network
  targetY: number; // The destination Y coordinate from the network
  size: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  kills: number;
  role?: 'host' | 'player';
  team?: 'red' | 'blue';
}

export interface Bullet {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    playerId: string;
    team?: 'red' | 'blue';
    damage: number;
}

export interface Enemy {
    x: number;
    y: number;
    size: number;
    health: number;
    speed: number;
    type: 'normal' | 'fast' | 'tank' | 'boss';
    id: string;
}

// ---- CORE GAME DATA ----
export interface GameData {
    player: Player;
    otherPlayers: Player[];
    enemies: Enemy[];
    bullets: Bullet[];
    keys: { [key: string]: boolean };
    mouse: { x: number, y: number };
    lastShot: number;
    lastEnemySpawn: number;
    lastBossSpawn: number;
    gameMode: GameSettings['gameMode'];
    gameStartTime: number;
}

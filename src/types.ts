// src/types.ts (Updated)

import { RealtimeChannel } from "@supabase/supabase-js";

export type GameScreen = 'menu' | 'playing' | 'gameOver' | 'leaderboard' | 'multiplayerLobby' | 'multiplayerGame';

export interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
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

export interface Player {
    id: string;
    x: number;
    y: number;
    size: number;
    health: number;
    maxHealth: number;
    isAlive: boolean;
    team?: 'red' | 'blue';
    kills: number;
    role?: 'host' | 'player';
}

export interface Enemy {
    x: number;
    y: number;
    size: number;
    speed: number;
    health: number;
    maxHealth: number;
    isBoss: boolean;
    darkness: number;
    vx: number; // <-- For physics-based movement
    vy: number; // <-- For physics-based movement
}

export interface Bullet {
    x: number;
    y: number;
    size: number;
    damage: number;
    playerId: string;
    team?: 'red' | 'blue';
    color: string;
    vx: number; // <-- Use velocity instead of angle/speed
    vy: number; // <-- Use velocity instead of angle/speed
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
    gameStartTime: number; // <-- Make sure this is here
}

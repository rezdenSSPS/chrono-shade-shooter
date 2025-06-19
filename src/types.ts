import { RealtimeChannel } from "@supabase/supabase-js";

// The screen currently being displayed (menu, lobby, game, etc.)
export type GameScreen = 'menu' | 'playing' | 'gameOver' | 'leaderboard' | 'multiplayerLobby' | 'multiplayerGame';

// Settings for a multiplayer match, configured by the host
export interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

// State for the main Game UI, passed from GameCanvas to the game loop
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

// Represents a player in the game
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

// Represents an enemy
export interface Enemy {
    x: number;
    y: number;
    size: number;
    speed: number;
    health: number;
    maxHealth: number;
    type: 'normal' | 'fast' | 'strong' | 'boss';
}

// Represents a bullet
export interface Bullet {
    x: number;
    y: number;
    size: number;
    speed: number;
    angle: number;
    damage: number;
    playerId: string;
    team?: 'red' | 'blue';
}

// The core data managed inside the game loop, not exposed to React state directly
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
}

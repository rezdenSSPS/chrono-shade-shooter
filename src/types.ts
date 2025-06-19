import type { RealtimeChannel } from "@supabase/supabase-js";

export type GameScreen = 'menu' | 'playing' | 'gameOver' | 'leaderboard' | 'multiplayerLobby' | 'multiplayerGame';

// SETTINGS: What the host can configure in the lobby
export interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  bossEnabled: boolean;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

// UI STATE: What the player sees on their screen (timer, levels, etc.)
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

// ENTITIES: The actual objects in the game world

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
    id: string;
    x: number;
    y: number;
    size: number;
    speed: number;
    health: number;
    maxHealth: number;
    isBoss: boolean;
    darkness: number;
    isAlive: boolean;
}

export interface Bullet {
    id: string;
    x: number;
    y: number;
    size: number;
    damage: number;
    playerId: string;
    team?: 'red' | 'blue';
    color: string;
    vx: number;
    vy: number;
}

// GAME DATA: The complete state of the simulation for one client
export interface GameData {
    player: Player;
    otherPlayers: Player[];
    enemies: Enemy[];
    bullets: Bullet[];
    keys: { [key:string]: boolean };
    mouse: { x: number; y: number };
    lastShot: number;
    lastEnemySpawn: number;
    lastBossSpawn: number;
    gameMode: GameSettings['gameMode'];
    gameStartTime: number;
}

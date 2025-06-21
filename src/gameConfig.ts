// src/gameConfig.ts

export const UPGRADE_COSTS = {
  gun: [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 25],
  fireRate: [0, 1, 3, 5, 7, 9, 11, 14, 17, 20, 24],
  bulletSize: [0, 3, 5, 7, 9, 11, 13, 16, 19, 23, 26],
};

export const GUN_NAMES = [
  'Pistol', 'Shotgun', 'SMG', 'Rifle', 'LMG', 'Plasma',
  'Laser', 'Rail Gun', 'Ion Cannon', 'Annihilator'
];

// In a PvE game, you might give time for kills instead of using time as currency.
// This is an example of how you could expand the config.
export const ENEMY_KILL_REWARDS = {
  pveTimeBonus: 5, // seconds
};

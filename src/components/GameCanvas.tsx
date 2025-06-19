
import React, { useRef, useEffect, useState } from 'react';
import { Button } from './ui/button';
import useGameLoop from '@/hooks/useGameLoop';

interface GameCanvasProps {
  onGameEnd: (score: number) => void;
  isMultiplayer?: boolean;
  lobbyCode?: string;
  gameSettings?: {
    enemyCount: number;
    enemySpeed: number;
    enemyDamage: number;
    gameMode?: 'survival' | 'team-vs-enemies' | 'team-vs-team';
  };
}

const GameCanvas = ({ onGameEnd, isMultiplayer = false, lobbyCode, gameSettings }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState({
    timeLeft: 180,
    gunLevel: 1,
    fireRateLevel: 1,
    bulletSizeLevel: 1,
    enemiesKilled: 0,
    bossActive: false,
    gameStartTime: Date.now(),
    wave: 1
  });

  const gameLoop = useGameLoop(canvasRef, gameState, setGameState, onGameEnd, isMultiplayer, lobbyCode, gameSettings);

  const purchaseGunUpgrade = () => {
    const cost = getGunUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.gunLevel < 7) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        gunLevel: prev.gunLevel + 1
      }));
    }
  };

  const purchaseFireRateUpgrade = () => {
    const cost = getFireRateUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.fireRateLevel < 7) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        fireRateLevel: prev.fireRateLevel + 1
      }));
    }
  };

  const purchaseBulletSizeUpgrade = () => {
    const cost = getBulletSizeUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.bulletSizeLevel < 7) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        bulletSizeLevel: prev.bulletSizeLevel + 1
      }));
    }
  };

  const getGunUpgradeCost = () => {
    const costs = [0, 20, 40, 60, 80, 100, 120];
    return costs[gameState.gunLevel] || 150;
  };

  const getFireRateUpgradeCost = () => {
    const costs = [0, 15, 30, 45, 60, 75, 90];
    return costs[gameState.fireRateLevel] || 100;
  };

  const getBulletSizeUpgradeCost = () => {
    const costs = [0, 25, 50, 75, 100, 125, 150];
    return costs[gameState.bulletSizeLevel] || 175;
  };

  const getGunUpgradeText = () => {
    if (gameState.gunLevel >= 7) return "MAX LEVEL";
    const cost = getGunUpgradeCost();
    const gunNames = ['Pistol', 'Shotgun', 'Assault Rifle', 'Machine Gun', 'Plasma Rifle', 'Laser Cannon', 'Ultimate Destroyer'];
    const nextGun = gunNames[gameState.gunLevel] || 'Ultimate Weapon';
    return `${nextGun.toUpperCase()} - ${cost}s`;
  };

  const getFireRateUpgradeText = () => {
    if (gameState.fireRateLevel >= 7) return "MAX RATE";
    const cost = getFireRateUpgradeCost();
    return `FIRE RATE LV${gameState.fireRateLevel + 1} - ${cost}s`;
  };

  const getBulletSizeUpgradeText = () => {
    if (gameState.bulletSizeLevel >= 7) return "MAX SIZE";
    const cost = getBulletSizeUpgradeCost();
    return `BULLET SIZE LV${gameState.bulletSizeLevel + 1} - ${cost}s`;
  };

  const canUpgradeGun = gameState.timeLeft >= getGunUpgradeCost() && gameState.gunLevel < 7;
  const canUpgradeFireRate = gameState.timeLeft >= getFireRateUpgradeCost() && gameState.fireRateLevel < 7;
  const canUpgradeBulletSize = gameState.timeLeft >= getBulletSizeUpgradeCost() && gameState.bulletSizeLevel < 7;

  const displayTime = Math.floor(gameState.timeLeft);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex">
      {/* Fullscreen Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full bg-gray-900"
        style={{ cursor: 'none' }}
      />
      
      {/* UI Overlay - Top Left - Timer */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 text-black px-8 py-4 rounded-xl border-2 border-yellow-400 shadow-2xl">
          <div className="text-4xl font-bold text-center">
            ⏱️ {displayTime}s
          </div>
        </div>
      </div>

      {/* UI Overlay - Left Side - Upgrades */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 space-y-4 w-64">
        <div className="bg-gradient-to-r from-gray-900/90 via-black/90 to-gray-900/90 text-white p-4 rounded-xl border-2 border-cyan-400 shadow-2xl backdrop-blur-sm">
          <h3 className="text-xl font-bold text-cyan-400 mb-4">🔫 UPGRADES</h3>
          <div className="space-y-3">
            <Button
              onClick={purchaseGunUpgrade}
              disabled={!canUpgradeGun}
              className={`w-full text-sm px-4 py-3 rounded-lg font-bold transition-all ${
                canUpgradeGun 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black' 
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {getGunUpgradeText()}
            </Button>
            
            <Button
              onClick={purchaseFireRateUpgrade}
              disabled={!canUpgradeFireRate}
              className={`w-full text-sm px-4 py-3 rounded-lg font-bold transition-all ${
                canUpgradeFireRate 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white' 
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {getFireRateUpgradeText()}
            </Button>
            
            <Button
              onClick={purchaseBulletSizeUpgrade}
              disabled={!canUpgradeBulletSize}
              className={`w-full text-sm px-4 py-3 rounded-lg font-bold transition-all ${
                canUpgradeBulletSize 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white' 
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {getBulletSizeUpgradeText()}
            </Button>
          </div>
        </div>
      </div>

      {/* UI Overlay - Right Side - Stats */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 space-y-4 w-64">
        <div className="bg-gradient-to-r from-gray-900/90 via-black/90 to-gray-900/90 text-white p-4 rounded-xl border-2 border-cyan-400 shadow-2xl backdrop-blur-sm">
          <h3 className="text-xl font-bold text-cyan-400 mb-4">📊 STATS</h3>
          <div className="space-y-3 text-lg">
            <div className="flex items-center justify-between">
              <span>Wave:</span>
              <span className="text-purple-400 font-bold">{gameState.wave}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Kills:</span>
              <span className="text-red-400 font-bold">{gameState.enemiesKilled}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Gun:</span>
              <span className="text-green-400 font-bold">Lv{gameState.gunLevel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fire Rate:</span>
              <span className="text-orange-400 font-bold">Lv{gameState.fireRateLevel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bullet Size:</span>
              <span className="text-purple-400 font-bold">Lv{gameState.bulletSizeLevel}</span>
            </div>
            {gameState.bossActive && (
              <div className="text-red-500 font-bold text-xl animate-pulse text-center">
                ⚠️ BOSS FIGHT!
              </div>
            )}
          </div>
        </div>

        {isMultiplayer && (
          <div className="bg-gradient-to-r from-green-900/90 to-blue-900/90 text-white p-4 rounded-xl border-2 border-green-400 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-green-400 mb-2">🌐 MULTIPLAYER</h3>
            <p className="text-sm">Lobby: <span className="font-mono text-yellow-400">{lobbyCode}</span></p>
            {gameSettings?.gameMode && (
              <p className="text-sm mt-2">Mode: <span className="text-cyan-400 font-bold">
                {gameSettings.gameMode === 'survival' ? 'Last Man Standing' : 
                 gameSettings.gameMode === 'team-vs-enemies' ? 'Team vs Enemies' : 'Team vs Team'}
              </span></p>
            )}
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-900/90 to-purple-900/90 text-white p-4 rounded-xl border-2 border-blue-400 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-blue-400 mb-2">🎮 CONTROLS</h3>
          <div className="text-sm space-y-1">
            <p>⌨️ WASD - Move</p>
            <p>🖱️ Mouse - Aim & Shoot</p>
            <p>💰 Time = Currency</p>
            <p>🎯 Dark = More Time</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;

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
    timeLeft: gameSettings?.gameMode === 'team-vs-team' ? 300 : 180, // 5 minutes for PvP, 3 for others
    gunLevel: 1,
    fireRateLevel: 1,
    bulletSizeLevel: 1,
    enemiesKilled: 0,
    bossActive: false,
    gameStartTime: Date.now(),
    wave: 1,
    gameMode: gameSettings?.gameMode || 'survival',
    teamScores: { red: 0, blue: 0 },
    playersAlive: 1
  });

  const gameLoop = useGameLoop(canvasRef, gameState, setGameState, onGameEnd, isMultiplayer, lobbyCode, gameSettings);

  const purchaseGunUpgrade = () => {
    const cost = getGunUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.gunLevel < 10) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        gunLevel: prev.gunLevel + 1
      }));
    }
  };

  const purchaseFireRateUpgrade = () => {
    const cost = getFireRateUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.fireRateLevel < 10) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        fireRateLevel: prev.fireRateLevel + 1
      }));
    }
  };

  const purchaseBulletSizeUpgrade = () => {
    const cost = getBulletSizeUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.bulletSizeLevel < 10) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        bulletSizeLevel: prev.bulletSizeLevel + 1
      }));
    }
  };

  const getGunUpgradeCost = () => {
    const costs = [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285];
    return costs[gameState.gunLevel] || 300;
  };

  const getFireRateUpgradeCost = () => {
    const costs = [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210];
    return costs[gameState.fireRateLevel] || 250;
  };

  const getBulletSizeUpgradeCost = () => {
    const costs = [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335];
    return costs[gameState.bulletSizeLevel] || 375;
  };

  const getGunUpgradeText = () => {
    if (gameState.gunLevel >= 10) return "🔥 MAXED";
    const cost = getGunUpgradeCost();
    const gunNames = ['Pistol', 'Shotgun', 'SMG', 'Rifle', 'LMG', 'Plasma', 'Laser', 'Rail Gun', 'Ion Cannon', 'Annihilator'];
    const nextGun = gunNames[gameState.gunLevel] || 'Ultimate';
    return `${nextGun} - ${cost}s`;
  };

  const getFireRateUpgradeText = () => {
    if (gameState.fireRateLevel >= 10) return "⚡ MAXED";
    const cost = getFireRateUpgradeCost();
    return `Fire Rate Lv${gameState.fireRateLevel + 1} - ${cost}s`;
  };

  const getBulletSizeUpgradeText = () => {
    if (gameState.bulletSizeLevel >= 10) return "💥 MAXED";
    const cost = getBulletSizeUpgradeCost();
    return `Bullet Size Lv${gameState.bulletSizeLevel + 1} - ${cost}s`;
  };

  const canUpgradeGun = gameState.timeLeft >= getGunUpgradeCost() && gameState.gunLevel < 10;
  const canUpgradeFireRate = gameState.timeLeft >= getFireRateUpgradeCost() && gameState.fireRateLevel < 10;
  const canUpgradeBulletSize = gameState.timeLeft >= getBulletSizeUpgradeCost() && gameState.bulletSizeLevel < 10;

  const displayTime = Math.floor(gameState.timeLeft);

  const getGameModeDisplay = () => {
    switch (gameSettings?.gameMode) {
      case 'team-vs-enemies':
        return '🤝 TEAM VS ENEMIES';
      case 'team-vs-team':
        return '⚔️ TEAM VS TEAM';
      default:
        return '🏆 SURVIVAL';
    }
  };

  const showUpgrades = gameSettings?.gameMode !== 'team-vs-team';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Top UI Bar */}
      <div className="relative z-10 bg-gradient-to-r from-black/80 via-gray-900/80 to-black/80 backdrop-blur-md border-b border-cyan-400/30 p-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          
          {/* Game Mode & Timer (Center) */}
          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold mb-2">
                {getGameModeDisplay()}
              </div>
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl border-2 border-yellow-400 shadow-lg">
                <div className="text-2xl font-bold">
                  ⏱️ {displayTime}s
                </div>
              </div>
            </div>
          </div>

          {/* Upgrades (Left) - Only show in non-PvP modes */}
          <div className="flex-1 flex justify-start">
            {showUpgrades && (
              <div className="flex gap-3">
                <Button
                  onClick={purchaseGunUpgrade}
                  disabled={!canUpgradeGun}
                  className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${
                    canUpgradeGun 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black' 
                      : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  🔫 {getGunUpgradeText()}
                </Button>
                
                <Button
                  onClick={purchaseFireRateUpgrade}
                  disabled={!canUpgradeFireRate}
                  className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${
                    canUpgradeFireRate 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white' 
                      : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ⚡ {getFireRateUpgradeText()}
                </Button>
                
                <Button
                  onClick={purchaseBulletSizeUpgrade}
                  disabled={!canUpgradeBulletSize}
                  className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${
                    canUpgradeBulletSize 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white' 
                      : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  💥 {getBulletSizeUpgradeText()}
                </Button>
              </div>
            )}
          </div>

          {/* Stats (Right) */}
          <div className="flex-1 flex justify-end">
            <div className="flex items-center gap-6 text-sm">
              {gameSettings?.gameMode === 'team-vs-team' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-bold">🔴 Red:</span>
                    <span className="text-white font-bold">{gameState.teamScores?.red || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">🔵 Blue:</span>
                    <span className="text-white font-bold">{gameState.teamScores?.blue || 0}</span>
                  </div>
                </>
              )}
              
              {gameSettings?.gameMode !== 'team-vs-team' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-bold">Wave:</span>
                    <span className="text-white font-bold">{gameState.wave}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-bold">Kills:</span>
                    <span className="text-white font-bold">{gameState.enemiesKilled}</span>
                  </div>
                </>
              )}
              
              {showUpgrades && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold">Gun:</span>
                    <span className="text-white font-bold">Lv{gameState.gunLevel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 font-bold">Rate:</span>
                    <span className="text-white font-bold">Lv{gameState.fireRateLevel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-bold">Size:</span>
                    <span className="text-white font-bold">Lv{gameState.bulletSizeLevel}</span>
                  </div>
                </>
              )}
              
              {gameState.bossActive && (
                <div className="text-red-500 font-bold animate-pulse">
                  ⚠️ BOSS!
                </div>
              )}
              
              {isMultiplayer && (
                <div className="text-green-400 font-bold">
                  🌐 {lobbyCode}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full h-full bg-gray-900"
        style={{ cursor: 'none' }}
      />

      {/* Bottom Controls Info */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-black/60 text-white px-4 py-2 rounded-lg border border-cyan-400/30 backdrop-blur-sm">
          <div className="text-sm flex items-center gap-4">
            <span>⌨️ WASD - Move</span>
            <span>🖱️ Mouse - Aim & Shoot</span>
            {gameSettings?.gameMode === 'team-vs-team' ? (
              <span>⚔️ Eliminate Enemy Team</span>
            ) : gameSettings?.gameMode === 'team-vs-enemies' ? (
              <span>🤝 Work Together vs Enemies</span>
            ) : (
              <>
                <span>💰 Time = Currency</span>
                <span>🎯 Dark Enemies = More Time</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
// src/components/GameCanvas.tsx

import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import useGameLoop from '@/hooks/useGameLoop';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameSettings } from '@/types';

interface GameCanvasProps {
  onGameEnd: (score: number) => void;
  isMultiplayer?: boolean;
  isHost?: boolean;
  lobbyCode?: string;
  gameSettings: GameSettings;
  channel?: RealtimeChannel;
  playerId?: string;
}

const GameCanvas = ({ 
    onGameEnd, 
    isMultiplayer = false,
    isHost = false,
    lobbyCode, 
    gameSettings,
    channel,
    playerId
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const [gameState, setGameState] = useState({
    timeLeft: gameSettings?.gameMode === 'team-vs-team' ? 300 : 180,
    gunLevel: 1,
    fireRateLevel: 1,
    bulletSizeLevel: 1,
    enemiesKilled: 0,
    bossActive: false,
    gameStartTime: Date.now(),
    wave: 1,
    gameMode: gameSettings.gameMode,
    teamScores: { red: 0, blue: 0 },
  });

  useGameLoop({
    canvasRef,
    gameState,
    setGameState,
    onGameEnd,
    isMultiplayer,
    isHost,
    gameSettings,
    channel,
    playerId,
    setIsSpectating, // Pass setter to the loop
  });
  
  const purchaseUpgrade = (upgradeType: 'gun' | 'fireRate' | 'bulletSize') => {
      let cost = 0;
      let currentLevel = 0;
      switch (upgradeType) {
          case 'gun': 
            cost = getGunUpgradeCost();
            currentLevel = gameState.gunLevel;
            break;
          case 'fireRate':
            cost = getFireRateUpgradeCost();
            currentLevel = gameState.fireRateLevel;
            break;
          case 'bulletSize':
            cost = getBulletSizeUpgradeCost();
            currentLevel = gameState.bulletSizeLevel;
            break;
      }

      if (gameState.timeLeft < cost || currentLevel >= 10) return;

      if (isMultiplayer && isHost && channel) {
            setGameState(prev => ({
                ...prev,
                timeLeft: prev.timeLeft - cost,
                [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1
            }));
           channel.send({
                type: 'broadcast',
                event: 'purchase-upgrade',
                payload: { upgradeType, cost }
            });
      } else if (!isMultiplayer) {
            setGameState(prev => ({
                ...prev,
                timeLeft: prev.timeLeft - cost,
                [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1
            }));
      }
  };

  const purchaseGunUpgrade = () => purchaseUpgrade('gun');
  const purchaseFireRateUpgrade = () => purchaseUpgrade('fireRate');
  const purchaseBulletSizeUpgrade = () => purchaseUpgrade('bulletSize');

  const getGunUpgradeCost = () => {
    const costs = [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285];
    return costs[gameState.gunLevel] || 9999;
  };

  const getFireRateUpgradeCost = () => {
    const costs = [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210];
    return costs[gameState.fireRateLevel] || 9999;
  };

  const getBulletSizeUpgradeCost = () => {
    const costs = [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335];
    return costs[gameState.bulletSizeLevel] || 9999;
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
          {/* Upgrades (Left) or Red Score */}
          <div className="flex-1 flex justify-start">
            {showUpgrades ? (
              <div className="flex gap-3">
                <Button onClick={purchaseGunUpgrade} disabled={!canUpgradeGun || (isMultiplayer && !isHost)} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${ canUpgradeGun ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>🔫 {getGunUpgradeText()}</Button>
                <Button onClick={purchaseFireRateUpgrade} disabled={!canUpgradeFireRate || (isMultiplayer && !isHost)} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${ canUpgradeFireRate ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed' }`}>⚡ {getFireRateUpgradeText()}</Button>
                <Button onClick={purchaseBulletSizeUpgrade} disabled={!canUpgradeBulletSize || (isMultiplayer && !isHost)} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${ canUpgradeBulletSize ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed' }`}>💥 {getBulletSizeUpgradeText()}</Button>
              </div>
            ) : (
              <div className="text-2xl font-bold bg-red-900/50 border-2 border-red-600 px-4 py-1 rounded-lg">
                <span className="text-red-400">RED: {gameState.teamScores.red}</span>
              </div>
            )}
          </div>
          {/* Game Mode & Timer (Center) */}
          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold mb-2">{getGameModeDisplay()}</div>
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl border-2 border-yellow-400 shadow-lg"><div className="text-2xl font-bold">⏱️ {displayTime}s</div></div>
            </div>
          </div>
          {/* Stats (Right) or Blue Score */}
          <div className="flex-1 flex justify-end">
             {showUpgrades ? (
                <div className="flex items-center gap-6 text-sm">
                    {/* ... can add stats for PvE here if desired ... */}
                </div>
            ) : (
              <div className="text-2xl font-bold bg-blue-900/50 border-2 border-blue-600 px-4 py-1 rounded-lg">
                <span className="text-blue-400">BLUE: {gameState.teamScores.blue}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spectator Overlay */}
      {isSpectating && (
        <div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center">
          <h1 className="text-6xl font-bold text-red-500 animate-pulse">💀 YOU DIED 💀</h1>
          <p className="text-2xl text-white mt-4">Respawning soon...</p>
        </div>
      )}

      {/* Fullscreen Canvas */}
      <canvas ref={canvasRef} className="flex-1 w-full h-full bg-gray-900" style={{ cursor: 'crosshair' }} />
    </div>
  );
};

export default GameCanvas;

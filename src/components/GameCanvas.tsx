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
    kills: 0, // Used as currency in PvP, score in PvE
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
    setIsSpectating,
  });
  
  // --- Upgrade Logic ---
  const getGunUpgradeCost = () => {
    const costs = [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 25]; // Kills for PvP, Time for PvE
    return costs[gameState.gunLevel] || 9999;
  };

  const getFireRateUpgradeCost = () => {
    const costs = [0, 1, 3, 5, 7, 9, 11, 14, 17, 20, 24];
    return costs[gameState.fireRateLevel] || 9999;
  };

  const getBulletSizeUpgradeCost = () => {
    const costs = [0, 3, 5, 7, 9, 11, 13, 16, 19, 23, 26];
    return costs[gameState.bulletSizeLevel] || 9999;
  };

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
      
      const isPvp = gameSettings.gameMode === 'team-vs-team';
      const currency = isPvp ? gameState.kills : gameState.timeLeft;

      if (currency < cost || currentLevel >= 10) return;

      // Optimistic update for UI responsiveness
      setGameState(prev => {
          const newCurrency = isPvp ? prev.kills - cost : prev.timeLeft - cost;
          return {
              ...prev,
              ...(isPvp ? { kills: newCurrency } : { timeLeft: newCurrency }),
              [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1
          };
      });

      // Send event to host for authoritative update
      if (isMultiplayer && channel) {
          channel.send({
              type: 'broadcast',
              event: 'purchase-upgrade',
              payload: { upgradeType } // Host uses sender's ID and verifies cost
          });
      }
  };

  const purchaseGunUpgrade = () => purchaseUpgrade('gun');
  const purchaseFireRateUpgrade = () => purchaseUpgrade('fireRate');
  const purchaseBulletSizeUpgrade = () => purchaseUpgrade('bulletSize');

  const getUpgradeText = (type: 'gun' | 'fireRate' | 'bulletSize') => {
    const isPvp = gameSettings.gameMode === 'team-vs-team';
    const currencySymbol = isPvp ? ' kills' : 's';
    const costs = { gun: getGunUpgradeCost, fireRate: getFireRateUpgradeCost, bulletSize: getBulletSizeUpgradeCost };
    const levels = { gun: gameState.gunLevel, fireRate: gameState.fireRateLevel, bulletSize: gameState.bulletSizeLevel };
    
    if (levels[type] >= 10) return "MAXED";
    
    const cost = costs[type]();
    let name = '';
    if (type === 'gun') {
        const gunNames = ['Pistol', 'Shotgun', 'SMG', 'Rifle', 'LMG', 'Plasma', 'Laser', 'Rail Gun', 'Ion Cannon', 'Annihilator'];
        name = gunNames[levels.gun] || 'Ultimate';
    } else if (type === 'fireRate') {
        name = `Fire Rate Lv${levels.fireRate + 1}`;
    } else {
        name = `Bullet Size Lv${levels.bulletSize + 1}`;
    }
    return `${name} - ${cost}${currencySymbol}`;
  };

  const canUpgrade = (type: 'gun' | 'fireRate' | 'bulletSize') => {
    const isPvp = gameSettings.gameMode === 'team-vs-team';
    const currency = isPvp ? gameState.kills : gameState.timeLeft;
    const costs = { gun: getGunUpgradeCost(), fireRate: getFireRateUpgradeCost(), bulletSize: getBulletSizeUpgradeCost() };
    const levels = { gun: gameState.gunLevel, fireRate: gameState.fireRateLevel, bulletSize: gameState.bulletSizeLevel };
    return currency >= costs[type] && levels[type] < 10;
  };
  
  const canUpgradeGun = canUpgrade('gun');
  const canUpgradeFireRate = canUpgrade('fireRate');
  const canUpgradeBulletSize = canUpgrade('bulletSize');
  
  const displayTime = Math.floor(gameState.timeLeft);

  const getGameModeDisplay = () => {
    switch (gameSettings?.gameMode) {
      case 'team-vs-enemies': return '🤝 TEAM VS ENEMIES';
      case 'team-vs-team': return '⚔️ TEAM VS TEAM (PvPvE)';
      default: return '🏆 SURVIVAL';
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Top UI Bar */}
      <div className="relative z-10 bg-gradient-to-r from-black/80 via-gray-900/80 to-black/80 backdrop-blur-md border-b border-cyan-400/30 p-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex-1 flex justify-start">
             {gameSettings.gameMode === 'team-vs-team' && (
              <div className="text-2xl font-bold bg-red-900/50 border-2 border-red-600 px-4 py-1 rounded-lg">
                <span className="text-red-400">RED: {gameState.teamScores.red}</span>
              </div>
            )}
          </div>
          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold mb-2">{getGameModeDisplay()}</div>
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl border-2 border-yellow-400 shadow-lg">
                  <div className="text-2xl font-bold">⏱️ {displayTime}s</div>
              </div>
              {gameSettings.gameMode === 'team-vs-team' && (
                <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-4 py-1 rounded-lg text-sm font-bold mt-2 border border-gray-500">
                    💰 Kills: {gameState.kills}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 flex justify-end">
            {gameSettings.gameMode === 'team-vs-team' && (
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

      {/* Bottom Upgrade Bar */}
       <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent backdrop-blur-sm p-4">
        <div className="flex items-center justify-center gap-3 max-w-screen-md mx-auto bg-black/50 p-3 rounded-xl border border-cyan-500/30">
            <Button onClick={purchaseGunUpgrade} disabled={!canUpgradeGun} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${ canUpgradeGun ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>🔫 {getUpgradeText('gun')}</Button>
            <Button onClick={purchaseFireRateUpgrade} disabled={!canUpgradeFireRate} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${ canUpgradeFireRate ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed' }`}>⚡ {getUpgradeText('fireRate')}</Button>
            <Button onClick={purchaseBulletSizeUpgrade} disabled={!canUpgradeBulletSize} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${ canUpgradeBulletSize ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed' }`}>💥 {getUpgradeText('bulletSize')}</Button>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;

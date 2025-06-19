import React, { useRef, useState, useLayoutEffect } from 'react';
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
    onGameEnd, isMultiplayer = false, isHost = false,
    lobbyCode, gameSettings, channel, playerId
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const [gameState, setGameState] = useState({
    timeLeft: gameSettings?.gameMode === 'team-vs-team' ? 300 : 180,
    gunLevel: 1, fireRateLevel: 1, bulletSizeLevel: 1,
    enemiesKilled: 0, bossActive: false, gameStartTime: Date.now(),
    wave: 1, gameMode: gameSettings.gameMode, teamScores: { red: 0, blue: 0 },
  });

  // Fixes the "zoom" issue by setting canvas dimensions before the first paint
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }, []);

  useGameLoop({
    canvasRef, gameState, setGameState, onGameEnd, isMultiplayer,
    isHost, gameSettings, channel, playerId, setIsSpectating,
  });
  
  const purchaseUpgrade = (upgradeType: 'gun' | 'fireRate' | 'bulletSize') => {
      let cost = 0, currentLevel = 0;
      if (upgradeType === 'gun') { cost = getGunUpgradeCost(); currentLevel = gameState.gunLevel; }
      if (upgradeType === 'fireRate') { cost = getFireRateUpgradeCost(); currentLevel = gameState.fireRateLevel; }
      if (upgradeType === 'bulletSize') { cost = getBulletSizeUpgradeCost(); currentLevel = gameState.bulletSizeLevel; }

      const canAfford = gameState.timeLeft >= cost && currentLevel < 10;
      if (!canAfford) return;

      if (isMultiplayer && isHost && channel) {
           // Host sends the event, and all players (including host) will update state via the listener
           channel.send({ type: 'broadcast', event: 'purchase-upgrade', payload: { upgradeType, cost } });
      } else if (!isMultiplayer) {
           setGameState(prev => ({ ...prev, timeLeft: prev.timeLeft - cost, [`${upgradeType}Level`]: prev[`${upgradeType}Level`] + 1 }));
      }
  };

  const purchaseGunUpgrade = () => purchaseUpgrade('gun');
  const purchaseFireRateUpgrade = () => purchaseUpgrade('fireRate');
  const purchaseBulletSizeUpgrade = () => purchaseUpgrade('bulletSize');
  const getGunUpgradeCost = () => [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285][gameState.gunLevel] || 999;
  const getFireRateUpgradeCost = () => [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210][gameState.fireRateLevel] || 999;
  const getBulletSizeUpgradeCost = () => [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335][gameState.bulletSizeLevel] || 999;
  const getGunUpgradeText = () => gameState.gunLevel >= 10 ? "🔥 MAXED" : `${['Pistol', 'Shotgun', 'SMG', 'Rifle', 'LMG', 'Plasma', 'Laser', 'Rail Gun', 'Ion Cannon', 'Annihilator'][gameState.gunLevel] || 'Ultimate'} - ${getGunUpgradeCost()}s`;
  const getFireRateUpgradeText = () => gameState.fireRateLevel >= 10 ? "⚡ MAXED" : `Fire Rate Lv${gameState.fireRateLevel + 1} - ${getFireRateUpgradeCost()}s`;
  const getBulletSizeUpgradeText = () => gameState.bulletSizeLevel >= 10 ? "💥 MAXED" : `Bullet Size Lv${gameState.bulletSizeLevel + 1} - ${getBulletSizeUpgradeCost()}s`;
  const canUpgradeGun = gameState.timeLeft >= getGunUpgradeCost() && gameState.gunLevel < 10;
  const canUpgradeFireRate = gameState.timeLeft >= getFireRateUpgradeCost() && gameState.fireRateLevel < 10;
  const canUpgradeBulletSize = gameState.timeLeft >= getBulletSizeUpgradeCost() && gameState.bulletSizeLevel < 10;
  const displayTime = Math.floor(gameState.timeLeft);
  const getGameModeDisplay = () => ({'team-vs-enemies': '🤝 TEAM VS ENEMIES', 'team-vs-team': '⚔️ TEAM VS TEAM', 'survival': '🏆 SURVIVAL'})[gameSettings?.gameMode] || 'SURVIVAL';
  const showUpgrades = gameSettings?.gameMode !== 'team-vs-team';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      <div className="relative z-10 bg-gradient-to-r from-black/80 via-gray-900/80 to-black/80 backdrop-blur-md border-b border-cyan-400/30 p-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex-1 flex justify-start">{showUpgrades && <div className="flex gap-3"><Button onClick={purchaseGunUpgrade} disabled={!canUpgradeGun || (isMultiplayer && !isHost)} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${canUpgradeGun ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-black' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>🔫 {getGunUpgradeText()}</Button><Button onClick={purchaseFireRateUpgrade} disabled={!canUpgradeFireRate || (isMultiplayer && !isHost)} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${canUpgradeFireRate ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>⚡ {getFireRateUpgradeText()}</Button><Button onClick={purchaseBulletSizeUpgrade} disabled={!canUpgradeBulletSize || (isMultiplayer && !isHost)} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${canUpgradeBulletSize ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>💥 {getBulletSizeUpgradeText()}</Button></div>}</div>
          <div className="flex-1 flex justify-center"><div className="text-center"><div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold mb-2">{getGameModeDisplay()}</div><div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl border-2 border-yellow-400 shadow-lg"><div className="text-2xl font-bold">⏱️ {displayTime}s</div></div></div></div>
          <div className="flex-1 flex justify-end"><div className="flex items-center gap-6 text-sm">{/* stats... */}</div></div>
        </div>
      </div>
      {isSpectating && (<div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center"><h1 className="text-6xl font-bold text-red-500 animate-pulse">💀 YOU ARE DEAD 💀</h1><p className="text-2xl text-white mt-4">Spectating team...</p></div>)}
      <canvas ref={canvasRef} className="flex-1 w-full h-full" style={{ background: '#0a0a10', cursor: isSpectating ? 'default' : 'none' }} />
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10"><div className="bg-black/60 text-white px-4 py-2 rounded-lg border border-cyan-400/30 backdrop-blur-sm"><div className="text-sm flex items-center gap-4"><span>⌨️ WASD - Move</span><span>🖱️ Mouse - Aim & Shoot</span></div></div></div>
    </div>
  );
};
export default GameCanvas;

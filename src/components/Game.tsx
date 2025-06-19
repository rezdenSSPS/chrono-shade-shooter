import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import useGameLoop from '@/hooks/useGameLoop';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameSettings, GameUIState } from '@/types';

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
  const [uiState, setUiState] = useState<GameUIState>({
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

  const [placement, setPlacement] = useState<number | null>(null);
  const isSpectating = placement !== null;

  useGameLoop({
    canvasRef,
    gameState: uiState,
    setGameState: setUiState,
    onGameEnd,
    isMultiplayer,
    isHost,
    gameSettings,
    channel,
    playerId,
    setPlacement,
  });

  const purchaseUpgrade = (upgradeType: 'gun' | 'fireRate' | 'bulletSize') => {
    if (isMultiplayer && channel) {
      channel.send({
        type: 'broadcast',
        event: 'request-upgrade',
        payload: { upgradeType }
      });
    } else { // Single Player
      const costMap: Record<string, number[]> = {
        gun: [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285],
        fireRate: [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210],
        bulletSize: [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335],
      };
      const levelKey = `${upgradeType}Level` as 'gunLevel' | 'fireRateLevel' | 'bulletSizeLevel';
      const currentLevel = uiState[levelKey] as number;
      const cost = costMap[upgradeType][currentLevel];
      if (uiState.timeLeft >= cost && currentLevel < 10) {
        setUiState(prev => ({ ...prev, timeLeft: prev.timeLeft - cost, [levelKey]: currentLevel + 1 }));
      }
    }
  };

  const getGunUpgradeCost = () => {
    const costs = [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285];
    return costs[uiState.gunLevel] || 300;
  };

  const getFireRateUpgradeCost = () => {
    const costs = [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210];
    return costs[uiState.fireRateLevel] || 250;
  };

  const getBulletSizeUpgradeCost = () => {
    const costs = [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335];
    return costs[uiState.bulletSizeLevel] || 375;
  };

  const getGunUpgradeText = () => {
    if (uiState.gunLevel >= 10) return "🔥 MAXED";
    const cost = getGunUpgradeCost();
    const gunNames = ['Pistol', 'Shotgun', 'SMG', 'Rifle', 'LMG', 'Plasma', 'Laser', 'Rail Gun', 'Ion Cannon', 'Annihilator'];
    const nextGun = gunNames[uiState.gunLevel] || 'Ultimate';
    return `${nextGun} - ${cost}s`;
  };

  const getFireRateUpgradeText = () => {
    if (uiState.fireRateLevel >= 10) return "⚡ MAXED";
    const cost = getFireRateUpgradeCost();
    return `Fire Rate Lv${uiState.fireRateLevel + 1} - ${cost}s`;
  };

  const getBulletSizeUpgradeText = () => {
    if (uiState.bulletSizeLevel >= 10) return "💥 MAXED";
    const cost = getBulletSizeUpgradeCost();
    return `Bullet Size Lv${uiState.bulletSizeLevel + 1} - ${cost}s`;
  };

  const canUpgradeGun = uiState.timeLeft >= getGunUpgradeCost() && uiState.gunLevel < 10;
  const canUpgradeFireRate = uiState.timeLeft >= getFireRateUpgradeCost() && uiState.fireRateLevel < 10;
  const canUpgradeBulletSize = uiState.timeLeft >= getBulletSizeUpgradeCost() && uiState.bulletSizeLevel < 10;
  const displayTime = Math.floor(uiState.timeLeft);
  const getGameModeDisplay = () => {
    switch (gameSettings?.gameMode) {
      case 'team-vs-enemies': return '🤝 TEAM VS ENEMIES';
      case 'team-vs-team': return '⚔️ TEAM VS TEAM';
      default: return '🏆 SURVIVAL';
    }
  };
  const showUpgrades = gameSettings?.gameMode !== 'team-vs-team';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      <div className="relative z-10 bg-gradient-to-r from-black/80 via-gray-900/80 to-black/80 backdrop-blur-md border-b border-cyan-400/30 p-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex-1 flex justify-start">
            {showUpgrades && (
              <div className="flex gap-3">
                <Button onClick={() => purchaseUpgrade('gun')} disabled={!canUpgradeGun} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${canUpgradeGun ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>
                  🔫 {getGunUpgradeText()}
                </Button>
                <Button onClick={() => purchaseUpgrade('fireRate')} disabled={!canUpgradeFireRate} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${canUpgradeFireRate ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>
                  ⚡ {getFireRateUpgradeText()}
                </Button>
                <Button onClick={() => purchaseUpgrade('bulletSize')} disabled={!canUpgradeBulletSize} className={`text-xs px-3 py-2 rounded-lg font-bold transition-all ${canUpgradeBulletSize ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white' : 'bg-gray-700/70 text-gray-400 cursor-not-allowed'}`}>
                  💥 {getBulletSizeUpgradeText()}
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold mb-2">{getGameModeDisplay()}</div>
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl border-2 border-yellow-400 shadow-lg">
                <div className="text-2xl font-bold">⏱️ {displayTime}s</div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-end">
            <div className="flex items-center gap-6 text-sm">
              {gameSettings?.gameMode === 'team-vs-team' ? (
                <>
                  <div className="flex items-center gap-2"><span className="text-red-400 font-bold">🔴 Red:</span><span className="text-white font-bold">{uiState.teamScores?.red || 0}</span></div>
                  <div className="flex items-center gap-2"><span className="text-blue-400 font-bold">🔵 Blue:</span><span className="text-white font-bold">{uiState.teamScores?.blue || 0}</span></div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2"><span className="text-purple-400 font-bold">Wave:</span><span className="text-white font-bold">{uiState.wave}</span></div>
                  <div className="flex items-center gap-2"><span className="text-red-400 font-bold">Kills:</span><span className="text-white font-bold">{uiState.enemiesKilled}</span></div>
                </>
              )}
              {showUpgrades && (
                <>
                  <div className="flex items-center gap-2"><span className="text-green-400 font-bold">Gun:</span><span className="text-white font-bold">Lv{uiState.gunLevel}</span></div>
                  <div className="flex items-center gap-2"><span className="text-orange-400 font-bold">Rate:</span><span className="text-white font-bold">Lv{uiState.fireRateLevel}</span></div>
                  <div className="flex items-center gap-2"><span className="text-purple-400 font-bold">Size:</span><span className="text-white font-bold">Lv{uiState.bulletSizeLevel}</span></div>
                </>
              )}
              {uiState.bossActive && <div className="text-red-500 font-bold animate-pulse">⚠️ BOSS!</div>}
              {isMultiplayer && <div className="text-green-400 font-bold">🌐 {lobbyCode}</div>}
            </div>
          </div>
        </div>
      </div>
      {isSpectating && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 text-white pointer-events-none">
          <h1 className="text-7xl font-bold text-red-500 animate-pulse">YOU DIED</h1>
          <p className="text-4xl mt-4">You placed #{placement}</p>
          <p className="text-xl mt-2 text-gray-300">Spectating remaining players...</p>
        </div>
      )}
      <canvas ref={canvasRef} className="flex-1 w-full h-full bg-gray-900" style={{ cursor: isSpectating ? 'default' : 'none' }} />
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-black/60 text-white px-4 py-2 rounded-lg border border-cyan-400/30 backdrop-blur-sm">
          <div className="text-sm flex items-center gap-4">
            <span>⌨️ WASD - Move</span>
            <span>🖱️ Mouse - Aim & Shoot</span>
            {gameSettings?.gameMode === 'team-vs-team' ? (<span>⚔️ Eliminate Enemy Team</span>) :
              gameSettings?.gameMode === 'team-vs-enemies' ? (<span>🤝 Work Together vs Enemies</span>) :
                (<><span>💰 Time = Currency</span><span>🎯 Dark Enemies = More Time</span></>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;

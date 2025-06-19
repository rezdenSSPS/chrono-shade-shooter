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
        const costMap = {
            gun: [0, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285],
            fireRate: [0, 10, 18, 28, 42, 60, 82, 108, 138, 172, 210],
            bulletSize: [0, 20, 35, 55, 80, 110, 145, 185, 230, 280, 335],
        };
        const levelKey = `${upgradeType}Level` as keyof GameUIState;
        const currentLevel = uiState[levelKey] as number;
        const cost = costMap[upgradeType][currentLevel];
        if (uiState.timeLeft >= cost && currentLevel < 10) {
            setUiState(prev => ({ ...prev, timeLeft: prev.timeLeft - cost, [levelKey]: currentLevel + 1 }));
        }
    }
  };

  const getGunUpgradeCost = () => { /* ... same as before */ return 0; };
  const getFireRateUpgradeCost = () => { /* ... same as before */ return 0; };
  const getBulletSizeUpgradeCost = () => { /* ... same as before */ return 0; };
  const getGunUpgradeText = () => { /* ... same as before */ return ""};
  const getFireRateUpgradeText = () => { /* ... same as before */ return ""};
  const getBulletSizeUpgradeText = () => { /* ... same as before */ return ""};

  const canUpgradeGun = uiState.timeLeft >= getGunUpgradeCost() && uiState.gunLevel < 10;
  const canUpgradeFireRate = uiState.timeLeft >= getFireRateUpgradeCost() && uiState.fireRateLevel < 10;
  const canUpgradeBulletSize = uiState.timeLeft >= getBulletSizeUpgradeCost() && uiState.bulletSizeLevel < 10;
  const displayTime = Math.floor(uiState.timeLeft);
  const getGameModeDisplay = () => { /* ... same as before */ return "" };
  const showUpgrades = gameSettings?.gameMode !== 'team-vs-team';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Top UI Bar */}
      <div className="relative z-10 ...">
        {/* ... All your UI Bar JSX ... */}
      </div>

      {/* "You Died" Overlay */}
      {isSpectating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 text-white pointer-events-none">
              <h1 className="text-7xl font-bold text-red-500 animate-pulse">YOU DIED</h1>
              <p className="text-4xl mt-4">You placed #{placement}</p>
              <p className="text-xl mt-2 text-gray-300">Spectating remaining players...</p>
          </div>
      )}

      <canvas ref={canvasRef} className="flex-1 w-full h-full bg-gray-900" style={{ cursor: isSpectating ? 'default' : 'none' }} />
      
      {/* ... Bottom Controls Info ... */}
    </div>
  );
};

export default GameCanvas;

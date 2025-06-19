
import React, { useRef, useEffect, useState } from 'react';
import { Button } from './ui/button';
import useGameLoop from '@/hooks/useGameLoop';

interface GameCanvasProps {
  onGameEnd: (score: number) => void;
}

const GameCanvas = ({ onGameEnd }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState({
    timeLeft: 60,
    gunLevel: 1,
    enemiesKilled: 0,
    bossActive: false,
    gameStartTime: Date.now()
  });

  const gameLoop = useGameLoop(canvasRef, gameState, setGameState, onGameEnd);

  const purchaseUpgrade = () => {
    const cost = getUpgradeCost();
    if (gameState.timeLeft >= cost && gameState.gunLevel < 5) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - cost,
        gunLevel: prev.gunLevel + 1
      }));
    }
  };

  const getUpgradeCost = () => {
    const costs = [0, 15, 25, 35, 50]; // Level 1 is free, then increasing costs
    return costs[gameState.gunLevel] || 50;
  };

  const getUpgradeText = () => {
    if (gameState.gunLevel >= 5) return "MAX LEVEL REACHED";
    const cost = getUpgradeCost();
    const gunNames = ['Pistol', 'Dual Pistols', 'Shotgun', 'Assault Rifle', 'Plasma Cannon'];
    const nextGun = gunNames[gameState.gunLevel] || 'Ultimate Weapon';
    return `UPGRADE TO ${nextGun.toUpperCase()} - ${cost}s`;
  };

  const canUpgrade = gameState.timeLeft >= getUpgradeCost() && gameState.gunLevel < 5;

  const displayTime = Math.floor(gameState.timeLeft);

  return (
    <div className="flex flex-col items-center bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen py-4">
      {/* Enhanced HUD */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white p-6 mb-4 rounded-xl border-2 border-cyan-400 shadow-2xl">
        <div className="flex space-x-8 text-xl font-bold">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
            <span>Time: <span className="text-yellow-400 text-2xl">{displayTime}s</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
            <span>Gun: <span className="text-blue-400">Level {gameState.gunLevel}</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span>Kills: <span className="text-red-400">{gameState.enemiesKilled}</span></span>
          </div>
          {gameState.bossActive && (
            <div className="flex items-center space-x-2 animate-pulse">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-red-500 font-bold text-xl">⚠️ BOSS FIGHT!</span>
            </div>
          )}
        </div>
      </div>

      {/* Game Canvas with glow effect */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border-4 border-cyan-400 bg-gray-900 shadow-2xl shadow-cyan-400/30"
          style={{ cursor: 'crosshair' }}
        />
        <div className="absolute inset-0 border-4 border-cyan-400 rounded-lg shadow-2xl shadow-cyan-400/50 pointer-events-none"></div>
      </div>

      {/* Enhanced Upgrade Button */}
      <div className="mt-6">
        <Button
          onClick={purchaseUpgrade}
          disabled={!canUpgrade}
          className={`text-lg px-8 py-4 rounded-xl font-bold transform transition-all duration-200 ${
            canUpgrade 
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-xl hover:scale-105 hover:shadow-2xl' 
              : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
          }`}
        >
          {getUpgradeText()}
        </Button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-cyan-300 text-lg font-semibold">🎯 Hunt dark enemies for maximum time bonus!</p>
        <p className="text-purple-300 text-sm">💀 Boss spawns every 60 seconds • WASD to move • Mouse to aim & shoot</p>
      </div>
    </div>
  );
};

export default GameCanvas;

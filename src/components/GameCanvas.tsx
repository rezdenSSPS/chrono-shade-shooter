
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
    bossActive: false
  });

  const gameLoop = useGameLoop(canvasRef, gameState, setGameState, onGameEnd);

  const purchaseUpgrade = () => {
    if (gameState.timeLeft >= 15 && gameState.gunLevel < 3) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - 15,
        gunLevel: prev.gunLevel + 1
      }));
    }
  };

  const getUpgradeText = () => {
    if (gameState.gunLevel >= 3) return "MAX LEVEL";
    return `UPGRADE GUN (${gameState.gunLevel} → ${gameState.gunLevel + 1}) - 15s`;
  };

  const canUpgrade = gameState.timeLeft >= 15 && gameState.gunLevel < 3;

  return (
    <div className="flex flex-col items-center">
      {/* HUD */}
      <div className="bg-black text-white p-4 mb-4 rounded-lg border border-white">
        <div className="flex space-x-8 text-lg">
          <div>Time: <span className="font-bold text-yellow-400">{gameState.timeLeft}s</span></div>
          <div>Gun Level: <span className="font-bold text-blue-400">{gameState.gunLevel}</span></div>
          <div>Kills: <span className="font-bold text-red-400">{gameState.enemiesKilled}</span></div>
          {gameState.bossActive && <div className="text-red-500 font-bold">BOSS FIGHT!</div>}
        </div>
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-2 border-white bg-gray-900"
        style={{ cursor: 'crosshair' }}
      />

      {/* Upgrade Button */}
      <div className="mt-4">
        <Button
          onClick={purchaseUpgrade}
          disabled={!canUpgrade}
          className={`text-lg px-6 py-3 ${
            canUpgrade 
              ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {getUpgradeText()}
        </Button>
      </div>

      <div className="mt-4 text-white text-center">
        <p className="text-sm">Kill dark enemies for more time!</p>
        <p className="text-xs text-gray-400">Boss appears every 60 seconds</p>
      </div>
    </div>
  );
};

export default GameCanvas;

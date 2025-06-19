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
    onGameEnd, 
    isMultiplayer = false, 
    isHost = false,
    lobbyCode, 
    gameSettings,
    channel,
    playerId
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpectating, setIsSpectating] = useState(false); // We need this state here for the UI
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

  // This hook is essential to fix the canvas zoom/sizing issue.
  // It runs before the browser paints, ensuring the canvas has the correct dimensions from the start.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }, []);

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
    setIsSpectating, // Pass the setter to the hook
  });

  const getGameModeDisplay = () => {
    switch (gameSettings?.gameMode) {
      case 'team-vs-enemies': return '🤝 TEAM VS ENEMIES';
      case 'team-vs-team': return '⚔️ TEAM VS TEAM';
      default: return '🏆 SURVIVAL';
    }
  };
  
  const displayTime = Math.floor(gameState.timeLeft);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      <div className="relative z-10 bg-gradient-to-r from-black/80 via-gray-900/80 to-black/80 backdrop-blur-md border-b border-cyan-400/30 p-4">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
              <div className="flex-1 flex justify-start">{/* Upgrades can be added back here */}</div>
              <div className="flex-1 flex justify-center">
                  <div className="text-center">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold mb-2">{getGameModeDisplay()}</div>
                      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl border-2 border-yellow-400 shadow-lg"><div className="text-2xl font-bold">⏱️ {displayTime}s</div></div>
                  </div>
              </div>
              <div className="flex-1 flex justify-end">{/* Stats can be added back here */}</div>
          </div>
      </div>

      {isSpectating && (
        <div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center">
          <h1 className="text-6xl font-bold text-red-500 animate-pulse">💀 YOU ARE DEAD 💀</h1>
          <p className="text-2xl text-white mt-4">Spectating team...</p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="flex-1 w-full h-full"
        style={{ background: '#0a0a10', cursor: isSpectating ? 'default' : 'none' }}
      />
    </div>
  );
};

export default GameCanvas;

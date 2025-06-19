
import React from 'react';
import { Button } from './ui/button';

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
}

const MainMenu = ({ onStartGame, onShowLeaderboard }: MainMenuProps) => {
  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
      <div className="bg-black/60 p-12 rounded-3xl border-2 border-cyan-400 shadow-2xl">
        <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
          ⚔️ TIME HUNTER ⚔️
        </h1>
        <p className="text-2xl mb-8 text-cyan-300 font-semibold">
          🎯 Hunt dark silhouettes to survive longer!
        </p>
        <p className="text-lg mb-12 text-purple-300">
          💀 Darker enemies = More survival time • 🔫 Upgrade your arsenal • 👹 Face epic bosses
        </p>
        
        <div className="space-y-6">
          <Button 
            onClick={onStartGame}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black text-3xl px-12 py-6 rounded-2xl font-bold transform hover:scale-110 transition-all shadow-2xl"
            size="lg"
          >
            🚀 START HUNTING
          </Button>
          <br />
          <Button 
            onClick={onShowLeaderboard}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xl px-8 py-4 rounded-xl font-bold transform hover:scale-105 transition-all"
          >
            🏆 HALL OF HEROES
          </Button>
        </div>
        
        <div className="mt-8 text-lg text-gray-300">
          <p className="mb-2">🎮 <strong>Controls:</strong></p>
          <p>⌨️ WASD to move • 🖱️ Mouse to aim & shoot • 💰 Spend time for upgrades</p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;


import React from 'react';
import { Button } from './ui/button';

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
}

const MainMenu = ({ onStartGame, onShowLeaderboard }: MainMenuProps) => {
  return (
    <div className="text-center text-white">
      <h1 className="text-6xl font-bold mb-8 text-white">TIME HUNTER</h1>
      <p className="text-xl mb-8 text-gray-300">
        Hunt enemies to gain time. Darker enemies = more time!
      </p>
      <div className="space-y-4">
        <Button 
          onClick={onStartGame}
          className="bg-white text-black hover:bg-gray-200 text-xl px-8 py-4"
          size="lg"
        >
          START GAME
        </Button>
        <br />
        <Button 
          onClick={onShowLeaderboard}
          variant="outline"
          className="border-white text-white hover:bg-white hover:text-black text-lg px-6 py-3"
        >
          LEADERBOARD
        </Button>
      </div>
      <div className="mt-8 text-sm text-gray-400">
        <p>WASD to move • Mouse to aim and shoot</p>
      </div>
    </div>
  );
};

export default MainMenu;

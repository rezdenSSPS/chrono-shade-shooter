
import React, { useState } from 'react';
import GameCanvas from './GameCanvas';
import GameOverScreen from './GameOverScreen';
import LeaderboardScreen from './LeaderboardScreen';
import MainMenu from './MainMenu';

export type GameState = 'menu' | 'playing' | 'gameOver' | 'leaderboard';

const Game = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [finalScore, setFinalScore] = useState(0);

  const startGame = () => setGameState('playing');
  const showLeaderboard = () => setGameState('leaderboard');
  const backToMenu = () => setGameState('menu');
  
  const endGame = (score: number) => {
    setFinalScore(score);
    setGameState('gameOver');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {gameState === 'menu' && (
        <MainMenu onStartGame={startGame} onShowLeaderboard={showLeaderboard} />
      )}
      
      {gameState === 'playing' && (
        <GameCanvas onGameEnd={endGame} />
      )}
      
      {gameState === 'gameOver' && (
        <GameOverScreen 
          score={finalScore} 
          onBackToMenu={backToMenu}
          onShowLeaderboard={showLeaderboard}
        />
      )}
      
      {gameState === 'leaderboard' && (
        <LeaderboardScreen onBackToMenu={backToMenu} />
      )}
    </div>
  );
};

export default Game;

import React, { useState } from 'react';
import GameCanvas from './GameCanvas';
import GameOverScreen from './GameOverScreen';
import LeaderboardScreen from './LeaderboardScreen';
import MainMenu from './MainMenu';
import MultiplayerLobby from './MultiplayerLobby';

export type GameState = 'menu' | 'playing' | 'gameOver' | 'leaderboard' | 'multiplayerLobby' | 'multiplayerGame';

interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

const Game = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [finalScore, setFinalScore] = useState(0);
  const [lobbyCode, setLobbyCode] = useState('');
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    enemyCount: 1,
    enemySpeed: 1,
    enemyDamage: 1,
    gameMode: 'survival'
  });

  const startGame = () => setGameState('playing');
  const startMultiplayer = () => setGameState('multiplayerLobby');
  const showLeaderboard = () => setGameState('leaderboard');
  const backToMenu = () => setGameState('menu');

  const endGame = (score: number) => {
    setFinalScore(score);
    setGameState('gameOver');
  };

  const startMultiplayerGame = (code: string, settings: GameSettings) => {
    setLobbyCode(code);
    setGameSettings(settings);
    setGameState('multiplayerGame');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {gameState === 'menu' && (
        <MainMenu 
          onStartGame={startGame} 
          onShowLeaderboard={showLeaderboard}
          onStartMultiplayer={startMultiplayer}
        />
      )}
      
      {gameState === 'playing' && (
        <GameCanvas onGameEnd={endGame} />
      )}
      
      {gameState === 'multiplayerLobby' && (
        <MultiplayerLobby 
          onStartGame={startMultiplayerGame}
          onBackToMenu={backToMenu}
        />
      )}
      
      {gameState === 'multiplayerGame' && (
        <GameCanvas 
          onGameEnd={endGame} 
          isMultiplayer={true}
          lobbyCode={lobbyCode}
          gameSettings={gameSettings}
        />
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

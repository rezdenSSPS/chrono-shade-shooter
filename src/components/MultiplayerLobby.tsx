import React, { useState } from 'react';
import { Button } from './ui/button';
import type { GameSettings, Player } from '@/types';

interface MultiplayerLobbyProps {
  lobbyState: {
    code: string;
    isHost: boolean;
    isConnected: boolean;
    players: Player[];
    settings: GameSettings;
  };
  onCreateLobby: () => void;
  onJoinLobby: (code: string) => void;
  onUpdateSettings: (settings: GameSettings) => void;
  onStartGame: () => void;
  onBackToMenu: () => void;
}

const MultiplayerLobby = ({
  lobbyState,
  onCreateLobby,
  onJoinLobby,
  onUpdateSettings,
  onStartGame,
  onBackToMenu
}: MultiplayerLobbyProps) => {
  const [inputCode, setInputCode] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  const handleJoin = () => {
    if (inputCode.length === 6) onJoinLobby(inputCode);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleJoin();
  };

  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
      <div className="bg-black/60 p-8 rounded-3xl border-2 border-cyan-400 shadow-2xl max-w-md w-full">
        <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          🌐 MULTIPLAYER LOBBY
        </h2>
        
        {!lobbyState.code ? (
          <div className="space-y-4">
            <Button onClick={onCreateLobby} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black text-xl px-6 py-4 rounded-xl font-bold">
              🎮 CREATE LOBBY
            </Button>
            <div className="text-center text-gray-400">OR</div>
            <input 
              type="text" 
              placeholder="Enter 6-digit code" 
              value={inputCode} 
              onChange={handleInputChange} 
              onKeyPress={handleKeyPress} 
              className="w-full bg-gray-800 border-2 border-gray-600 text-white px-4 py-3 rounded-xl text-center font-mono text-lg tracking-wider"
              maxLength={6}
            />
            <Button onClick={handleJoin} disabled={inputCode.length !== 6} className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white text-xl px-6 py-4 rounded-xl font-bold disabled:opacity-50">
              🚪 JOIN LOBBY
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 text-black p-4 rounded-xl">
              <div className="text-lg font-bold">Lobby Code:</div>
              <div className="text-3xl font-mono font-bold tracking-wider">{lobbyState.code}</div>
            </div>
            
            {!lobbyState.isConnected && <div className="text-yellow-400 animate-pulse">Connecting...</div>}

            <div className="text-left">
              <h3 className="text-xl font-bold text-cyan-400 mb-3">Connected Players ({lobbyState.players.length})</h3>
              <div className="bg-gray-800 p-3 rounded-lg min-h-[60px]">
                {lobbyState.players.map((player) => (
                  <div key={player.id} className="text-green-400">
                    Player: {player.id.substring(0,6)} {player.role === 'host' && '(Host)'}
                  </div>
                ))}
              </div>
            </div>
            
            {lobbyState.isHost && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-purple-400">⚙️ Game Settings</h3>
                <div className="space-y-3">
                   <div className="space-y-2">
                     <span className="text-cyan-400 font-bold">Game Mode:</span>
                     <select value={lobbyState.settings.gameMode} onChange={(e) => onUpdateSettings({ ...lobbyState.settings, gameMode: e.target.value as GameSettings['gameMode'] })} className="w-full bg-gray-800 border-2 border-gray-600 text-white px-3 py-2 rounded-lg">
                       <option value="team-vs-enemies">🤝 Team vs Enemies</option>
                       <option value="team-vs-team">⚔️ Team vs Team</option>
                     </select>
                   </div>
                </div>
                <Button onClick={onStartGame} disabled={!lobbyState.isConnected} className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white text-xl px-6 py-4 rounded-xl font-bold disabled:opacity-50">
                  🚀 START GAME
                </Button>
              </div>
            )}
             {!lobbyState.isHost && lobbyState.isConnected && <div className="text-cyan-300">Waiting for host to start the game...</div>}
          </div>
        )}
        
        <Button onClick={onBackToMenu} className="mt-6 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl">
          ← Back to Menu
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerLobby;

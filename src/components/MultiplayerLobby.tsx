// src/components/MultiplayerLobby.tsx

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import type { GameSettings, Player } from '@/types';

interface MultiplayerLobbyProps {
  lobbyCode: string;
  isHost: boolean;
  connectedPlayers: Player[];
  gameSettings: GameSettings;
  onCreateLobby: () => void;
  onJoinLobby: (code: string) => void;
  onUpdateSettings: (settings: GameSettings) => void;
  onStartGame: () => void;
  onBackToMenu: () => void;
}

const MultiplayerLobby = ({
  lobbyCode,
  isHost,
  connectedPlayers,
  gameSettings,
  onCreateLobby,
  onJoinLobby,
  onUpdateSettings,
  onStartGame,
  onBackToMenu
}: MultiplayerLobbyProps) => {
  const [inputCode, setInputCode] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setInputCode(value);
  };

  const handleJoin = () => {
    if (inputCode.length === 6) {
      onJoinLobby(inputCode);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  // UPDATE: Extracted settings UI into a reusable component
  const GameSettingsDisplay = ({ readOnly }: { readOnly: boolean }) => (
    <div className="space-y-4 text-left p-4 bg-gray-900/50 rounded-lg">
      <h3 className="text-xl font-bold text-purple-400 text-center mb-4">⚙️ Game Settings</h3>
      <div className="space-y-6">
         <div className="space-y-2">
           <Label htmlFor="gameMode" className="text-cyan-400 font-bold">Game Mode:</Label>
           <select
             id="gameMode"
             value={gameSettings.gameMode}
             onChange={(e) => onUpdateSettings({ ...gameSettings, gameMode: e.target.value as GameSettings['gameMode'] })}
             className="w-full bg-gray-800 border-2 border-gray-600 text-white px-3 py-2 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
             disabled={readOnly}
           >
             <option value="team-vs-enemies">🤝 Team vs Enemies</option>
             <option value="team-vs-team">⚔️ Team vs Team</option>
           </select>
         </div>
         
         <div className="space-y-2">
           <Label htmlFor="enemyCount" className="text-cyan-400 font-bold">Enemy Count: {gameSettings.enemyCount}</Label>
           <Slider
              id="enemyCount"
              min={1} max={50} step={1}
              value={[gameSettings.enemyCount]}
              onValueChange={(value) => onUpdateSettings({ ...gameSettings, enemyCount: value[0] })}
              disabled={readOnly}
              className="disabled:opacity-70"
            />
         </div>

          {gameSettings.gameMode === 'team-vs-enemies' && (
              <div className="flex items-center space-x-2">
                  <Switch
                      id="bossEnabled"
                      checked={gameSettings.bossEnabled}
                      onCheckedChange={(checked) => onUpdateSettings({ ...gameSettings, bossEnabled: checked })}
                      disabled={readOnly}
                  />
                  <Label htmlFor="bossEnabled" className="text-cyan-400 font-bold">Enable Boss?</Label>
              </div>
          )}
      </div>
    </div>
  );

  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
      <div className="bg-black/60 p-8 rounded-3xl border-2 border-cyan-400 shadow-2xl max-w-lg w-full">
        <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          🌐 MULTIPLAYER LOBBY
        </h2>
        
        {!lobbyCode ? (
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
              <div className="text-3xl font-mono font-bold tracking-wider">{lobbyCode}</div>
            </div>
            
            <div className="text-left">
              <h3 className="text-xl font-bold text-cyan-400 mb-3">Connected Players ({connectedPlayers.length})</h3>
              <div className="bg-gray-800 p-3 rounded-lg min-h-[60px] space-y-1">
                {connectedPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between">
                    <span className={player.team === 'red' ? 'text-red-400' : 'text-blue-400'}>
                      Player {index + 1} {player.role === 'host' && '(Host)'}
                    </span>
                    <span className={`px-2 py-1 text-xs font-bold rounded ${player.team === 'red' ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'}`}>
                      {player.team?.toUpperCase()} TEAM
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {isHost ? (
              <div>
                <GameSettingsDisplay readOnly={false} />
                <Button onClick={onStartGame} disabled={connectedPlayers.length < 1} className="w-full mt-6 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white text-xl px-6 py-4 rounded-xl font-bold disabled:opacity-50">
                  🚀 START GAME
                </Button>
              </div>
            ) : (
              <div>
                <GameSettingsDisplay readOnly={true} />
                <div className="text-cyan-300 mt-6">Waiting for host to start the game...</div>
              </div>
            )}
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

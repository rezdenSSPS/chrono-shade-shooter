import React, { useState, useEffect, useRef } from 'react';More actions
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';

interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

interface MultiplayerLobbyProps {
  onStartGame: (lobbyCode: string, settings: GameSettings) => void;
  onBackToMenu: () => void;
}

@@ -28,7 +28,6 @@

  const channelRef = useRef<any>(null);

  // Cleanup function
  const cleanupChannel = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
@@ -37,30 +36,26 @@
  };

  const createLobby = async () => {
    // Cleanup any existing channel
    cleanupChannel();

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setLobbyCode(code);
    setIsHost(true);
    
    const channelName = `game-lobby-${code}`;
    const channel = supabase.channel(channelName);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const players = Object.keys(state);
        setConnectedPlayers(players);
      })
      .on('broadcast', { event: 'start-game' }, (payload) => {
        onStartGame(code, payload.settings || gameSettings);

      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Host subscribed to lobby');
        // Track host presence
        channel.track({ user_id: 'host', role: 'host' });
      }
    });
@@ -73,30 +68,26 @@
      alert('Please enter a valid 6-character lobby code');
      return;
    }
    
    // Cleanup any existing channel
    cleanupChannel();


    const code = inputCode.toUpperCase();
    setLobbyCode(code);
    
    const channelName = `game-lobby-${code}`;
    const channel = supabase.channel(channelName);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const players = Object.keys(state);
        setConnectedPlayers(players);
      })
      .on('broadcast', { event: 'start-game' }, (payload) => {
        onStartGame(code, payload.settings || gameSettings);

      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Player joined lobby');
        // Track player presence
        const playerId = Math.random().toString();
        channel.track({ user_id: playerId, role: 'player' });
      }
@@ -107,13 +98,17 @@

  const startMultiplayerGame = () => {
    if (channelRef.current) {

      channelRef.current.send({
        type: 'broadcast',
        event: 'start-game',
        payload: { settings: gameSettings }



      });

    }
    onStartGame(lobbyCode, gameSettings);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
@@ -127,7 +122,6 @@
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChannel();
@@ -136,143 +130,9 @@

  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
      <div className="bg-black/60 p-8 rounded-3xl border-2 border-cyan-400 shadow-2xl max-w-md w-full">
        <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          🌐 MULTIPLAYER LOBBY
        </h2>
        
        {!lobbyCode ? (
          <div className="space-y-4">
            <Button 
              onClick={createLobby}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black text-xl px-6 py-4 rounded-xl font-bold"
            >
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
              autoComplete="off"
            />
            
            <Button 
              onClick={joinLobby}
              disabled={inputCode.length !== 6}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white text-xl px-6 py-4 rounded-xl font-bold disabled:opacity-50"
            >
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
              <div className="bg-gray-800 p-3 rounded-lg min-h-[60px]">
                {connectedPlayers.length === 0 ? (
                  <div className="text-gray-400">Waiting for players...</div>
                ) : (
                  connectedPlayers.map((player, index) => (
                    <div key={player} className="text-green-400">
                      Player {index + 1} {isHost && index === 0 && '(Host)'}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {isHost && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-purple-400">⚙️ Game Settings</h3>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="text-cyan-400 font-bold">Game Mode:</span>
                    <select
                      value={gameSettings.gameMode}
                      onChange={(e) => setGameSettings(prev => ({ ...prev, gameMode: e.target.value as GameSettings['gameMode'] }))}
                      className="w-full bg-gray-800 border-2 border-gray-600 text-white px-3 py-2 rounded-lg"
                    >
                      <option value="survival">🏆 Last Man Standing</option>
                      <option value="team-vs-enemies">🤝 Team vs Enemies</option>
                      <option value="team-vs-team">⚔️ Team vs Team</option>
                    </select>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Enemy Count:</span>
                    <input
                      type="range"
                      min="3"
                      max="20"
                      value={gameSettings.enemyCount}
                      onChange={(e) => setGameSettings(prev => ({ ...prev, enemyCount: parseInt(e.target.value) }))}
                      className="w-24"
                    />
                    <span className="text-yellow-400 font-bold">{gameSettings.enemyCount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Enemy Speed:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.5"
                      value={gameSettings.enemySpeed}
                      onChange={(e) => setGameSettings(prev => ({ ...prev, enemySpeed: parseFloat(e.target.value) }))}
                      className="w-24"
                    />
                    <span className="text-yellow-400 font-bold">{gameSettings.enemySpeed}x</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Enemy Damage:</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={gameSettings.enemyDamage}
                      onChange={(e) => setGameSettings(prev => ({ ...prev, enemyDamage: parseInt(e.target.value) }))}
                      className="w-24"
                    />
                    <span className="text-yellow-400 font-bold">{gameSettings.enemyDamage}x</span>
                  </div>
                </div>
                
                <Button 
                  onClick={startMultiplayerGame}
                  disabled={connectedPlayers.length === 0}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white text-xl px-6 py-4 rounded-xl font-bold disabled:opacity-50"
                >
                  🚀 START GAME
                </Button>
              </div>
            )}
          </div>
        )}
        
        <Button 
          onClick={onBackToMenu}
          className="mt-6 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl"
        >Add commentMore actions
          ← Back to Menu
        </Button>
      </div>
    </div>
  );
};

export default MultiplayerLobby;

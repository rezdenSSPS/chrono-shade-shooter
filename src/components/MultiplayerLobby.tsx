
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MultiplayerLobbyProps {
  onStartGame: (lobbyCode: string, settings: GameSettings) => void;
  onBackToMenu: () => void;
}

interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
}

interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
}

const MultiplayerLobby = ({ onStartGame, onBackToMenu }: MultiplayerLobbyProps) => {
  const [lobbyCode, setLobbyCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isInLobby, setIsInLobby] = useState(false);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    enemyCount: 1,
    enemySpeed: 1,
    enemyDamage: 1
  });
  const [channel, setChannel] = useState<any>(null);
  const { toast } = useToast();

  const generateLobbyCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createLobby = () => {
    if (!playerName.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter a player name",
        variant: "destructive"
      });
      return;
    }

    const code = generateLobbyCode();
    setLobbyCode(code);
    setIsHost(true);
    joinLobby(code, true);
  };

  const joinLobbyWithCode = () => {
    if (!playerName.trim() || !lobbyCode.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both your name and lobby code",
        variant: "destructive"
      });
      return;
    }

    joinLobby(lobbyCode.toUpperCase(), false);
  };

  const joinLobby = (code: string, asHost: boolean) => {
    const lobbyChannel = supabase.channel(`lobby-${code}`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = lobbyChannel.presenceState();
        const playerList = Object.values(presenceState).flat() as LobbyPlayer[];
        setPlayers(playerList);
      })
      .on('broadcast', { event: 'settings-update' }, ({ payload }) => {
        setGameSettings(payload.settings);
      })
      .on('broadcast', { event: 'start-game' }, ({ payload }) => {
        onStartGame(code, payload.settings);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await lob byChannel.track({
            id: Math.random().toString(),
            name: playerName,
            ready: false
          });
          setIsInLobby(true);
        }
      });

    setChannel(lobbyChannel);
    setLobbyCode(code);
  };

  const updateSettings = (key: keyof GameSettings, value: number) => {
    if (!isHost) return;
    
    const newSettings = { ...gameSettings, [key]: value };
    setGameSettings(newSettings);
    
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'settings-update',
        payload: { settings: newSettings }
      });
    }
  };

  const startGame = () => {
    if (!isHost || players.length === 0) return;
    
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'start-game',
        payload: { settings: gameSettings }
      });
    }
    
    onStartGame(lobbyCode, gameSettings);
  };

  const leaveLobby = () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
    setIsInLobby(false);
    setPlayers([]);
    setLobbyCode('');
    setIsHost(false);
  };

  if (!isInLobby) {
    return (
      <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
        <div className="bg-black/60 p-8 rounded-2xl border-2 border-cyan-400 shadow-2xl max-w-md w-full mx-4">
          <h1 className="text-4xl font-bold mb-6 text-cyan-400">🌐 MULTIPLAYER LOBBY</h1>
          
          <div className="space-y-4">
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="bg-gray-800 text-white border-cyan-400 text-lg"
            />
            
            <div className="space-y-2">
              <Button
                onClick={createLobby}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold py-3"
              >
                🚀 CREATE LOBBY
              </Button>
              
              <div className="flex space-x-2">
                <Input
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value)}
                  placeholder="Lobby Code"
                  className="bg-gray-800 text-white border-cyan-400"
                />
                <Button
                  onClick={joinLobbyWithCode}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-bold px-6"
                >
                  JOIN
                </Button>
              </div>
            </div>
          </div>
          
          <Button
            onClick={onBackToMenu}
            variant="outline"
            className="mt-6 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"
          >
            🔙 BACK TO MENU
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center p-4">
      <div className="bg-black/60 p-8 rounded-2xl border-2 border-cyan-400 shadow-2xl max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-6 text-cyan-400">🎮 LOBBY: {lobbyCode}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Players Section */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-green-400">👥 PLAYERS ({players.length})</h2>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div key={player.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">{player.name}</span>
                  <span className="text-sm text-gray-400">#{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Settings Section */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-orange-400">⚙️ GAME SETTINGS</h2>
            {isHost ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">Enemy Spawn Rate</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3].map(level => (
                      <Button
                        key={level}
                        onClick={() => updateSettings('enemyCount', level)}
                        className={`px-4 py-2 ${gameSettings.enemyCount === level 
                          ? 'bg-green-500 text-black' 
                          : 'bg-gray-600 text-white'}`}
                      >
                        {level}x
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm mb-2">Enemy Speed</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3].map(level => (
                      <Button
                        key={level}
                        onClick={() => updateSettings('enemySpeed', level)}
                        className={`px-4 py-2 ${gameSettings.enemySpeed === level 
                          ? 'bg-orange-500 text-black' 
                          : 'bg-gray-600 text-white'}`}
                      >
                        {level}x
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm mb-2">Enemy Damage</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3].map(level => (
                      <Button
                        key={level}
                        onClick={() => updateSettings('enemyDamage', level)}
                        className={`px-4 py-2 ${gameSettings.enemyDamage === level 
                          ? 'bg-red-500 text-black' 
                          : 'bg-gray-600 text-white'}`}
                      >
                        {level}x
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">
                <p>Enemy Spawn: {gameSettings.enemyCount}x</p>
                <p>Enemy Speed: {gameSettings.enemySpeed}x</p>
                <p>Enemy Damage: {gameSettings.enemyDamage}x</p>
                <p className="text-sm mt-2">Only host can change settings</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 space-x-4">
          {isHost && (
            <Button
              onClick={startGame}
              disabled={players.length === 0}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold px-8 py-3"
            >
              🚀 START GAME
            </Button>
          )}
          
          <Button
            onClick={leaveLobby}
            variant="outline"
            className="border-2 border-red-400 text-red-400 hover:bg-red-400 hover:text-black px-6 py-3"
          >
            🚪 LEAVE LOBBY
          </Button>
        </div>
        
        <div className="mt-4 text-sm text-gray-400">
          Share this code with friends: <span className="font-mono text-yellow-400 text-lg">{lobbyCode}</span>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerLobby;

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';

interface GameSettings {
  enemyCount: number;
  enemySpeed: number;
  enemyDamage: number;
  gameMode: 'survival' | 'team-vs-enemies' | 'team-vs-team';
}

interface MultiplayerLobbyProps {
  onStartGame: (lobbyCode: string, settings: GameSettings, seed?: number) => void;
  onBackToMenu: () => void;
}

const MultiplayerLobby = ({ onStartGame, onBackToMenu }: MultiplayerLobbyProps) => {
  const [lobbyCode, setLobbyCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    enemyCount: 5,
    enemySpeed: 1,
    enemyDamage: 1,
    gameMode: 'survival'
  });

  const channelRef = useRef<any>(null);

  const cleanupChannel = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const createLobby = async () => {
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
        const seed = payload.worldSeed;
        onStartGame(code, payload.settings || gameSettings, seed);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ user_id: 'host', role: 'host' });
      }
    });

    channelRef.current = channel;
  };

  const joinLobby = async () => {
    if (!inputCode || inputCode.length !== 6) {
      alert('Please enter a valid 6-character lobby code');
      return;
    }

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
        const seed = payload.worldSeed;
        onStartGame(code, payload.settings || gameSettings, seed);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const playerId = Math.random().toString();
        channel.track({ user_id: playerId, role: 'player' });
      }
    });

    channelRef.current = channel;
  };

  const startMultiplayerGame = () => {
    if (channelRef.current) {
      const sharedSeed = Math.floor(Math.random() * 1000000);
      channelRef.current.send({
        type: 'broadcast',
        event: 'start-game',
        payload: {
          settings: gameSettings,
          worldSeed: sharedSeed
        }
      });
      onStartGame(lobbyCode, gameSettings, sharedSeed);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setInputCode(value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputCode.length === 6) {
      joinLobby();
    }
  };

  useEffect(() => {
    return () => {
      cleanupChannel();
    };
  }, []);

  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
      {/* ... your UI code remains unchanged ... */}
    </div>
  );
};

export default MultiplayerLobby;

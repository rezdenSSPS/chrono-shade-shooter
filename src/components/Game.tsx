import React, { useState, useRef, useEffect, useCallback } from 'react';
import GameCanvas from './GameCanvas';
import GameOverScreen from './GameOverScreen';
import LeaderboardScreen from './LeaderboardScreen';
import MainMenu from './MainMenu';
import MultiplayerLobby from './MultiplayerLobby';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameScreen, GameSettings, Player } from '@/types';

const Game = () => {
  const [gameScreen, setGameScreen] = useState<GameScreen>('menu');
  const [finalScore, setFinalScore] = useState(0);
  const [lobbyCode, setLobbyCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [wasMultiplayer, setWasMultiplayer] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    enemyCount: 5,
    enemySpeed: 1,
    enemyDamage: 1,
    gameMode: 'team-vs-enemies',
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string>(Math.random().toString(36).substring(2, 10));

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setConnectedPlayers([]);
    setLobbyCode('');
    setIsHost(false);
    setWasMultiplayer(false);
  }, []);

  const handleStartGame = (code: string, settings: GameSettings) => {
    setLobbyCode(code);
    setGameSettings(settings);
    setWasMultiplayer(true); // Mark this session as multiplayer
    setGameScreen('multiplayerGame');
  };
  
  const setupChannel = (code: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    const channelName = `game-lobby-${code}`;
    const channel = supabase.channel(channelName, {
        config: {
            presence: { key: playerIdRef.current }
        }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const players = Object.values(presenceState)
          .flatMap((presences: any) => presences)
          .map((p: any): Player => ({
            id: p.user_id,
            role: p.role,
            team: p.team,
            x: 0, y: 0, size: 20, health: 100, maxHealth: 100, isAlive: true, kills: 0,
            targetX: 0, targetY: 0,
          }));
        setConnectedPlayers(players);
      })
      .on('broadcast', { event: 'start-game' }, (payload) => {
        handleStartGame(code, payload.payload.settings);
      })
      .on('broadcast', { event: 'settings-update' }, (payload) => {
        if (!isHost) { // Clients update their settings from the host
            setGameSettings(payload.payload.settings);
        }
      });

    channelRef.current = channel;
    return channel;
  };

  const createLobby = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const channel = setupChannel(code);
    
    setIsHost(true);
    setLobbyCode(code);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ user_id: playerIdRef.current, role: 'host' });
      }
    });
  };

  const joinLobby = (code: string) => {
    const channel = setupChannel(code);
    
    setIsHost(false);
    setLobbyCode(code);
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ user_id: playerIdRef.current, role: 'player' });
      }
    });
  };

  const updateGameSettings = (newSettings: GameSettings) => {
    setGameSettings(newSettings);
    if (isHost && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'settings-update',
        payload: { settings: newSettings }
      });
    }
  };

  const startMultiplayerGame = () => {
    if (isHost && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'start-game',
        payload: { settings: gameSettings }
      });
    }
  };

  const backToLobbyOrMenu = () => {
    setFinalScore(0);
    if (wasMultiplayer) {
      setGameScreen('multiplayerLobby');
    } else {
      cleanupChannel();
      setGameScreen('menu');
    }
  };

  const endGame = (score: number) => {
    setFinalScore(score);
    setGameScreen('gameOver');
  };

  useEffect(() => {
    return () => cleanupChannel();
  }, [cleanupChannel]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {gameScreen === 'menu' && (
        <MainMenu 
          onStartGame={() => { setWasMultiplayer(false); setGameScreen('playing'); }}
          onShowLeaderboard={() => setGameScreen('leaderboard')}
          onStartMultiplayer={() => setGameScreen('multiplayerLobby')}
        />
      )}
      
      {gameScreen === 'playing' && (
        <GameCanvas 
          onGameEnd={endGame} 
          gameSettings={{ gameMode: 'survival', enemyCount: 1, enemySpeed: 1, enemyDamage: 1 }}
        />
      )}
      
      {gameScreen === 'multiplayerLobby' && (
        <MultiplayerLobby 
          lobbyCode={lobbyCode}
          isHost={isHost}
          connectedPlayers={connectedPlayers}
          gameSettings={gameSettings}
          onCreateLobby={createLobby}
          onJoinLobby={joinLobby}
          onUpdateSettings={updateGameSettings}
          onStartGame={startMultiplayerGame}
          onBackToMenu={() => { cleanupChannel(); setGameScreen('menu'); }}
        />
      )}
      
      {gameScreen === 'multiplayerGame' && channelRef.current && (
        <GameCanvas 
          onGameEnd={endGame} 
          isMultiplayer={true}
          isHost={isHost}
          lobbyCode={lobbyCode}
          gameSettings={gameSettings}
          channel={channelRef.current}
          playerId={playerIdRef.current}
        />
      )}
      
      {gameScreen === 'gameOver' && (
        <GameOverScreen 
          score={finalScore} 
          onBackToMenu={backToLobbyOrMenu}
          onShowLeaderboard={() => setGameScreen('leaderboard')}
        />
      )}
      
      {gameScreen === 'leaderboard' && (
        <LeaderboardScreen onBackToMenu={() => setGameScreen('menu')} />
      )}
    </div>
  );
};

export default Game;

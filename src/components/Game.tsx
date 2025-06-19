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
  const [lobbyState, setLobbyState] = useState<{
    code: string;
    isHost: boolean;
    isConnected: boolean;
    players: Player[];
    settings: GameSettings;
  }>({
    code: '',
    isHost: false,
    isConnected: false,
    players: [],
    settings: {
      enemyCount: 5,
      enemySpeed: 1,
      enemyDamage: 1,
      gameMode: 'team-vs-enemies',
    },
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string>(`p_${Math.random().toString(36).substring(2, 9)}`);
  
  // Create a ref to hold the isHost status to use in callbacks without dependency issues
  const isHostRef = useRef(lobbyState.isHost);
  useEffect(() => {
    isHostRef.current = lobbyState.isHost;
  }, [lobbyState.isHost]);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch(() => {});
      channelRef.current = null;
    }
    setLobbyState({
      code: '', isHost: false, isConnected: false, players: [],
      settings: { enemyCount: 5, enemySpeed: 1, enemyDamage: 1, gameMode: 'team-vs-enemies' },
    });
  }, []);

  const transitionToGame = useCallback((code: string, settings: GameSettings) => {
    setLobbyState(prev => ({ ...prev, code, settings }));
    setGameScreen('multiplayerGame');
  }, []);

  const setupChannel = useCallback((code: string, isHost: boolean) => {
    cleanupChannel();
    const channel = supabase.channel(`game-lobby-${code}`, {
      config: { presence: { key: playerIdRef.current } },
    });
    channelRef.current = channel;

    const onSync = () => {
      if (!channelRef.current) return;
      const presenceState = channelRef.current.presenceState();
      const players = Object.values(presenceState)
        .flatMap((p: any) => p)
        .map((p: any): Player => ({
          id: p.user_id, role: p.role, team: p.team, x: 0, y: 0,
          targetX: 0, targetY: 0, size: 20, health: 100, maxHealth: 100,
          isAlive: true, kills: 0,
        }));
      setLobbyState(prev => ({ ...prev, players }));
    };

    channel
      .on('presence', { event: 'sync' }, onSync)
      .on('broadcast', { event: 'start-game' }, ({ payload }) => transitionToGame(code, payload.settings))
      .on('broadcast', { event: 'settings-update' }, ({ payload }) => {
        // Use the ref here to get the most up-to-date isHost value
        if (!isHostRef.current) {
            setLobbyState(prev => ({ ...prev, settings: payload.settings }));
        }
      });

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        // IMPORTANT: We update the state here, which also updates the isHostRef.current
        setLobbyState(prev => ({ ...prev, code, isHost, isConnected: true }));
        channel.track({ user_id: playerIdRef.current, role: isHost ? 'host' : 'player' });
      } else if (status !== 'CLOSED') {
        setLobbyState(prev => ({ ...prev, isConnected: false }));
      }
    });
  }, [cleanupChannel, transitionToGame]); // Correct dependencies

  const updateGameSettings = (newSettings: GameSettings) => {
    setLobbyState(prev => ({ ...prev, settings: newSettings }));
    if (lobbyState.isHost && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'settings-update',
        payload: { settings: newSettings },
      });
    }
  };

  const startMultiplayerGame = () => {
    if (lobbyState.isHost && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'start-game',
        payload: { settings: lobbyState.settings },
      });
    }
  };

  const endGame = (score: number) => {
    setFinalScore(score);
    setGameScreen('gameOver');
  };

  const backToLobbyOrMenu = () => {
    setFinalScore(0);
    if (lobbyState.code) {
      setGameScreen('multiplayerLobby');
    } else {
      cleanupChannel();
      setGameScreen('menu');
    }
  };

  useEffect(() => {
    return () => cleanupChannel();
  }, [cleanupChannel]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {gameScreen === 'menu' && (
        <MainMenu 
          onStartGame={() => { cleanupChannel(); setGameScreen('playing'); }}
          onShowLeaderboard={() => setGameScreen('leaderboard')}
          onStartMultiplayer={() => setGameScreen('multiplayerLobby')}
        />
      )}
      
      {gameScreen === 'playing' && <GameCanvas onGameEnd={endGame} gameSettings={{ gameMode: 'survival', enemyCount: 1, enemySpeed: 1, enemyDamage: 1 }}/>}
      
      {gameScreen === 'multiplayerLobby' && (
        <MultiplayerLobby 
          lobbyState={lobbyState}
          onCreateLobby={() => setupChannel(Math.random().toString(36).substring(2, 8).toUpperCase(), true)}
          onJoinLobby={(code) => setupChannel(code, false)}
          onUpdateSettings={updateGameSettings}
          onStartGame={startMultiplayerGame}
          onBackToMenu={() => { cleanupChannel(); setGameScreen('menu'); }}
        />
      )}
      
      {gameScreen === 'multiplayerGame' && channelRef.current && (
        <GameCanvas 
          onGameEnd={endGame} 
          isMultiplayer={true}
          isHost={lobbyState.isHost}
          lobbyCode={lobbyState.code}
          gameSettings={lobbyState.settings}
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
      
      {gameScreen === 'leaderboard' && <LeaderboardScreen onBackToMenu={() => setGameScreen('menu')} />}
    </div>
  );
};

export default Game;

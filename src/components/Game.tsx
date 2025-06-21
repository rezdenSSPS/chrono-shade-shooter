// src/components/Game.tsx

import React, { useRef, useEffect, useCallback, useReducer } from 'react';
import GameCanvas from './GameCanvas';
import GameOverScreen from './GameOverScreen';
import LeaderboardScreen from './LeaderboardScreen';
import MainMenu from './MainMenu';
import MultiplayerLobby from './MultiplayerLobby';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameScreen, GameSettings, Player } from '@/types';

// UPDATE: Added a comprehensive state object and reducer for better state management.
interface GameState {
  gameScreen: GameScreen;
  finalScore: number;
  lobbyCode: string;
  isHost: boolean;
  connectedPlayers: Player[];
  gameSettings: GameSettings;
}

const initialState: GameState = {
  gameScreen: 'menu',
  finalScore: 0,
  lobbyCode: '',
  isHost: false,
  connectedPlayers: [],
  gameSettings: {
    enemyCount: 10,
    enemySpeed: 1,
    enemyDamage: 1,
    bossEnabled: false,
    gameMode: 'team-vs-enemies',
  },
};

type GameAction =
  | { type: 'SET_SCREEN'; payload: GameScreen }
  | { type: 'START_SINGLE_PLAYER' }
  | { type: 'GO_TO_LOBBY' }
  | { type: 'CREATE_LOBBY'; payload: { code: string } }
  | { type: 'JOIN_LOBBY'; payload: { code: string } }
  | { type: 'LEAVE_LOBBY' }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'UPDATE_SETTINGS'; payload: GameSettings }
  | { type: 'START_MULTIPLAYER_GAME' }
  | { type: 'END_GAME'; payload: { score: number } };

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, gameScreen: action.payload };
    case 'START_SINGLE_PLAYER':
      return { ...state, gameScreen: 'playing' };
    case 'GO_TO_LOBBY':
      return { ...state, gameScreen: 'multiplayerLobby' };
    case 'CREATE_LOBBY':
      return { ...state, isHost: true, lobbyCode: action.payload.code };
    case 'JOIN_LOBBY':
      return { ...state, isHost: false, lobbyCode: action.payload.code };
    case 'LEAVE_LOBBY':
      return { ...state, ...initialState }; // Reset to main menu state
    case 'UPDATE_PLAYERS':
      return { ...state, connectedPlayers: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, gameSettings: action.payload };
    case 'START_MULTIPLAYER_GAME':
      return { ...state, gameScreen: 'multiplayerGame' };
    case 'END_GAME':
      return { ...initialState, gameScreen: 'gameOver', finalScore: action.payload.score };
    default:
      return state;
  }
};


const Game = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { gameScreen, finalScore, lobbyCode, isHost, connectedPlayers, gameSettings } = state;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string>(Math.random().toString(36).substring(2, 10));

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const handleStartGameBroadcast = useCallback((code: string, settings: GameSettings) => {
    if (gameScreen !== 'multiplayerLobby') return; // Prevent multiple triggers
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    dispatch({ type: 'START_MULTIPLAYER_GAME' });
  }, [gameScreen]);

  const setupChannel = useCallback((code: string) => {
    cleanupChannel();
    const channelName = `game-lobby-${code}`;
    const channel = supabase.channel(channelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        let redTeamCount = 0;
        let blueTeamCount = 0;

        // Count existing team members
        Object.values(presenceState).flatMap((p: any) => p).forEach((p: any) => {
            if (p.team === 'red') redTeamCount++;
            if (p.team === 'blue') blueTeamCount++;
        });

        // UPDATE: Assign teams deterministically based on join order
        const players = Object.values(presenceState)
          .flatMap((presences: any) => presences)
          .map((p: any): Player => {
            let team = p.team;
            // Assign team if not present
            if (!team) {
              team = redTeamCount <= blueTeamCount ? 'red' : 'blue';
              if (team === 'red') redTeamCount++;
              else blueTeamCount++;
            }
            return {
              id: p.user_id,
              role: p.role,
              team: team, // Assign balanced team
              x: 0, y: 0, size: 20, health: 100, maxHealth: 100, isAlive: true, kills: 0,
            };
          });
        dispatch({ type: 'UPDATE_PLAYERS', payload: players });
      })
      .on('broadcast', { event: 'start-game' }, (payload) => {
        handleStartGameBroadcast(code, payload.payload.settings);
      })
      .on('broadcast', { event: 'settings-update' }, (payload) => {
        if (!isHost) {
          dispatch({ type: 'UPDATE_SETTINGS', payload: payload.payload.settings });
        }
      });

    channelRef.current = channel;
    return channel;
  }, [cleanupChannel, handleStartGameBroadcast, isHost]);

  const createLobby = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const channel = setupChannel(code);
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ user_id: playerIdRef.current, role: 'host', team: 'red' });
      }
    });

    dispatch({ type: 'CREATE_LOBBY', payload: { code } });
  };

  const joinLobby = (code: string) => {
    const channel = setupChannel(code);
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Team will be assigned by presence sync logic
        channel.track({ user_id: playerIdRef.current, role: 'player' });
      }
    });

    dispatch({ type: 'JOIN_LOBBY', payload: { code } });
  };

  const updateGameSettings = (newSettings: GameSettings) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
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
      // The host's own client will react to this broadcast as well
      channelRef.current.send({
        type: 'broadcast',
        event: 'start-game',
        payload: { settings: gameSettings }
      });
    }
  };

  const backToMenu = () => {
    cleanupChannel();
    dispatch({ type: 'LEAVE_LOBBY' });
  };

  const endGame = (score: number) => {
    cleanupChannel();
    dispatch({ type: 'END_GAME', payload: { score } });
  };

  useEffect(() => {
    return () => cleanupChannel();
  }, [cleanupChannel]);
  
  // FIX: Find the current player's data to pass their team to the game
  const currentPlayer = connectedPlayers.find(p => p.id === playerIdRef.current);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {gameScreen === 'menu' && (
        <MainMenu 
          onStartGame={() => dispatch({ type: 'START_SINGLE_PLAYER' })} 
          onShowLeaderboard={() => dispatch({ type: 'SET_SCREEN', payload: 'leaderboard' })}
          onStartMultiplayer={() => dispatch({ type: 'GO_TO_LOBBY' })}
        />
      )}
      
      {gameScreen === 'playing' && (
        <GameCanvas onGameEnd={endGame} gameSettings={{ gameMode: 'survival', enemyCount: 10, enemySpeed: 1, enemyDamage: 1, bossEnabled: false }} />
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
          onBackToMenu={backToMenu}
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
          playerTeam={currentPlayer?.team} // Pass the assigned team
        />
      )}
      
      {gameScreen === 'gameOver' && (
        <GameOverScreen 
          score={finalScore} 
          onBackToMenu={backToMenu}
          onShowLeaderboard={() => dispatch({ type: 'SET_SCREEN', payload: 'leaderboard' })}
        />
      )}
      
      {gameScreen === 'leaderboard' && (
        <LeaderboardScreen onBackToMenu={backToMenu} />
      )}
    </div>
  );
};

export default Game;

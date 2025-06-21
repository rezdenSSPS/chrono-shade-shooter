// src/hooks/useGameLoop.tsx

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameData, GameSettings, GameUIState, Player, Bullet, Enemy } from '@/types';
import { renderGame } from '@/utils/gameRenderer';
import {
  updatePlayer,
  updateBullets,
  updateEnemies,
  checkBulletEnemyCollisions,
  checkPlayerEnemyCollisions,
  spawnEnemy,
  spawnBoss,
  shoot
} from '@/utils/gameLogic';

interface UseGameLoopProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  gameState: GameUIState;
  setGameState: React.Dispatch<React.SetStateAction<GameUIState>>;
  onGameEnd: (score: number) => void;
  isMultiplayer?: boolean;
  isHost?: boolean;
  gameSettings: GameSettings;
  channel?: RealtimeChannel;
  playerId?: string;
  setIsSpectating: React.Dispatch<React.SetStateAction<boolean>>;
}

const useGameLoop = ({
  canvasRef,
  gameState,
  setGameState,
  onGameEnd,
  isMultiplayer = false,
  isHost = false,
  gameSettings,
  channel,
  playerId,
  setIsSpectating,
}: UseGameLoopProps) => {
  const gameDataRef = useRef<GameData>({
    player: {
      id: playerId || 'solo',
      x: window.innerWidth / 2, y: window.innerHeight / 2,
      targetX: window.innerWidth / 2, targetY: window.innerHeight / 2,
      size: 20, health: 100, maxHealth: 100,
      isAlive: true, kills: 0,
    },
    otherPlayers: [], enemies: [], bullets: [],
    keys: {}, mouse: { x: 0, y: 0, isDown: false },
    lastShot: 0, lastEnemySpawn: 0, lastBossSpawn: 0,
    gameMode: gameSettings.gameMode, gameStartTime: Date.now(),
  });

  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef(Date.now());
  const lastPositionBroadcast = useRef(0);
  const lastStateBroadcast = useRef(0);
  const respawnTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // --- Logic from previous steps (no changes) ---
  const processHit = useCallback((victimId: string, killerId: string, damage: number) => { /* ...same as before... */ }, [isHost, setGameState, canvasRef]);
  const checkPlayerBulletCollisions = useCallback(() => { /* ...same as before... */ }, [isHost, channel, processHit, playerId]);

  // --- Input Effect (no changes) ---
  useEffect(() => { /* ...same as before... */ }, [canvasRef]);

  // Multiplayer Listeners Effect (MAJOR CHANGES HERE)
  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePlayerHit = (payload: { payload: { victimId: string, killerId: string, damage: number }}) => { if (isHost) processHit(payload.payload.victimId, payload.payload.killerId, payload.payload.damage); };

    // *** THIS IS THE NEW, SIMPLIFIED, AND MORE ROBUST LOGIC ***
    const handleGameStateUpdate = (payload: { payload: { enemies: Enemy[], players: Player[], timeLeft: number, teamScores: { red: number, blue: number } } }) => {
        if (isHost) return; // Host generates the state, it doesn't consume it.

        const { enemies, players: networkPlayers, timeLeft, teamScores } = payload.payload;
        
        // Update non-player state
        gameDataRef.current.enemies = enemies;
        setGameState(prev => ({...prev, timeLeft, teamScores }));

        // Create a list of players we know about locally
        const localPlayers = new Map(gameDataRef.current.otherPlayers.map(p => [p.id, p]));
        const updatedOtherPlayers: Player[] = [];

        // Loop through the authoritative list of players from the host
        for (const networkPlayer of networkPlayers) {
            if (networkPlayer.id === playerId) {
                // This is our own player. Update our health/status from the host's perspective.
                const self = gameDataRef.current.player;
                self.health = networkPlayer.health;
                if (self.isAlive && !networkPlayer.isAlive) setIsSpectating(true);
                if (!self.isAlive && networkPlayer.isAlive) {
                    setIsSpectating(false);
                    // On respawn, snap to the new position sent by the host
                    self.x = networkPlayer.x;
                    self.y = networkPlayer.y;
                    self.targetX = networkPlayer.targetX;
                    self.targetY = networkPlayer.targetY;
                }
                self.isAlive = networkPlayer.isAlive;
                self.kills = networkPlayer.kills;
            } else {
                // This is another player.
                const existingPlayer = localPlayers.get(networkPlayer.id);

                if (existingPlayer) {
                    // We already know about this player. Update their stats but KEEP their local position
                    // for smooth interpolation. The `player-move` event will update their targetX/Y.
                    existingPlayer.health = networkPlayer.health;
                    existingPlayer.isAlive = networkPlayer.isAlive;
                    existingPlayer.kills = networkPlayer.kills;
                    if (!existingPlayer.isAlive && networkPlayer.isAlive) { // Respawned
                       existingPlayer.x = networkPlayer.x;
                       existingPlayer.y = networkPlayer.y;
                       existingPlayer.targetX = networkPlayer.targetX;
                       existingPlayer.targetY = networkPlayer.targetY;
                    }
                    updatedOtherPlayers.push(existingPlayer);
                } else {
                    // This is a new player we haven't seen before. Create them.
                    updatedOtherPlayers.push({ ...networkPlayer });
                }
            }
        }
        // Replace the old list with the new, authoritative list
        gameDataRef.current.otherPlayers = updatedOtherPlayers;
    };
    
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => { if (payload.payload.bullet.playerId !== playerId) gameDataRef.current.bullets.push(payload.payload.bullet); };
    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
        if (payload.payload.id !== playerId) {
            const movedPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.id);
            if (movedPlayer) {
                movedPlayer.targetX = payload.payload.x;
                movedPlayer.targetY = payload.payload.y;
            }
        }
    };
    const handleUpgradePurchase = (payload: { payload: { upgradeType: string, cost: number }}) => { if (!isHost) setGameState(prev => ({...prev, timeLeft: prev.timeLeft - payload.payload.cost, [`${payload.payload.upgradeType}Level`]: prev[`${payload.payload.upgradeType}Level`] + 1 })); };

    // We no longer need a separate presence handler for visual state, but it's good for debugging.
    channel.on('presence', { event: 'sync' }, (state) => {
        // console.log('Presence changed:', state);
    });

    channel.on('broadcast', { event: 'game-state-update' }, handleGameStateUpdate);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    channel.on('broadcast', { event: 'player-hit' }, handlePlayerHit);
    
    return () => { channel.off('presence'); channel.off('broadcast'); respawnTimeouts.current.forEach(clearTimeout); };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating, processHit]);

  // Main Game Loop (no changes needed)
  const gameLoop = useCallback(() => { /* ...same as before... */ }, [
    gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, 
    gameState, onGameEnd, isHost, checkPlayerBulletCollisions
  ]);

  // Start/Stop Effect (no changes needed)
  useEffect(() => { /* ...same as before... */ }, [gameLoop, gameSettings.gameMode, playerId, isMultiplayer, channel, isHost]);

  return null;
};

export default useGameLoop;

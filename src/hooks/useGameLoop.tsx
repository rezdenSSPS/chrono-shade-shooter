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
// UPDATE: Import from centralized config
import { UPGRADE_COSTS } from '@/gameConfig';

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
  playerTeam?: 'red' | 'blue' | 'solo'; // UPDATE: Added playerTeam prop
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
  playerTeam, // UPDATE: Destructure playerTeam
  setIsSpectating,
}: UseGameLoopProps) => {
  const gameDataRef = useRef<GameData>({
    player: {
      id: playerId || 'solo',
      team: playerTeam || 'solo', // UPDATE: Use passed-in team
      x: window.innerWidth / 2, y: window.innerHeight / 2,
      targetX: window.innerWidth / 2, targetY: window.innerHeight / 2,
      size: 20, health: 100, maxHealth: 100,
      isAlive: true, kills: 0,
      gunLevel: 1, fireRateLevel: 1, bulletSizeLevel: 1,
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

  const processHit = useCallback((victimId: string, killerId: string, damage: number) => {
    if (!isHost) return;

    const allPlayers = [gameDataRef.current.player, ...gameDataRef.current.otherPlayers];
    const victim = allPlayers.find(p => p.id === victimId);
    const killer = allPlayers.find(p => p.id === killerId);

    if (!victim || !killer || !victim.isAlive) return;
    if (victim.id === killer.id || victim.team === killer.team) return;

    victim.health -= damage;
    if (victim.health <= 0) {
      victim.health = 0;
      victim.isAlive = false;
      
      killer.kills += 1;
      // Host updates the team scores directly
      if (killer.team === 'red') setGameState(prev => ({ ...prev, teamScores: { ...prev.teamScores, red: prev.teamScores.red + 1 } }));
      else if (killer.team === 'blue') setGameState(prev => ({ ...prev, teamScores: { ...prev.teamScores, blue: prev.teamScores.blue + 1 } }));
      
      const respawnTimer = setTimeout(() => {
        victim.health = victim.maxHealth;
        victim.isAlive = true;
        if (canvasRef.current) {
          victim.x = Math.random() * canvasRef.current.width;
          victim.y = Math.random() * canvasRef.current.height;
          victim.targetX = victim.x;
          victim.targetY = victim.y;
        }
        respawnTimeouts.current.delete(victimId);
      }, 3000);
      respawnTimeouts.current.set(victimId, respawnTimer);
    }
  }, [isHost, setGameState, canvasRef]);
  
  const checkPlayerBulletCollisions = useCallback(() => {
    const { bullets, player, otherPlayers } = gameDataRef.current;
    const allPlayers = [player, ...otherPlayers];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      for (const p of allPlayers) {
        if (p.id !== bullet.playerId && p.team !== bullet.team && p.isAlive && bullet.team) {
          const dist = Math.hypot(bullet.x - p.x, bullet.y - p.y);
          if (dist < p.size + bullet.size) {
            if (isHost) {
              processHit(p.id, bullet.playerId, bullet.damage || 10);
            } else if (playerId === bullet.playerId) {
              channel?.send({
                type: 'broadcast', event: 'player-hit',
                payload: { victimId: p.id, killerId: bullet.playerId, damage: bullet.damage || 10 }
              });
            }
            bullets.splice(i, 1);
            break; 
          }
        }
      }
    }
  }, [isHost, channel, processHit, playerId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameDataRef.current.keys[e.key.toLowerCase()] = false; };
    const handleMouseDown = () => { gameDataRef.current.mouse.isDown = true; };
    const handleMouseUp = () => { gameDataRef.current.mouse.isDown = false; };
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            gameDataRef.current.mouse.x = e.clientX - rect.left;
            gameDataRef.current.mouse.y = e.clientY - rect.top;
        }
    };
    const handleResize = () => {
      if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown); window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown); window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef]);

  useEffect(() => {
    if (!isMultiplayer || !channel || !playerId) return;

    const handlePlayerHit = (payload: { payload: { victimId: string, killerId: string, damage: number }}) => {
      if (isHost) {
        processHit(payload.payload.victimId, payload.payload.killerId, payload.payload.damage);
      }
    };

    const handlePresenceSync = () => {
      const presenceState = channel.presenceState();
      const newOtherPlayers: Player[] = [];
      for (const id in presenceState) {
        const presences = presenceState[id] as any[];
        const pState = presences[0];
        if (pState.user_id !== playerId) {
          const existingPlayer = gameDataRef.current.otherPlayers.find(p => p.id === pState.user_id);
          const player_data = {
            id: pState.user_id, x: pState.x || 0, y: pState.y || 0, targetX: pState.x || 0, targetY: pState.y || 0,
            health: pState.health || 100, maxHealth: 100, isAlive: pState.isAlive !== false, team: pState.team, 
            role: pState.role, size: 20, kills: pState.kills || 0,
            gunLevel: pState.gunLevel || 1, fireRateLevel: pState.fireRateLevel || 1, bulletSizeLevel: pState.bulletSizeLevel || 1,
          };
          if (existingPlayer) {
            // Preserve lerped position but update stats
            existingPlayer.health = player_data.health;
            existingPlayer.isAlive = player_data.isAlive;
            // ... etc
            newOtherPlayers.push(existingPlayer);
          } else {
            newOtherPlayers.push(player_data);
          }
        }
      }
      gameDataRef.current.otherPlayers = newOtherPlayers;
    };

    const handleGameStateUpdate = (payload: { payload: { enemies: Enemy[], players: Player[], timeLeft: number, teamScores: { red: number, blue: number } } }) => {
        if (!isHost) {
            gameDataRef.current.enemies = payload.payload.enemies;
            payload.payload.players.forEach(networkPlayer => {
                if (networkPlayer.id === playerId) {
                    const self = gameDataRef.current.player;
                    self.health = networkPlayer.health;
                    if (self.isAlive && !networkPlayer.isAlive) setIsSpectating(true);
                    if (!self.isAlive && networkPlayer.isAlive) {
                      setIsSpectating(false);
                      self.x = networkPlayer.x; self.y = networkPlayer.y;
                      self.targetX = networkPlayer.targetX; self.targetY = networkPlayer.targetY;
                    }
                    self.isAlive = networkPlayer.isAlive;
                    self.kills = networkPlayer.kills;
                    self.gunLevel = networkPlayer.gunLevel;
                    self.fireRateLevel = networkPlayer.fireRateLevel;
                    self.bulletSizeLevel = networkPlayer.bulletSizeLevel;

                    setGameState(prev => ({ ...prev, 
                        kills: self.kills, gunLevel: self.gunLevel, 
                        fireRateLevel: self.fireRateLevel, bulletSizeLevel: self.bulletSizeLevel
                    }));
                } else {
                    let otherPlayer = gameDataRef.current.otherPlayers.find(p => p.id === networkPlayer.id);
                    if (!otherPlayer) {
                        otherPlayer = { ...networkPlayer };
                        gameDataRef.current.otherPlayers.push(otherPlayer);
                    } else {
                        Object.assign(otherPlayer, networkPlayer);
                    }
                }
            });
            setGameState(prev => ({...prev, timeLeft: payload.payload.timeLeft, teamScores: payload.payload.teamScores }));
        }
    };
    
    const handleBulletFired = (payload: { payload: { bullet: Bullet } }) => {
      if (payload.payload.bullet.playerId !== playerId) {
        gameDataRef.current.bullets.push(payload.payload.bullet);
      }
    };

    const handlePlayerMove = (payload: { payload: { id: string, x: number, y: number } }) => {
        if (payload.payload.id !== playerId) {
            const movedPlayer = gameDataRef.current.otherPlayers.find(p => p.id === payload.payload.id);
            if (movedPlayer) {
                movedPlayer.targetX = payload.payload.x;
                movedPlayer.targetY = payload.payload.y;
            }
        }
    };
    
    const handleUpgradePurchase = (payload: { payload: { upgradeType: string }, [key: string]: any }) => {
        if (isHost) {
            const pId = payload.user_id;
            const p = [gameDataRef.current.player, ...gameDataRef.current.otherPlayers].find(p => p.id === pId);
            if (!p) return;

            const { upgradeType } = payload.payload;
            let cost = 0, currentLevel = 0;
            let levelKey: 'gunLevel' | 'fireRateLevel' | 'bulletSizeLevel' = 'gunLevel';
            
            // UPDATE: Use centralized config
            if (upgradeType === 'gun') { currentLevel = p.gunLevel; cost = UPGRADE_COSTS.gun[currentLevel] || 9999; levelKey = 'gunLevel'; }
            else if (upgradeType === 'fireRate') { currentLevel = p.fireRateLevel; cost = UPGRADE_COSTS.fireRate[currentLevel] || 9999; levelKey = 'fireRateLevel'; }
            else { currentLevel = p.bulletSizeLevel; cost = UPGRADE_COSTS.bulletSize[currentLevel] || 9999; levelKey = 'bulletSizeLevel'; }

            if (p.kills >= cost && currentLevel < 10) {
                p.kills -= cost;
                p[levelKey]++;
            }
        }
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('broadcast', { event: 'game-state-update' }, handleGameStateUpdate);
    channel.on('broadcast', { event: 'bullet-fired' }, handleBulletFired);
    channel.on('broadcast', { event: 'player-move' }, handlePlayerMove);
    channel.on('broadcast', { event: 'purchase-upgrade' }, handleUpgradePurchase);
    channel.on('broadcast', { event: 'player-hit' }, handlePlayerHit);
    
    handlePresenceSync();

    return () => {
        channel.off('presence', { event: 'sync' });
        channel.off('broadcast'); // Remove all broadcast listeners
        respawnTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, [isMultiplayer, channel, playerId, isHost, setGameState, setIsSpectating, processHit]);

  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = now;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { player, otherPlayers, mouse } = gameDataRef.current;
    
    if (mouse.isDown && player.isAlive) {
        shoot(gameDataRef.current, player, channel, isMultiplayer);
    }

    if (player.isAlive) {
        updatePlayer(gameDataRef.current, canvas);
    }
    updateBullets(gameDataRef.current, canvas);

    otherPlayers.forEach(p => {
      if (p.isAlive) {
        const lerpFactor = 0.2; // Smoothly interpolate other players' positions
        p.x += (p.targetX - p.x) * lerpFactor;
        p.y += (p.targetY - p.y) * lerpFactor;
      }
    });
    
    if (gameSettings.gameMode === 'team-vs-team') {
      checkPlayerBulletCollisions();
    }
    
    // UPDATE: Use functional update for timeLeft to avoid dependency on gameState
    setGameState(prev => {
        let newTimeLeft = prev.timeLeft;
        let newTeamScores = prev.teamScores;

        if (isHost || !isMultiplayer) {
            newTimeLeft = prev.timeLeft - deltaTime;
            if (newTimeLeft <= 0) {
                const finalScore = gameSettings.gameMode === 'team-vs-team' 
                    ? Math.max(prev.teamScores.red, prev.teamScores.blue) 
                    : prev.kills;
                onGameEnd(finalScore);
                if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                return prev;
            }

            updateEnemies(gameDataRef.current);
            const allCurrentPlayers = [gameDataRef.current.player, ...gameDataRef.current.otherPlayers];
            const isPvp = gameSettings.gameMode === 'team-vs-team';
            const timeGained = checkBulletEnemyCollisions(gameDataRef.current, allCurrentPlayers, isPvp);
            checkPlayerEnemyCollisions(gameDataRef.current, allCurrentPlayers);
            if (!isPvp && timeGained > 0) {
                newTimeLeft += timeGained;
            }
            spawnEnemy(gameDataRef.current, canvas, gameSettings);
            spawnBoss(gameDataRef.current, canvas);
        }
        
        return { ...prev, timeLeft: newTimeLeft, teamScores: newTeamScores };
    });
    
    if (isMultiplayer && channel && playerId) {
        if (now - lastPositionBroadcast.current > 50 && player.isAlive) {
            lastPositionBroadcast.current = now;
            channel.send({ type: 'broadcast', event: 'player-move', payload: { id: playerId, x: player.x, y: player.y }});
        }
        if (isHost && now - lastStateBroadcast.current > 100) {
            lastStateBroadcast.current = now;
            channel.send({
                type: 'broadcast', event: 'game-state-update',
                payload: {
                    enemies: gameDataRef.current.enemies,
                    players: [gameDataRef.current.player, ...gameDataRef.current.otherPlayers],
                    timeLeft: gameState.timeLeft, // Send the most recent time
                    teamScores: gameState.teamScores,
                }
            });
        }
    }

    renderGame(canvas, gameDataRef.current, playerId);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  // UPDATE: Removed `gameState` from dependency array to optimize performance
  }, [gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, onGameEnd, isHost, checkPlayerBulletCollisions]);

  useEffect(() => {
    // FIX: Remove random team assignment. It's now handled by props.
    // The player's team is set in the gameDataRef initialization.
    gameDataRef.current.player.id = playerId || 'solo-player';
    lastUpdateTime.current = Date.now();
    
    if (isMultiplayer && channel && playerId) {
      channel.track({
        user_id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y,
        team: gameDataRef.current.player.team, // Track the assigned team
        health: 100, isAlive: true, 
        role: isHost ? 'host' : 'player', kills: 0,
        gunLevel: 1, fireRateLevel: 1, bulletSizeLevel: 1,
      });
    }
    
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameLoop, playerId, isMultiplayer, channel, isHost]);

  return null;
};

export default useGameLoop;

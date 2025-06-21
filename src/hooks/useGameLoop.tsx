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
      
      killer.kills += 1; // Award kill point for upgrades
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
          if (existingPlayer) {
            newOtherPlayers.push(existingPlayer);
          } else {
            newOtherPlayers.push({
              id: pState.user_id, x: pState.x || 0, y: pState.y || 0, targetX: pState.x || 0, targetY: pState.y || 0,
              health: pState.health || 100, maxHealth: 100, isAlive: pState.isAlive !== false, team: pState.team, 
              role: pState.role, size: 20, kills: pState.kills || 0,
              gunLevel: pState.gunLevel || 1, fireRateLevel: pState.fireRateLevel || 1, bulletSizeLevel: pState.bulletSizeLevel || 1,
            });
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
                        otherPlayer.health = networkPlayer.health;
                        otherPlayer.isAlive = networkPlayer.isAlive;
                        otherPlayer.kills = networkPlayer.kills;
                        otherPlayer.gunLevel = networkPlayer.gunLevel;
                        otherPlayer.fireRateLevel = networkPlayer.fireRateLevel;
                        otherPlayer.bulletSizeLevel = networkPlayer.bulletSizeLevel;
                        if (!otherPlayer.isAlive && networkPlayer.isAlive) {
                           otherPlayer.x = networkPlayer.x; otherPlayer.y = networkPlayer.y;
                           otherPlayer.targetX = networkPlayer.targetX; otherPlayer.targetY = networkPlayer.targetY;
                        }
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
            const pId = payload.user_id; // Supabase adds user_id to the broadcast payload
            const p = [gameDataRef.current.player, ...gameDataRef.current.otherPlayers].find(p => p.id === pId);
            if (!p) return;

            const { upgradeType } = payload.payload;
            let cost = 0, currentLevel = 0;
            let levelKey: 'gunLevel' | 'fireRateLevel' | 'bulletSizeLevel' = 'gunLevel';
            const costs = {
                gun: [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 25],
                fireRate: [0, 1, 3, 5, 7, 9, 11, 14, 17, 20, 24],
                bulletSize: [0, 3, 5, 7, 9, 11, 13, 16, 19, 23, 26],
            };
            
            if (upgradeType === 'gun') { currentLevel = p.gunLevel; cost = costs.gun[currentLevel] || 9999; levelKey = 'gunLevel'; }
            else if (upgradeType === 'fireRate') { currentLevel = p.fireRateLevel; cost = costs.fireRate[currentLevel] || 9999; levelKey = 'fireRateLevel'; }
            else { currentLevel = p.bulletSizeLevel; cost = costs.bulletSize[currentLevel] || 9999; levelKey = 'bulletSizeLevel'; }

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
        channel.off('broadcast', { event: 'game-state-update' });
        channel.off('broadcast', { event: 'bullet-fired' });
        channel.off('broadcast', { event: 'player-move' });
        channel.off('broadcast', { event: 'purchase-upgrade' });
        channel.off('broadcast', { event: 'player-hit' });
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
        const lerpFactor = 0.2;
        p.x += (p.targetX - p.x) * lerpFactor;
        p.y += (p.targetY - p.y) * lerpFactor;
      }
    });
    
    if (gameSettings.gameMode === 'team-vs-team') {
      checkPlayerBulletCollisions();
    }
    
    if (isHost || !isMultiplayer) {
      const newTimeLeft = gameState.timeLeft - deltaTime;
      if (newTimeLeft <= 0) {
        onGameEnd(gameSettings.gameMode === 'team-vs-team' ? Math.max(gameState.teamScores.red, gameState.teamScores.blue) : gameState.kills);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
      }
      setGameState(prev => ({ ...prev, timeLeft: newTimeLeft }));

      // Add enemy logic to all modes now
      updateEnemies(gameDataRef.current);
      const allCurrentPlayers = [player, ...otherPlayers];
      const isPvp = gameSettings.gameMode === 'team-vs-team';
      const timeGained = checkBulletEnemyCollisions(gameDataRef.current, allCurrentPlayers, isPvp);
      checkPlayerEnemyCollisions(gameDataRef.current, allCurrentPlayers);
      if (!isPvp && timeGained > 0) {
          setGameState(prev => ({...prev, timeLeft: prev.timeLeft + timeGained}));
      }
      spawnEnemy(gameDataRef.current, canvas, gameSettings);
      spawnBoss(gameDataRef.current, canvas);
    }
    
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
                    timeLeft: gameState.timeLeft, teamScores: gameState.teamScores,
                }
            });
        }
    }

    renderGame(canvas, gameDataRef.current, playerId);
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [gameSettings, isMultiplayer, setGameState, channel, playerId, canvasRef, gameState, onGameEnd, isHost, checkPlayerBulletCollisions]);

  useEffect(() => {
    gameDataRef.current.player.team = gameSettings.gameMode === 'team-vs-team' ? (Math.random() < 0.5 ? 'red' : 'blue') : 'blue';
    gameDataRef.current.player.id = playerId || 'solo-player';
    lastUpdateTime.current = Date.now();
    
    if (isMultiplayer && channel && playerId) {
      channel.track({
        user_id: playerId, x: gameDataRef.current.player.x, y: gameDataRef.current.player.y,
        team: gameDataRef.current.player.team, health: 100, isAlive: true, 
        role: isHost ? 'host' : 'player', kills: 0,
        gunLevel: 1, fireRateLevel: 1, bulletSizeLevel: 1,
      });
    }
    
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameLoop, gameSettings.gameMode, playerId, isMultiplayer, channel, isHost]);

  return null;
};

export default useGameLoop;

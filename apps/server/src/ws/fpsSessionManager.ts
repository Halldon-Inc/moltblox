/**
 * FPS Deathmatch Session Manager
 *
 * Manages real-time FPS multiplayer matches: creation, joining,
 * countdown, position broadcasting at 20Hz, kills, respawns,
 * and match completion (first to N kills wins).
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { sendTo, type ConnectedClient } from './sessionManager.js';

// ---- Types ----

export interface FPSPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  x: number;
  y: number;
  z: number;
  angle: number;
  health: number;
  alive: boolean;
  weaponIndex: number;
  kills: number;
  deaths: number;
  ready: boolean;
  respawnTimer?: ReturnType<typeof setTimeout>;
  lastUpdateTime: number;
  deathTime: number;
}

export interface FPSMatch {
  id: string;
  level: number;
  maxPlayers: number;
  killsToWin: number;
  status: 'waiting' | 'countdown' | 'playing' | 'ended';
  players: Map<string, FPSPlayer>;
  spawnPoints: { x: number; y: number; angle: number }[];
  startTime: number;
  broadcastInterval?: ReturnType<typeof setInterval>;
  countdownTimer?: ReturnType<typeof setTimeout>;
  matchTimeout?: ReturnType<typeof setTimeout>;
  mapWidth: number;
  mapHeight: number;
}

// Spawn points per level
const SPAWN_POINTS: Record<number, { x: number; y: number; angle: number }[]> = {
  0: [
    { x: 1.5, y: 1.5, angle: 0 },
    { x: 14.5, y: 14.5, angle: Math.PI },
    { x: 1.5, y: 14.5, angle: Math.PI / 2 },
    { x: 14.5, y: 1.5, angle: -Math.PI / 2 },
  ],
  1: [
    { x: 1.5, y: 1.5, angle: 0 },
    { x: 18.5, y: 18.5, angle: Math.PI },
    { x: 10, y: 1.5, angle: Math.PI / 2 },
    { x: 1.5, y: 18.5, angle: -Math.PI / 2 },
  ],
  2: [
    { x: 2, y: 2, angle: 0.7 },
    { x: 18, y: 18, angle: -2.4 },
    { x: 18, y: 2, angle: 2.4 },
    { x: 2, y: 18, angle: -0.7 },
  ],
};

const RESPAWN_DELAY = 3000; // 3 seconds
const BROADCAST_INTERVAL = 50; // 20Hz
const COUNTDOWN_SECONDS = 3;
const READY_TIMEOUT = 10_000; // Auto-start 10s after 2+ players ready
const MAX_SPEED = 8; // units/sec (generous for lag tolerance)
const MAX_MATCH_DURATION = 10 * 60 * 1000; // 10 minutes

// Map dimensions per level (derived from spawn point extents)
const MAP_DIMENSIONS: Record<number, { width: number; height: number }> = {
  0: { width: 16, height: 16 },
  1: { width: 20, height: 20 },
  2: { width: 20, height: 20 },
};

// ---- Weapon names for kill feed ----
const WEAPON_NAMES: Record<number, string> = {
  0: 'Fist',
  1: 'Pistol',
  2: 'Shotgun',
  3: 'Chaingun',
  4: 'Rocket Launcher',
  5: 'BFG 9000',
};

// Server-authoritative weapon damage table.
// baseDamage = full damage at distances <= falloffStart.
// Linear falloff from falloffStart to maxRange; zero damage beyond maxRange.
const WEAPON_DAMAGE_TABLE: Record<
  number,
  { baseDamage: number; maxRange: number; falloffStart: number }
> = {
  0: { baseDamage: 15, maxRange: 3, falloffStart: 1 }, // Fist (melee)
  1: { baseDamage: 25, maxRange: 50, falloffStart: 20 }, // Pistol
  2: { baseDamage: 80, maxRange: 15, falloffStart: 5 }, // Shotgun
  3: { baseDamage: 35, maxRange: 100, falloffStart: 40 }, // Chaingun
  4: { baseDamage: 100, maxRange: 200, falloffStart: 80 }, // Rocket Launcher
  5: { baseDamage: 150, maxRange: 200, falloffStart: 100 }, // BFG 9000
};

/**
 * Singleton FPS session manager.
 */
export class FPSSessionManager {
  private matches = new Map<string, FPSMatch>();
  // Map playerId to matchId for quick lookup
  private playerMatchMap = new Map<string, string>();

  createMatch(
    playerId: string,
    playerName: string,
    ws: WebSocket,
    level: number,
    maxPlayers: number,
    killsToWin: number,
  ): string {
    const matchId = uuidv4();
    const levelIndex = Math.max(0, Math.min(level, 2));
    const spawnPoints = SPAWN_POINTS[levelIndex] || SPAWN_POINTS[0];
    const spawn = spawnPoints[0];

    const player: FPSPlayer = {
      id: playerId,
      name: playerName,
      ws,
      x: spawn.x,
      y: spawn.y,
      z: 0,
      angle: spawn.angle,
      health: 100,
      alive: true,
      weaponIndex: 1,
      kills: 0,
      deaths: 0,
      ready: false,
      lastUpdateTime: 0,
      deathTime: 0,
    };

    const dims = MAP_DIMENSIONS[levelIndex] || MAP_DIMENSIONS[0];
    const match: FPSMatch = {
      id: matchId,
      level: levelIndex,
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 4),
      killsToWin: Math.min(Math.max(killsToWin, 1), 50),
      status: 'waiting',
      players: new Map([[playerId, player]]),
      spawnPoints,
      startTime: 0,
      mapWidth: dims.width,
      mapHeight: dims.height,
    };

    this.matches.set(matchId, match);
    this.playerMatchMap.set(playerId, matchId);

    sendTo(ws, {
      type: 'fps_match_created',
      payload: { matchId, level: levelIndex },
    });

    console.log(`[FPS] Match ${matchId} created by ${playerName} (level ${levelIndex})`);
    return matchId;
  }

  joinMatch(playerId: string, playerName: string, ws: WebSocket, matchId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      sendTo(ws, { type: 'error', payload: { message: 'FPS match not found' } });
      return false;
    }
    if (match.status !== 'waiting') {
      sendTo(ws, { type: 'error', payload: { message: 'Match already in progress' } });
      return false;
    }
    if (match.players.size >= match.maxPlayers) {
      sendTo(ws, { type: 'error', payload: { message: 'Match is full' } });
      return false;
    }
    if (match.players.has(playerId)) {
      sendTo(ws, { type: 'error', payload: { message: 'Already in this match' } });
      return false;
    }

    const spawnIndex = match.players.size % match.spawnPoints.length;
    const spawn = match.spawnPoints[spawnIndex];

    const player: FPSPlayer = {
      id: playerId,
      name: playerName,
      ws,
      x: spawn.x,
      y: spawn.y,
      z: 0,
      angle: spawn.angle,
      health: 100,
      alive: true,
      weaponIndex: 1,
      kills: 0,
      deaths: 0,
      ready: false,
      lastUpdateTime: 0,
      deathTime: 0,
    };

    match.players.set(playerId, player);
    this.playerMatchMap.set(playerId, matchId);

    // Notify all players
    this.broadcastToMatch(match, {
      type: 'fps_player_joined',
      payload: {
        playerId,
        name: playerName,
        playerCount: match.players.size,
        maxPlayers: match.maxPlayers,
      },
    });

    console.log(
      `[FPS] ${playerName} joined match ${matchId} (${match.players.size}/${match.maxPlayers})`,
    );
    return true;
  }

  handleReady(playerId: string): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return;
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'waiting') return;

    const player = match.players.get(playerId);
    if (!player) return;

    player.ready = true;

    // Check if all players are ready
    const readyCount = [...match.players.values()].filter((p) => p.ready).length;
    const totalPlayers = match.players.size;

    if (totalPlayers >= 2 && readyCount === totalPlayers) {
      this.startCountdown(match);
    } else if (totalPlayers >= 2 && readyCount >= 2) {
      // Auto-start after timeout if 2+ ready
      if (!match.countdownTimer) {
        match.countdownTimer = setTimeout(() => {
          if (match.status === 'waiting') {
            this.startCountdown(match);
          }
        }, READY_TIMEOUT);
      }
    }
  }

  handleUpdate(playerId: string, payload: Record<string, unknown>): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return;
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'playing') return;

    const player = match.players.get(playerId);
    if (!player || !player.alive) return;

    // Health is server-authoritative, not accepted from client
    const now = Date.now();
    const newX = typeof payload.x === 'number' ? payload.x : player.x;
    const newY = typeof payload.y === 'number' ? payload.y : player.y;

    // Map bounds check: clamp to valid area
    const clampedX = Math.max(0, Math.min(newX, match.mapWidth));
    const clampedY = Math.max(0, Math.min(newY, match.mapHeight));

    // Speed validation: reject teleports
    if (player.lastUpdateTime > 0) {
      const dt = (now - player.lastUpdateTime) / 1000; // seconds
      if (dt > 0) {
        const dx = clampedX - player.x;
        const dy = clampedY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist / dt > MAX_SPEED) {
          // Reject: keep old position, still update time
          player.lastUpdateTime = now;
          return;
        }
      }
    }

    player.x = clampedX;
    player.y = clampedY;
    if (typeof payload.z === 'number') player.z = payload.z;
    player.lastUpdateTime = now;

    if (typeof payload.angle === 'number') player.angle = payload.angle;
    if (typeof payload.weaponIndex === 'number') player.weaponIndex = payload.weaponIndex;
  }

  handleShoot(playerId: string, payload: Record<string, unknown>): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return;
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'playing') return;

    const player = match.players.get(playerId);
    if (!player || !player.alive) return;

    // Broadcast shot to other players
    this.broadcastToMatch(
      match,
      {
        type: 'fps_player_shot',
        payload: {
          playerId,
          angle: payload.angle ?? player.angle,
          weaponIndex: payload.weaponIndex ?? player.weaponIndex,
        },
      },
      playerId,
    );
  }

  handleHit(playerId: string, payload: Record<string, unknown>): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return;
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'playing') return;

    const attacker = match.players.get(playerId);
    const targetId = payload.targetId as string;
    const target = match.players.get(targetId);

    if (!attacker || !target || !attacker.alive || !target.alive) return;

    // Server-authoritative damage calculation using weapon table.
    // Client-provided damage is ignored entirely.
    const weaponStats = WEAPON_DAMAGE_TABLE[attacker.weaponIndex];
    if (!weaponStats) return; // Unknown weapon, reject the hit

    // Calculate distance between attacker and target positions
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const dz = (attacker.z ?? 0) - (target.z ?? 0);
    const distance = Math.hypot(dx, dy, dz);

    // Reject hits beyond the weapon's maximum effective range
    if (distance > weaponStats.maxRange) return;

    // Calculate damage with linear falloff between falloffStart and maxRange
    let damage = weaponStats.baseDamage;
    if (distance > weaponStats.falloffStart) {
      const falloffRange = weaponStats.maxRange - weaponStats.falloffStart;
      const falloffDistance = distance - weaponStats.falloffStart;
      const falloffMultiplier = 1 - falloffDistance / falloffRange;
      damage = Math.round(weaponStats.baseDamage * falloffMultiplier);
    }

    if (damage <= 0) return;

    target.health = Math.max(0, target.health - damage);

    // Broadcast hit with server-calculated damage
    this.broadcastToMatch(match, {
      type: 'fps_player_hit',
      payload: {
        targetId,
        attackerId: playerId,
        damage,
        newHealth: target.health,
      },
    });

    // Check for kill
    if (target.health <= 0) {
      target.alive = false;
      target.deathTime = Date.now();
      target.deaths++;
      attacker.kills++;

      const weaponName = WEAPON_NAMES[attacker.weaponIndex] || 'Unknown';

      this.broadcastToMatch(match, {
        type: 'fps_player_killed',
        payload: { victimId: targetId, killerId: playerId, weapon: weaponName },
      });

      // Broadcast updated scores
      this.broadcastScores(match);

      // Check for match end
      if (attacker.kills >= match.killsToWin) {
        this.endMatch(match, playerId);
        return;
      }

      // Schedule respawn
      target.respawnTimer = setTimeout(() => {
        this.respawnPlayer(match, targetId);
      }, RESPAWN_DELAY);
    }
  }

  handleRespawn(playerId: string): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return;
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'playing') return;

    const player = match.players.get(playerId);
    if (!player || player.alive) return;

    // Enforce minimum respawn delay to prevent bypass
    if (Date.now() - player.deathTime < RESPAWN_DELAY) return;

    // Clear existing timer if any
    if (player.respawnTimer) {
      clearTimeout(player.respawnTimer);
      player.respawnTimer = undefined;
    }

    this.respawnPlayer(match, playerId);
  }

  handleDisconnect(playerId: string): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return;
    const match = this.matches.get(matchId);
    if (!match) return;

    const player = match.players.get(playerId);
    if (player?.respawnTimer) {
      clearTimeout(player.respawnTimer);
    }

    match.players.delete(playerId);
    this.playerMatchMap.delete(playerId);

    this.broadcastToMatch(match, {
      type: 'fps_player_left',
      payload: { playerId },
    });

    console.log(`[FPS] Player ${playerId} left match ${matchId} (${match.players.size} remaining)`);

    // If match is playing and less than 2 players remain, end it
    if (match.status === 'playing' && match.players.size < 2) {
      const remaining = [...match.players.values()][0];
      this.endMatch(match, remaining?.id || null);
    }

    // Clean up empty matches
    if (match.players.size === 0) {
      this.cleanupMatch(match);
    }
  }

  // ---- Internal Helpers ----

  private startCountdown(match: FPSMatch): void {
    if (match.countdownTimer) {
      clearTimeout(match.countdownTimer);
      match.countdownTimer = undefined;
    }

    match.status = 'countdown';
    let remaining = COUNTDOWN_SECONDS;

    const tick = (): void => {
      if (remaining > 0) {
        this.broadcastToMatch(match, {
          type: 'fps_countdown',
          payload: { seconds: remaining },
        });
        remaining--;
        match.countdownTimer = setTimeout(tick, 1000);
      } else {
        this.startMatch(match);
      }
    };

    tick();
  }

  private startMatch(match: FPSMatch): void {
    match.status = 'playing';
    match.startTime = Date.now();

    // Assign spawn points
    const playerList = [...match.players.values()];
    const startPayload = playerList.map((p, i) => {
      const spawn = match.spawnPoints[i % match.spawnPoints.length];
      p.x = spawn.x;
      p.y = spawn.y;
      p.z = 0;
      p.angle = spawn.angle;
      p.health = 100;
      p.alive = true;
      return {
        id: p.id,
        name: p.name,
        spawnX: spawn.x,
        spawnY: spawn.y,
        spawnAngle: spawn.angle,
      };
    });

    this.broadcastToMatch(match, {
      type: 'fps_match_start',
      payload: { players: startPayload },
    });

    // Start 20Hz state broadcast
    match.broadcastInterval = setInterval(() => {
      this.broadcastState(match);
    }, BROADCAST_INTERVAL);

    // M1: Match timeout to prevent indefinite matches
    match.matchTimeout = setTimeout(() => {
      if (match.status !== 'playing') return;
      // Determine winner by most kills
      let bestPlayer: string | null = null;
      let bestKills = -1;
      for (const [id, p] of match.players) {
        if (p.kills > bestKills) {
          bestKills = p.kills;
          bestPlayer = id;
        }
      }
      console.log(`[FPS] Match ${match.id} timed out after ${MAX_MATCH_DURATION / 1000}s`);
      this.endMatch(match, bestPlayer);
    }, MAX_MATCH_DURATION);

    console.log(`[FPS] Match ${match.id} started with ${match.players.size} players`);
  }

  private broadcastState(match: FPSMatch): void {
    if (match.status !== 'playing') return;

    const players = [...match.players.values()].map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      angle: p.angle,
      health: p.health,
      weaponIndex: p.weaponIndex,
      alive: p.alive,
    }));

    this.broadcastToMatch(match, {
      type: 'fps_state',
      payload: { players },
    });
  }

  private broadcastScores(match: FPSMatch): void {
    const scores: Record<string, { kills: number; deaths: number }> = {};
    for (const [id, p] of match.players) {
      scores[id] = { kills: p.kills, deaths: p.deaths };
    }
    this.broadcastToMatch(match, {
      type: 'fps_score_update',
      payload: { scores },
    });
  }

  private respawnPlayer(match: FPSMatch, playerId: string): void {
    const player = match.players.get(playerId);
    if (!player || match.status !== 'playing') return;

    // Pick a random spawn point
    const spawn = match.spawnPoints[Math.floor(Math.random() * match.spawnPoints.length)];
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = 0;
    player.angle = spawn.angle;
    player.health = 100;
    player.alive = true;
    player.respawnTimer = undefined;

    this.broadcastToMatch(match, {
      type: 'fps_player_respawned',
      payload: {
        playerId,
        x: spawn.x,
        y: spawn.y,
        angle: spawn.angle,
      },
    });
  }

  private endMatch(match: FPSMatch, winnerId: string | null): void {
    match.status = 'ended';

    if (match.matchTimeout) {
      clearTimeout(match.matchTimeout);
      match.matchTimeout = undefined;
    }

    if (match.broadcastInterval) {
      clearInterval(match.broadcastInterval);
      match.broadcastInterval = undefined;
    }

    const scores: Record<string, { kills: number; deaths: number }> = {};
    for (const [id, p] of match.players) {
      scores[id] = { kills: p.kills, deaths: p.deaths };
      if (p.respawnTimer) {
        clearTimeout(p.respawnTimer);
        p.respawnTimer = undefined;
      }
    }

    const duration = Date.now() - match.startTime;

    this.broadcastToMatch(match, {
      type: 'fps_match_end',
      payload: { winnerId, scores, duration },
    });

    console.log(
      `[FPS] Match ${match.id} ended. Winner: ${winnerId ?? 'none'} (${Math.round(duration / 1000)}s)`,
    );

    // Clean up after a brief delay (let clients process the end message)
    setTimeout(() => {
      this.cleanupMatch(match);
    }, 5000);
  }

  private cleanupMatch(match: FPSMatch): void {
    if (match.broadcastInterval) clearInterval(match.broadcastInterval);
    if (match.countdownTimer) clearTimeout(match.countdownTimer);
    if (match.matchTimeout) clearTimeout(match.matchTimeout);
    for (const [id, p] of match.players) {
      if (p.respawnTimer) clearTimeout(p.respawnTimer);
      this.playerMatchMap.delete(id);
    }
    this.matches.delete(match.id);
    console.log(`[FPS] Match ${match.id} cleaned up`);
  }

  private broadcastToMatch(
    match: FPSMatch,
    message: { type: string; payload: Record<string, unknown> },
    excludePlayerId?: string,
  ): void {
    for (const [id, player] of match.players) {
      if (id === excludePlayerId) continue;
      if (player.ws.readyState === WebSocket.OPEN) {
        sendTo(player.ws, message);
      }
    }
  }
}

// Singleton instance
export const fpsSessionManager = new FPSSessionManager();

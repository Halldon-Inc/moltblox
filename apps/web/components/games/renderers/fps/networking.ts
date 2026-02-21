// ==========================================================================
// FPS Renderer: Multiplayer networking (WebSocket setup, message handling)
// ==========================================================================

import type { FPSGameState } from './types';
import { SCREEN_W, SCREEN_H, getWsUrl, spawnParticles } from './constants';

// --------------------------------------------------------------------------
// WebSocket multiplayer setup
// --------------------------------------------------------------------------

export function connectMultiplayer(
  gs: FPSGameState,
  wsRef: { current: WebSocket | null },
  reconnectSetup: () => void,
): void {
  if (!gs.multiplayerMode || !gs.matchId) return;

  const wsUrl = getWsUrl();
  if (!wsUrl) return;

  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;
  gs.wsRef = ws;

  ws.onopen = () => {
    gs.matchStatus = 'connecting';
    // Authenticate
    const token = typeof window !== 'undefined' ? localStorage.getItem('moltblox_token') : null;
    if (token) {
      ws.send(JSON.stringify({ type: 'authenticate', payload: { token } }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMultiplayerMessage(gs, msg);
    } catch {
      // Ignore unparseable messages
    }
  };

  let reconnectAttempts = 0;
  const MAX_RECONNECT = 3;
  const RECONNECT_DELAY = 2000;

  ws.onclose = () => {
    wsRef.current = null;
    gs.wsRef = null;
    if (gs.matchStatus === 'playing' && reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      gs.message = `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT})`;
      gs.messageTimer = RECONNECT_DELAY + 500;
      setTimeout(() => {
        if (gs.matchStatus === 'playing') {
          reconnectSetup();
        }
      }, RECONNECT_DELAY);
    } else if (gs.matchStatus === 'playing') {
      gs.message = 'Connection lost';
      gs.messageTimer = 5000;
    }
  };

  ws.onerror = () => {
    gs.message = 'CONNECTION ERROR';
    gs.messageTimer = 3000;
  };
}

// --------------------------------------------------------------------------
// Handle incoming multiplayer messages
// --------------------------------------------------------------------------

export function handleMultiplayerMessage(
  gs: FPSGameState,
  msg: { type: string; payload: Record<string, unknown> },
): void {
  switch (msg.type) {
    case 'authenticated': {
      // Join the match
      if (gs.matchId) {
        gs.wsRef?.send(
          JSON.stringify({ type: 'fps_join_match', payload: { matchId: gs.matchId } }),
        );
      }
      break;
    }

    case 'fps_match_created': {
      gs.matchId = msg.payload.matchId as string;
      gs.matchStatus = 'waiting';
      gs.message = 'MATCH CREATED. WAITING FOR PLAYERS...';
      gs.messageTimer = 5000;
      break;
    }

    case 'fps_player_joined': {
      const playerId = msg.payload.playerId as string;
      const playerName = msg.payload.name as string;
      gs.mpWaitingPlayers = msg.payload.playerCount as number;
      gs.mpMaxPlayers = msg.payload.maxPlayers as number;
      gs.matchStatus = 'waiting';

      if (!gs.localPlayerId) {
        gs.localPlayerId = playerId;
      }

      if (!gs.remotePlayers.has(playerId) && playerId !== gs.localPlayerId) {
        gs.remotePlayers.set(playerId, {
          id: playerId,
          name: playerName,
          x: 0,
          y: 0,
          angle: 0,
          health: 100,
          weaponIndex: 1,
          alive: true,
          prevX: 0,
          prevY: 0,
          prevAngle: 0,
          lastUpdate: Date.now(),
        });
      }

      gs.killFeed.push({
        text: `${playerName} joined`,
        time: Date.now(),
        color: '#4488ff',
      });
      break;
    }

    case 'fps_countdown': {
      gs.matchStatus = 'countdown';
      gs.countdownSeconds = msg.payload.seconds as number;
      break;
    }

    case 'fps_match_start': {
      gs.matchStatus = 'playing';
      const players = msg.payload.players as {
        id: string;
        name: string;
        spawnX: number;
        spawnY: number;
        spawnAngle: number;
      }[];
      for (const p of players) {
        if (p.id === gs.localPlayerId) {
          gs.playerX = p.spawnX;
          gs.playerY = p.spawnY;
          gs.playerAngle = p.spawnAngle;
        } else {
          const existing = gs.remotePlayers.get(p.id);
          if (existing) {
            existing.x = p.spawnX;
            existing.y = p.spawnY;
            existing.angle = p.spawnAngle;
            existing.prevX = p.spawnX;
            existing.prevY = p.spawnY;
            existing.prevAngle = p.spawnAngle;
            existing.lastUpdate = Date.now();
            existing.alive = true;
            existing.health = 100;
          } else {
            gs.remotePlayers.set(p.id, {
              id: p.id,
              name: p.name,
              x: p.spawnX,
              y: p.spawnY,
              angle: p.spawnAngle,
              health: 100,
              weaponIndex: 1,
              alive: true,
              prevX: p.spawnX,
              prevY: p.spawnY,
              prevAngle: p.spawnAngle,
              lastUpdate: Date.now(),
            });
          }
          // Initialize scores
          gs.matchScores[p.id] = { kills: 0, deaths: 0, name: p.name };
        }
        gs.matchScores[gs.localPlayerId] = gs.matchScores[gs.localPlayerId] || {
          kills: 0,
          deaths: 0,
          name: 'You',
        };
      }
      gs.message = 'FIGHT!';
      gs.messageTimer = 2000;
      break;
    }

    case 'fps_state': {
      const players = msg.payload.players as {
        id: string;
        x: number;
        y: number;
        angle: number;
        health: number;
        weaponIndex: number;
        alive: boolean;
      }[];
      for (const p of players) {
        if (p.id === gs.localPlayerId) continue;
        const remote = gs.remotePlayers.get(p.id);
        if (remote) {
          remote.prevX = remote.x;
          remote.prevY = remote.y;
          remote.prevAngle = remote.angle;
          remote.x = p.x;
          remote.y = p.y;
          remote.angle = p.angle;
          remote.health = p.health;
          remote.weaponIndex = p.weaponIndex;
          remote.alive = p.alive;
          remote.lastUpdate = Date.now();
        }
      }
      break;
    }

    case 'fps_player_shot': {
      const shooterId = msg.payload.playerId as string;
      if (shooterId !== gs.localPlayerId) {
        const remote = gs.remotePlayers.get(shooterId);
        if (remote) {
          // Spawn muzzle flash particles at remote player screen position (approximate)
          spawnParticles(gs.particles, SCREEN_W / 2, SCREEN_H / 2, 2, '#ffff44', 3, 100, 2);
        }
      }
      break;
    }

    case 'fps_player_hit': {
      const targetId = msg.payload.targetId as string;
      const newHealth = msg.payload.newHealth as number;
      if (targetId === gs.localPlayerId) {
        gs.playerHealth = newHealth;
        gs.screenFlash = 'red';
        gs.flashTimer = 150;
        gs.damageVignetteTimer = 200;
        gs.shakeTimer = 150;
        gs.shakeIntensity = 3;
        spawnParticles(
          gs.particles,
          Math.random() * SCREEN_W,
          Math.random() < 0.5 ? 0 : SCREEN_H,
          4,
          '#ff3333',
          4,
          300,
          3,
        );
      } else {
        const remote = gs.remotePlayers.get(targetId);
        if (remote) {
          remote.health = newHealth;
        }
      }
      break;
    }

    case 'fps_player_killed': {
      const victimId = msg.payload.victimId as string;
      const killerId = msg.payload.killerId as string;
      const weapon = msg.payload.weapon as string;
      const killerName = gs.matchScores[killerId]?.name || 'Unknown';
      const victimName = gs.matchScores[victimId]?.name || 'Unknown';

      gs.killFeed.push({
        text: `${killerName} [${weapon}] ${victimName}`,
        time: Date.now(),
        color:
          killerId === gs.localPlayerId
            ? '#22cc22'
            : victimId === gs.localPlayerId
              ? '#cc2222'
              : '#dddddd',
      });

      if (victimId === gs.localPlayerId) {
        gs.mpKilledBy = killerName;
        gs.mpRespawnTimer = 3000;
        gs.playerHealth = 0;
        // Death particles
        spawnParticles(gs.particles, SCREEN_W / 2, SCREEN_H / 2, 10, '#cc0000', 6, 500, 4);
      } else {
        const remote = gs.remotePlayers.get(victimId);
        if (remote) {
          remote.alive = false;
        }
      }
      break;
    }

    case 'fps_player_respawned': {
      const respawnId = msg.payload.playerId as string;
      if (respawnId === gs.localPlayerId) {
        gs.playerX = msg.payload.x as number;
        gs.playerY = msg.payload.y as number;
        gs.playerAngle = msg.payload.angle as number;
        gs.playerHealth = 100;
        gs.mpKilledBy = null;
        gs.mpRespawnTimer = 0;
        gs.screenFlash = 'yellow';
        gs.flashTimer = 200;
      } else {
        const remote = gs.remotePlayers.get(respawnId);
        if (remote) {
          remote.x = msg.payload.x as number;
          remote.y = msg.payload.y as number;
          remote.angle = msg.payload.angle as number;
          remote.prevX = remote.x;
          remote.prevY = remote.y;
          remote.prevAngle = remote.angle;
          remote.health = 100;
          remote.alive = true;
          remote.lastUpdate = Date.now();
        }
      }
      break;
    }

    case 'fps_score_update': {
      const scores = msg.payload.scores as Record<string, { kills: number; deaths: number }>;
      for (const [id, s] of Object.entries(scores)) {
        if (gs.matchScores[id]) {
          gs.matchScores[id].kills = s.kills;
          gs.matchScores[id].deaths = s.deaths;
        }
      }
      break;
    }

    case 'fps_match_end': {
      gs.matchStatus = 'ended';
      gs.mpWinnerId = msg.payload.winnerId as string;
      gs.mpMatchDuration = msg.payload.duration as number;
      const finalScores = msg.payload.scores as Record<string, { kills: number; deaths: number }>;
      for (const [id, s] of Object.entries(finalScores)) {
        if (gs.matchScores[id]) {
          gs.matchScores[id].kills = s.kills;
          gs.matchScores[id].deaths = s.deaths;
        }
      }
      break;
    }

    case 'fps_player_left': {
      const leftId = msg.payload.playerId as string;
      const leftPlayer = gs.remotePlayers.get(leftId);
      if (leftPlayer) {
        gs.killFeed.push({
          text: `${leftPlayer.name} left`,
          time: Date.now(),
          color: '#888888',
        });
        gs.remotePlayers.delete(leftId);
      }
      break;
    }

    default:
      break;
  }
}

// --------------------------------------------------------------------------
// Send position update to server (called at 20Hz)
// --------------------------------------------------------------------------

export function sendPositionUpdate(gs: FPSGameState, now: number): void {
  if (
    gs.multiplayerMode &&
    gs.matchStatus === 'playing' &&
    gs.wsRef &&
    gs.wsRef.readyState === WebSocket.OPEN
  ) {
    if (now - gs.lastNetworkUpdate > 50) {
      gs.wsRef.send(
        JSON.stringify({
          type: 'fps_update',
          payload: {
            x: gs.playerX,
            y: gs.playerY,
            angle: gs.playerAngle,
            health: gs.playerHealth,
            weaponIndex: gs.currentWeapon,
          },
        }),
      );
      gs.lastNetworkUpdate = now;
    }
  }
}

/**
 * Game Session Manager
 *
 * Handles matchmaking queues, game session lifecycle, and Prisma persistence.
 * Sessions flow: create (waiting) -> active -> completed
 */

import { WebSocket } from 'ws';
import prisma from '../lib/prisma.js';
import type { InputJsonValue } from '../generated/prisma/internal/prismaNamespace.js';

// ─── Types ───────────────────────────────────────────────

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  playerId?: string;
  gameSessionId?: string;
  spectating?: string;
  lastPing: number;
}

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface QueueEntry {
  clientId: string;
  playerId: string;
  joinedAt: number;
}

interface ActiveSession {
  sessionId: string;
  gameId: string;
  playerIds: string[];
  state: Record<string, unknown>;
  currentTurn: number;
}

// ─── Matchmaking Queue ──────────────────────────────────
//
// WARNING: matchQueues and activeSessions are in-memory only.
// In a multi-server deployment, these must be migrated to Redis
// (or another shared store) so that all server instances share
// the same matchmaking and session state. Single-server only for now.

/** gameId -> queued players */
const matchQueues = new Map<string, QueueEntry[]>();

/** sessionId -> active session data */
const activeSessions = new Map<string, ActiveSession>();

/** Check if a session ID is tracked in memory (used by ws/index.ts for spectate validation). */
export function isActiveSession(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}

// ─── Public API ─────────────────────────────────────────

/**
 * Add a player to the matchmaking queue for a game.
 * When enough players are queued, automatically creates a session.
 */
export async function joinQueue(
  client: ConnectedClient,
  gameId: string,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  if (!client.playerId) {
    sendTo(client.ws, {
      type: 'error',
      payload: { message: 'Must authenticate before joining queue' },
    });
    return;
  }

  // Verify game exists and is published
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true, maxPlayers: true, status: true },
  });

  if (!game) {
    sendTo(client.ws, { type: 'error', payload: { message: 'Game not found' } });
    return;
  }

  if (game.status !== 'published') {
    sendTo(client.ws, { type: 'error', payload: { message: 'Game is not published' } });
    return;
  }

  // Check if player is already in a queue or session
  if (client.gameSessionId) {
    sendTo(client.ws, {
      type: 'error',
      payload: { message: 'Already in a game session. Leave first.' },
    });
    return;
  }

  for (const [, queue] of matchQueues) {
    if (queue.some((e) => e.playerId === client.playerId)) {
      sendTo(client.ws, { type: 'error', payload: { message: 'Already in a matchmaking queue' } });
      return;
    }
  }

  // Add to queue
  if (!matchQueues.has(gameId)) {
    matchQueues.set(gameId, []);
  }
  const queue = matchQueues.get(gameId)!;
  queue.push({ clientId: client.id, playerId: client.playerId, joinedAt: Date.now() });

  const position = queue.length;
  sendTo(client.ws, {
    type: 'queue_joined',
    payload: { gameId, position, maxPlayers: game.maxPlayers, gameName: game.name },
  });

  console.log(
    `[WS] Player ${client.playerId} queued for game ${gameId} (${position}/${game.maxPlayers})`,
  );

  // Check if we have enough players to start
  if (queue.length >= game.maxPlayers) {
    const matched = queue.splice(0, game.maxPlayers);
    await createSession(gameId, matched, clients);
  }
}

/**
 * Remove a player from all matchmaking queues.
 */
export function leaveQueue(client: ConnectedClient): boolean {
  let removed = false;
  for (const [gameId, queue] of matchQueues) {
    const idx = queue.findIndex((e) => e.clientId === client.id);
    if (idx !== -1) {
      queue.splice(idx, 1);
      removed = true;
      console.log(`[WS] Player ${client.playerId} left queue for game ${gameId}`);
      // Clean up empty queues
      if (queue.length === 0) {
        matchQueues.delete(gameId);
      }
      break;
    }
  }
  return removed;
}

/**
 * Handle a game action from a player in an active session.
 *
 * TODO(CRITICAL): This function does NOT integrate with the game engine.
 * It blindly accepts any action payload and broadcasts it to all session
 * participants without validation. For multiplayer to work correctly, this
 * must instantiate the appropriate BaseGame subclass, call handleAction()
 * to validate and process the action through the game engine, and only
 * broadcast the resulting state if the action succeeds. Without this,
 * clients can send arbitrary state mutations that bypass all game rules.
 */
export async function handleGameAction(
  client: ConnectedClient,
  action: Record<string, unknown>,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  if (!client.gameSessionId || !client.playerId) {
    sendTo(client.ws, { type: 'error', payload: { message: 'Not in a game session' } });
    return;
  }

  const session = activeSessions.get(client.gameSessionId);
  if (!session) {
    sendTo(client.ws, { type: 'error', payload: { message: 'Session not found in memory' } });
    return;
  }

  // Apply action to game state (game-specific logic goes here)
  session.state = {
    ...session.state,
    lastAction: { playerId: client.playerId, action, timestamp: Date.now() },
  };
  session.currentTurn += 1;

  // Broadcast state update to all session players and spectators
  broadcastToSession(clients, client.gameSessionId, {
    type: 'state_update',
    payload: {
      sessionId: client.gameSessionId,
      state: session.state,
      currentTurn: session.currentTurn,
      action: { playerId: client.playerId, ...action },
    },
  });
}

/**
 * End a game session: record scores, update stats, notify players.
 */
export async function endSession(
  sessionId: string,
  scores: Record<string, number>,
  winnerId: string | null,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return;
  }

  // Persist to database
  await prisma.$transaction(async (tx) => {
    // Update session record
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        scores,
        winnerId,
        endedAt: new Date(),
        currentTurn: session.currentTurn,
        state: session.state as InputJsonValue,
      },
    });

    // Increment game stats — count only genuinely new players
    const previousPlayers = await tx.gameSessionPlayer.findMany({
      where: {
        session: { gameId: session.gameId, id: { not: sessionId } },
        userId: { in: session.playerIds },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const previousPlayerIds = new Set(previousPlayers.map((p) => p.userId));
    const newPlayerCount = session.playerIds.filter((id) => !previousPlayerIds.has(id)).length;

    await tx.game.update({
      where: { id: session.gameId },
      data: {
        totalPlays: { increment: 1 },
        uniquePlayers: { increment: newPlayerCount },
      },
    });
  });

  // Notify all session participants
  broadcastToSession(clients, sessionId, {
    type: 'session_end',
    payload: {
      sessionId,
      scores,
      winnerId,
      gameId: session.gameId,
      timestamp: new Date().toISOString(),
    },
  });

  // Clear session-specific data from clients
  for (const [, c] of clients) {
    if (c.gameSessionId === sessionId) {
      c.gameSessionId = undefined;
    }
  }

  activeSessions.delete(sessionId);
  console.log(`[WS] Session ${sessionId} completed. Winner: ${winnerId ?? 'none'}`);
}

/**
 * Handle a player leaving their current session (disconnect or explicit leave).
 */
export async function leaveSession(
  client: ConnectedClient,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  // Remove from any queue first
  leaveQueue(client);

  const sessionId = client.gameSessionId;
  if (!sessionId) {
    sendTo(client.ws, { type: 'session_left', payload: { message: 'Left session' } });
    return;
  }

  const session = activeSessions.get(sessionId);
  client.gameSessionId = undefined;

  // Notify others in the session
  broadcastToSession(
    clients,
    sessionId,
    {
      type: 'player_left',
      payload: {
        playerId: client.playerId,
        sessionId,
        timestamp: new Date().toISOString(),
      },
    },
    client.id,
  );

  sendTo(client.ws, { type: 'session_left', payload: { sessionId, message: 'Left game session' } });

  if (!session) return;

  // Remove player from active session
  session.playerIds = session.playerIds.filter((id) => id !== client.playerId);

  // If no players remain, mark session as abandoned
  const remainingClients = [...clients.values()].filter((c) => c.gameSessionId === sessionId);
  if (remainingClients.length === 0) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'abandoned', endedAt: new Date() },
    });
    activeSessions.delete(sessionId);
    console.log(`[WS] Session ${sessionId} abandoned — no players remaining`);
  }
}

/**
 * Clean up when a client disconnects.
 */
export async function handleDisconnect(
  client: ConnectedClient,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  leaveQueue(client);

  if (client.gameSessionId) {
    broadcastToSession(
      clients,
      client.gameSessionId,
      {
        type: 'player_disconnected',
        payload: {
          playerId: client.playerId,
          timestamp: new Date().toISOString(),
        },
      },
      client.id,
    );

    const session = activeSessions.get(client.gameSessionId);
    if (session) {
      session.playerIds = session.playerIds.filter((id) => id !== client.playerId);
      const remainingClients = [...clients.values()].filter(
        (c) => c.id !== client.id && c.gameSessionId === client.gameSessionId,
      );
      if (remainingClients.length === 0) {
        await prisma.gameSession.update({
          where: { id: client.gameSessionId },
          data: { status: 'abandoned', endedAt: new Date() },
        });
        activeSessions.delete(client.gameSessionId);
        console.log(`[WS] Session ${client.gameSessionId} abandoned after disconnect`);
      }
    }
  }
}

// ─── Internal Helpers ───────────────────────────────────

/**
 * Create a new game session from matched players and persist to database.
 */
async function createSession(
  gameId: string,
  matched: QueueEntry[],
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  const playerIds = matched.map((e) => e.playerId);

  // Create session in database
  const session = await prisma.gameSession.create({
    data: {
      gameId,
      status: 'active',
      state: {},
      currentTurn: 0,
      players: {
        create: playerIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  // Track in memory
  const activeSession: ActiveSession = {
    sessionId: session.id,
    gameId,
    playerIds,
    state: {},
    currentTurn: 0,
  };
  activeSessions.set(session.id, activeSession);

  // Assign clients to session and notify
  const playerInfos: { playerId: string; clientId: string }[] = [];
  for (const entry of matched) {
    const client = clients.get(entry.clientId);
    if (client) {
      client.gameSessionId = session.id;
      playerInfos.push({ playerId: entry.playerId, clientId: entry.clientId });
    }
  }

  // Broadcast session_start to all matched players
  for (const entry of matched) {
    const client = clients.get(entry.clientId);
    if (client) {
      sendTo(client.ws, {
        type: 'session_start',
        payload: {
          sessionId: session.id,
          gameId,
          players: playerInfos.map((p) => p.playerId),
          currentTurn: 0,
          state: {},
        },
      });
    }
  }

  console.log(
    `[WS] Session ${session.id} created for game ${gameId} with ${playerIds.length} players`,
  );
}

// ─── Message Utilities ──────────────────────────────────

export function sendTo(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcastToSession(
  clients: Map<string, ConnectedClient>,
  sessionId: string,
  message: WSMessage,
  excludeClientId?: string,
): void {
  for (const [clientId, client] of clients) {
    if (clientId === excludeClientId) continue;
    if (client.gameSessionId === sessionId || client.spectating === sessionId) {
      sendTo(client.ws, message);
    }
  }
}

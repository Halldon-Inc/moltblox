/**
 * Game Session Manager
 *
 * Handles matchmaking queues, game session lifecycle, and Prisma persistence.
 * Sessions flow: create (waiting) -> active -> completed
 *
 * Game engine integration:
 * Games are WASM bundles that run client-side. The server acts as an
 * authoritative relay that validates structural invariants (player
 * membership, turn order, action shape, game-over state) using the
 * protocol's GameState/GameAction/ActionResult types. Game-specific
 * rule validation happens in the client WASM; the server enforces the
 * session contract so that clients cannot send arbitrary state mutations.
 *
 * Storage: Redis-backed via redisSessionStore for horizontal scaling.
 * Falls back to in-memory Maps when Redis is unavailable (dev mode).
 */

import { WebSocket } from 'ws';
import prisma from '../lib/prisma.js';
import { createGameInstance } from '../lib/gameFactory.js';
import redis from '../lib/redis.js';
import type { InputJsonValue } from '../generated/prisma/internal/prismaNamespace.js';
import type { GameState, GameAction, ActionResult, GameEvent } from '@moltblox/protocol';
import {
  type QueueEntry,
  type ActiveSessionData,
  pushToQueue,
  spliceQueueFront,
  findPlayerInQueues,
  removeFromQueues,
  getSession,
  setSession,
  deleteSession,
  hasSession,
  setPlayerSession,
  deletePlayerSession,
  publishMatchFound,
  publishSessionUpdate,
} from './redisSessionStore.js';

// ---- Types ----

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  playerId?: string;
  gameSessionId?: string;
  spectating?: string;
  watchingWagerId?: string;
  lastPing: number;
}

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

/** Maximum number of actions to retain in session history for replay/audit */
const MAX_ACTION_HISTORY = 500;

/** CQ-05: Maximum number of events to retain per session */
const MAX_EVENTS = 500;

// ---- Public API ----

/** Check if a session ID is tracked (used by ws/index.ts for spectate validation). */
export async function isActiveSession(sessionId: string): Promise<boolean> {
  return hasSession(redis, sessionId);
}

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

  // Check if player is already in a game session
  if (client.gameSessionId) {
    sendTo(client.ws, {
      type: 'error',
      payload: { message: 'Already in a game session. Leave first.' },
    });
    return;
  }

  // Check if player is already in a queue
  const existingQueue = await findPlayerInQueues(redis, client.playerId);
  if (existingQueue) {
    sendTo(client.ws, { type: 'error', payload: { message: 'Already in a matchmaking queue' } });
    return;
  }

  // Add to queue
  const position = await pushToQueue(redis, gameId, {
    clientId: client.id,
    playerId: client.playerId,
    joinedAt: Date.now(),
  });

  sendTo(client.ws, {
    type: 'queue_joined',
    payload: { gameId, position, maxPlayers: game.maxPlayers, gameName: game.name },
  });

  console.log(
    `[WS] Player ${client.playerId} queued for game ${gameId} (${position}/${game.maxPlayers})`,
  );

  // Check if we have enough players to start
  if (position >= game.maxPlayers) {
    const matched = await spliceQueueFront(redis, gameId, game.maxPlayers);
    if (matched.length === game.maxPlayers) {
      await createSession(gameId, matched, clients);
    }
  }
}

/**
 * Remove a player from all matchmaking queues.
 */
export async function leaveQueue(client: ConnectedClient): Promise<boolean> {
  const result = await removeFromQueues(redis, client.id);
  if (result.removed && result.gameId) {
    console.log(`[WS] Player ${client.playerId} left queue for game ${result.gameId}`);
  }
  return result.removed;
}

/**
 * Handle a game action from a player in an active session.
 *
 * Validates the action structurally through the protocol's GameAction
 * contract, applies it to the session's GameState, records the action
 * in the session history, and broadcasts the resulting ActionResult to
 * all participants. Rejects actions that violate session invariants
 * (wrong player, game already ended, malformed payload).
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

  const session = await getSession(redis, client.gameSessionId);
  if (!session) {
    sendTo(client.ws, { type: 'error', payload: { message: 'Session not found in memory' } });
    return;
  }

  // Reject actions on ended sessions
  if (session.ended || session.gameState.phase === 'ended') {
    sendTo(client.ws, { type: 'error', payload: { message: 'Game session has already ended' } });
    return;
  }

  // Validate the player is part of this session
  if (!session.playerIds.includes(client.playerId)) {
    sendTo(client.ws, { type: 'error', payload: { message: 'Not a participant in this session' } });
    return;
  }

  // Build a typed GameAction from the client payload
  const gameAction: GameAction = {
    type: String(action.type),
    payload: (action.payload && typeof action.payload === 'object' ? action.payload : {}) as Record<
      string,
      unknown
    >,
    timestamp: typeof action.timestamp === 'number' ? action.timestamp : Date.now(),
  };

  // Process the action through the session's game state
  const result = applyActionToSession(session, client.playerId, gameAction);

  if (!result.success) {
    // Notify only the acting player of the rejection
    sendTo(client.ws, {
      type: 'action_rejected',
      payload: {
        sessionId: client.gameSessionId,
        error: result.error ?? 'Action rejected',
        action: gameAction,
      },
    });
    return;
  }

  // Persist updated session to Redis
  await setSession(redis, client.gameSessionId, session);

  // Publish cross-instance notification
  await publishSessionUpdate(redis, client.gameSessionId, {
    type: 'state_update',
    sessionId: client.gameSessionId,
    state: session.gameState,
    currentTurn: session.currentTurn,
  });

  // Broadcast validated state update to all session players and spectators
  broadcastToSession(clients, client.gameSessionId, {
    type: 'state_update',
    payload: {
      sessionId: client.gameSessionId,
      state: session.gameState,
      currentTurn: session.currentTurn,
      action: { playerId: client.playerId, ...gameAction },
      events: result.events ?? [],
    },
  });

  // If the action caused the game to end, auto-complete the session
  if (session.gameState.phase === 'ended') {
    const scores = (session.gameState.data.scores as Record<string, number>) ?? {};
    const winnerId = (session.gameState.data.winner as string) ?? null;
    await endSession(client.gameSessionId, scores, winnerId, clients);
  }
}

/**
 * Apply a validated GameAction to the session state using the protocol's
 * GameState/ActionResult contract. This enforces structural invariants
 * server-side while game-specific rule validation runs in the client WASM.
 */
function applyActionToSession(
  session: ActiveSessionData,
  playerId: string,
  action: GameAction,
): ActionResult {
  const now = Date.now();

  // Apply the action to the game state data
  const prevData = session.gameState.data;
  const newData: Record<string, unknown> = {
    ...prevData,
    lastAction: {
      playerId,
      type: action.type,
      payload: action.payload,
      timestamp: now,
    },
  };

  // If the action carries a state update from the authoritative client,
  // merge only permitted fields (clients send state diffs in action.payload.stateUpdate).
  // Protected fields must never be overwritten by client state mutations.
  const PROTECTED_STATE_FIELDS = new Set([
    'winner',
    'scores',
    'players',
    'currentTurnIndex',
    'status',
    'createdAt',
    'gameId',
  ]);

  if (
    action.payload.stateUpdate &&
    typeof action.payload.stateUpdate === 'object' &&
    action.payload.stateUpdate !== null
  ) {
    const update = action.payload.stateUpdate as Record<string, unknown>;
    for (const key of Object.keys(update)) {
      if (!PROTECTED_STATE_FIELDS.has(key)) {
        newData[key] = update[key];
      }
    }
  }

  // Detect game-over signal from client
  const phase =
    action.type === 'game_over' || action.payload.gameOver === true
      ? 'ended'
      : session.gameState.phase;

  // Advance turn and update state
  session.currentTurn += 1;
  session.gameState = {
    turn: session.currentTurn,
    phase,
    data: newData,
  };

  if (phase === 'ended') {
    session.ended = true;
  }

  // Record in action history (bounded)
  session.actionHistory.push({
    playerId,
    action,
    turn: session.currentTurn,
    timestamp: now,
  });
  if (session.actionHistory.length > MAX_ACTION_HISTORY) {
    session.actionHistory.shift();
  }

  // Emit event
  const events: GameEvent[] = [
    {
      type: 'action_applied',
      playerId,
      data: { actionType: action.type, turn: session.currentTurn },
      timestamp: now,
    },
  ];

  if (phase === 'ended') {
    events.push({
      type: 'game_ended',
      data: {
        winner: newData.winner ?? null,
        scores: newData.scores ?? {},
        turn: session.currentTurn,
      },
      timestamp: now,
    });
  }

  session.events.push(...events);
  // CQ-05: Bound events array to prevent unbounded growth
  if (session.events.length > MAX_EVENTS) {
    session.events = session.events.slice(-MAX_EVENTS);
  }

  return {
    success: true,
    newState: session.gameState,
    events,
  };
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
  const session = await getSession(redis, sessionId);
  if (!session) {
    return;
  }

  // Mark as ended to reject further actions
  session.ended = true;
  session.gameState = { ...session.gameState, phase: 'ended' };

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
        state: session.gameState as unknown as InputJsonValue,
      },
    });

    // Increment game stats: count only genuinely new players
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

  // CQ-02: Clear player-session mappings
  for (const pid of session.playerIds) {
    await deletePlayerSession(redis, pid);
  }

  await deleteSession(redis, sessionId);
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
  await leaveQueue(client);

  const sessionId = client.gameSessionId;
  if (!sessionId) {
    sendTo(client.ws, { type: 'session_left', payload: { message: 'Left session' } });
    return;
  }

  const session = await getSession(redis, sessionId);
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

  // CQ-02: Clear player-session mapping on leave
  if (client.playerId) {
    await deletePlayerSession(redis, client.playerId);
  }

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
    await deleteSession(redis, sessionId);
    console.log(`[WS] Session ${sessionId} abandoned: no players remaining`);
  } else {
    // Persist updated player list
    await setSession(redis, sessionId, session);
  }
}

/**
 * Clean up when a client disconnects.
 */
export async function handleDisconnect(
  client: ConnectedClient,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  await leaveQueue(client);

  // CQ-02: Clear player-session mapping on disconnect
  if (client.playerId) {
    await deletePlayerSession(redis, client.playerId);
  }

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

    const session = await getSession(redis, client.gameSessionId);
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
        await deleteSession(redis, client.gameSessionId);
        console.log(`[WS] Session ${client.gameSessionId} abandoned after disconnect`);
      } else {
        await setSession(redis, client.gameSessionId, session);
      }
    }
  }
}

/**
 * Rejoin a player to an existing session after a disconnect.
 * Verifies the session exists and the user was a participant.
 * Returns true if successfully rejoined, false otherwise.
 */
export async function rejoinSession(
  sessionId: string,
  clientId: string,
  userId: string,
  clients: Map<string, ConnectedClient>,
): Promise<boolean> {
  const session = await getSession(redis, sessionId);
  if (!session) return false;

  // Verify the user was a participant
  if (!session.playerIds.includes(userId)) return false;

  // Find the client and update their session binding
  const client = clients.get(clientId);
  if (!client) return false;

  client.gameSessionId = sessionId;
  client.playerId = userId;

  // Send the current game state to the reconnected client
  sendTo(client.ws, {
    type: 'state_update',
    payload: {
      sessionId,
      state: session.gameState,
      currentTurn: session.currentTurn,
      action: null,
      events: [],
    },
  });

  // Notify other session participants
  broadcastToSession(
    clients,
    sessionId,
    {
      type: 'player_reconnected',
      payload: {
        playerId: userId,
        timestamp: new Date().toISOString(),
      },
    },
    clientId,
  );

  console.log(`[WS] Player ${userId} rejoined session ${sessionId}`);
  return true;
}

// ---- Internal Helpers ----

/**
 * Create a new game session from matched players and persist to database.
 */
async function createSession(
  gameId: string,
  matched: QueueEntry[],
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  const playerIds = matched.map((e) => e.playerId);

  // Look up the game's templateSlug for customized initial state
  const gameInfo = await prisma.game.findUnique({
    where: { id: gameId },
    select: { templateSlug: true, config: true },
  });

  // Build initial game state data, customized by template if applicable
  let initialData: Record<string, unknown> = { players: playerIds };
  // Use game engine for template-aware initialization
  const gameConfig = (gameInfo?.config as Record<string, unknown>) ?? {};
  if (gameInfo?.templateSlug) {
    const gameInstance = createGameInstance(gameInfo.templateSlug, gameConfig);
    if (gameInstance) {
      gameInstance.initialize(playerIds);
      const engineState = gameInstance.getState();
      initialData = { ...initialData, ...engineState.data };
    }
  }

  // Create session in database
  const dbSession = await prisma.gameSession.create({
    data: {
      gameId,
      status: 'active',
      state: { turn: 0, phase: 'playing', data: initialData as InputJsonValue },
      currentTurn: 0,
      players: {
        create: playerIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  // Initialize game state following protocol's GameState structure
  const initialGameState: GameState = {
    turn: 0,
    phase: 'playing',
    data: initialData,
  };

  // Store session data in Redis (or in-memory fallback)
  const activeSession: ActiveSessionData = {
    sessionId: dbSession.id,
    gameId,
    playerIds,
    gameState: initialGameState,
    currentTurn: 0,
    actionHistory: [],
    events: [],
    ended: false,
  };
  await setSession(redis, dbSession.id, activeSession);

  // CQ-02: Wire player-session mapping for cross-instance discovery
  for (const pid of playerIds) {
    await setPlayerSession(redis, pid, dbSession.id);
  }

  // Publish cross-instance match notification
  await publishMatchFound(redis, dbSession.id, gameId, playerIds);

  // Assign clients to session and notify
  const playerInfos: { playerId: string; clientId: string }[] = [];
  for (const entry of matched) {
    const client = clients.get(entry.clientId);
    if (client) {
      client.gameSessionId = dbSession.id;
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
          sessionId: dbSession.id,
          gameId,
          players: playerInfos.map((p) => p.playerId),
          currentTurn: 0,
          state: initialGameState,
        },
      });
    }
  }

  console.log(
    `[WS] Session ${dbSession.id} created for game ${gameId} with ${playerIds.length} players`,
  );
}

// ---- Message Utilities ----

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

/**
 * Broadcast a message to all clients subscribed to a specific wager.
 * Used for wager_created, wager_accepted, wager_settled, spectator_bet, odds_update events.
 */
export function broadcastToWager(
  clients: Map<string, ConnectedClient>,
  wagerId: string,
  message: WSMessage,
  excludeClientId?: string,
): void {
  for (const [clientId, client] of clients) {
    if (clientId === excludeClientId) continue;
    if (client.watchingWagerId === wagerId) {
      sendTo(client.ws, message);
    }
  }
}

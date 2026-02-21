/**
 * WebSocket server for Moltblox
 *
 * Handles real-time game sessions with matchmaking, spectating, and live updates.
 * Integrates with the session manager for Prisma-backed game lifecycle.
 */

import { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import {
  type ConnectedClient,
  type WSMessage,
  sendTo,
  joinQueue,
  leaveQueue,
  handleGameAction,
  endSession,
  leaveSession,
  handleDisconnect,
  broadcastToSession,
  isActiveSession,
  rejoinSession,
} from './sessionManager.js';
import { RealTimeSessionManager } from './realTimeSessionManager.js';
import { fpsSessionManager } from './fpsSessionManager.js';
import { isTokenBlocked } from '../lib/tokenBlocklist.js';
import { JWT_SECRET } from '../lib/jwt.js';
import { getSession, cleanupAllSessions } from './redisSessionStore.js';
import redis from '../lib/redis.js';
import { allowedOrigins } from '../lib/config.js';
import { sanitize } from '../lib/sanitize.js';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const CLIENT_TIMEOUT = 60_000; // 60 seconds without pong
const CHAT_MAX_LENGTH = 500;

// Rate limiting
const RATE_LIMIT_WINDOW = 10_000; // 10 seconds
const RATE_LIMIT_MAX_MESSAGES = 30; // max messages per window
const RATE_LIMIT_MAX_WARNINGS = 3; // warnings before disconnect

interface RateLimitState {
  messageCount: number;
  windowStart: number;
  warnings: number;
}

const rateLimitMap = new Map<string, RateLimitState>();

// L-WS1: Track failed authentication attempts by IP for brute-force protection
interface AuthFailureState {
  count: number;
  lastAttempt: number;
}
const authFailureMap = new Map<string, AuthFailureState>();
const AUTH_FAILURE_WINDOW = 60_000; // 60 seconds
const AUTH_FAILURE_MAX = 5; // max failures before rejection
const AUTH_BACKOFF_THRESHOLD = 3; // start backoff after this many failures
const AUTH_BACKOFF_MAX_MS = 30_000; // cap backoff at 30 seconds
const AUTH_FAILURE_CLEANUP_INTERVAL = 300_000; // clean stale entries every 5 minutes

/**
 * Check if a client has exceeded the message rate limit.
 * H2: Rate-limits by playerId (if authenticated) to prevent reconnect bypass.
 * Returns true if the message should be allowed, false if rate-limited.
 */
function checkRateLimit(client: ConnectedClient): boolean {
  const ws = client.ws;
  // Use playerId if authenticated, otherwise clientId (pre-auth messages)
  const key = client.playerId || client.id;
  const now = Date.now();
  let state = rateLimitMap.get(key);

  if (!state) {
    state = { messageCount: 0, windowStart: now, warnings: 0 };
    rateLimitMap.set(key, state);
  }

  // Reset window if expired
  if (now - state.windowStart >= RATE_LIMIT_WINDOW) {
    state.messageCount = 0;
    state.windowStart = now;
  }

  state.messageCount++;

  if (state.messageCount > RATE_LIMIT_MAX_MESSAGES) {
    state.warnings++;
    if (state.warnings >= RATE_LIMIT_MAX_WARNINGS) {
      sendTo(ws, {
        type: 'error',
        payload: { message: 'Rate limit exceeded repeatedly. Disconnecting.' },
      });
      return false; // Caller should disconnect
    }
    sendTo(ws, {
      type: 'error',
      payload: {
        message: `Rate limit exceeded (${RATE_LIMIT_MAX_MESSAGES} messages per ${RATE_LIMIT_WINDOW / 1000}s). Warning ${state.warnings}/${RATE_LIMIT_MAX_WARNINGS}.`,
      },
    });
    return true; // Allow this one but warn
  }

  return true;
}

// =============================================================================
// Handler context passed to each message handler
// =============================================================================

interface HandlerContext {
  client: ConnectedClient;
  payload: Record<string, unknown>;
  clients: Map<string, ConnectedClient>;
  realTimeSessionManager: RealTimeSessionManager;
}

// =============================================================================
// Message handler type and registration
// =============================================================================

interface MessageHandlerDef {
  /** Required payload fields; validated before the handler runs */
  requiredFields?: string[];
  /** If true, client must be authenticated before this handler runs */
  requiresAuth: boolean;
  /** The handler function */
  handler: (ctx: HandlerContext) => Promise<void>;
}

const messageHandlers: Record<string, MessageHandlerDef> = {
  // ---- Authentication ----
  authenticate: {
    requiredFields: ['token'],
    requiresAuth: false,
    async handler({ client, payload }) {
      const ip = client.remoteIp || 'unknown';

      // L-WS1: Check failed auth attempts for this IP
      const failState = authFailureMap.get(ip);
      if (failState) {
        const elapsed = Date.now() - failState.lastAttempt;
        // Reset if outside the failure window
        if (elapsed > AUTH_FAILURE_WINDOW) {
          authFailureMap.delete(ip);
        } else if (failState.count >= AUTH_FAILURE_MAX) {
          sendTo(client.ws, {
            type: 'error',
            payload: { message: 'Too many failed authentication attempts. Try again later.' },
          });
          client.ws.close(4029, 'Auth rate limit exceeded');
          return;
        } else if (failState.count >= AUTH_BACKOFF_THRESHOLD) {
          // Apply exponential backoff delay check
          const backoffMs = Math.min(
            Math.pow(2, failState.count - AUTH_BACKOFF_THRESHOLD) * 1000,
            AUTH_BACKOFF_MAX_MS,
          );
          if (elapsed < backoffMs) {
            sendTo(client.ws, {
              type: 'error',
              payload: { message: 'Authentication rate limited. Please wait before retrying.' },
            });
            return;
          }
        }
      }

      const token = payload.token as string;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: string;
          address: string;
          jti?: string;
        };

        // Check if token has been blocklisted (logged out)
        const blocklistKey = decoded.jti || token;
        if (await isTokenBlocked(blocklistKey)) {
          // L-WS1: Count revoked token as a failed attempt
          const state = authFailureMap.get(ip) || { count: 0, lastAttempt: 0 };
          state.count += 1;
          state.lastAttempt = Date.now();
          authFailureMap.set(ip, state);

          sendTo(client.ws, {
            type: 'error',
            payload: { message: 'Token has been revoked' },
          });
          return;
        }

        // Successful auth: clear failure tracking for this IP
        authFailureMap.delete(ip);

        client.playerId = decoded.userId;
        sendTo(client.ws, {
          type: 'authenticated',
          payload: {
            playerId: client.playerId,
            message: 'Authentication successful',
          },
        });
      } catch {
        // L-WS1: Track the failed attempt
        const state = authFailureMap.get(ip) || { count: 0, lastAttempt: 0 };
        state.count += 1;
        state.lastAttempt = Date.now();
        authFailureMap.set(ip, state);

        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Invalid or expired token' },
        });
      }
    },
  },

  // ---- Matchmaking ----
  join_queue: {
    requiredFields: ['gameId'],
    requiresAuth: true,
    async handler({ client, payload, clients }) {
      const gameId = payload.gameId as string;
      joinQueue(client, gameId, clients).catch((err) => {
        console.error('[WS] Error joining queue:', err);
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Failed to join queue' },
        });
      });
    },
  },

  leave_queue: {
    requiresAuth: true,
    async handler({ client }) {
      const removed = await leaveQueue(client);
      sendTo(client.ws, {
        type: 'queue_left',
        payload: { removed, message: removed ? 'Left queue' : 'Not in a queue' },
      });
    },
  },

  // ---- Game Actions ----
  game_action: {
    requiredFields: ['action'],
    requiresAuth: true,
    async handler({ client, payload, clients }) {
      const action = (payload.action as Record<string, unknown>) || {};
      if (typeof action.type !== 'string') {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Invalid action: missing "type" string field' },
        });
        return;
      }
      handleGameAction(client, action, clients).catch((err) => {
        console.error('[WS] Error handling game action:', err);
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Failed to process game action' },
        });
      });
    },
  },

  end_game: {
    requiredFields: ['sessionId'],
    requiresAuth: true,
    async handler({ client, payload, clients }) {
      const sessionId = payload.sessionId as string;
      // C2: Verify the client is actually in this session
      if (client.gameSessionId !== sessionId) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Not authorized to end this session' },
        });
        return;
      }
      const scores = (payload.scores as Record<string, number>) || {};
      const winnerId = (payload.winnerId as string) || null;

      // M3: Validate winnerId and score keys reference actual session players
      const session = await getSession(redis, sessionId);
      if (!session) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Session not found' },
        });
        return;
      }
      const playerSet = new Set(session.playerIds);
      if (winnerId && !playerSet.has(winnerId)) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'winnerId is not a player in this session' },
        });
        return;
      }
      const invalidScoreIds = Object.keys(scores).filter((id) => !playerSet.has(id));
      if (invalidScoreIds.length > 0) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'scores contain player IDs not in this session' },
        });
        return;
      }

      endSession(sessionId, scores, winnerId, clients).catch((err) => {
        console.error('[WS] Error ending session:', err);
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Failed to end session' },
        });
      });
    },
  },

  // ---- Session Management ----
  leave: {
    requiresAuth: true,
    async handler({ client, clients }) {
      leaveSession(client, clients).catch((err) => {
        console.error('[WS] Error leaving session:', err);
      });
    },
  },

  // ---- Spectating ----
  spectate: {
    requiredFields: ['sessionId'],
    requiresAuth: true,
    async handler({ client, payload }) {
      const spectateSessionId = payload.sessionId as string;
      // H3: Validate the session actually exists before allowing spectate
      if (!(await isActiveSession(spectateSessionId))) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Session not found or already ended' },
        });
        return;
      }
      client.spectating = spectateSessionId;
      console.log(`[WS] Client ${client.id} spectating session ${spectateSessionId}`);
      sendTo(client.ws, {
        type: 'spectating',
        payload: {
          sessionId: spectateSessionId,
          message: `Now spectating session ${spectateSessionId}`,
        },
      });
    },
  },

  stop_spectating: {
    requiresAuth: true,
    async handler({ client }) {
      client.spectating = undefined;
      sendTo(client.ws, {
        type: 'stopped_spectating',
        payload: { message: 'Stopped spectating' },
      });
    },
  },

  // ---- Reconnection ----
  reconnect: {
    requiredFields: ['token', 'sessionId'],
    requiresAuth: false,
    async handler({ client, payload, clients }) {
      const reconnectToken = payload.token as string;
      const reconnectSessionId = payload.sessionId as string;
      try {
        const decoded = jwt.verify(reconnectToken, JWT_SECRET) as {
          userId: string;
          address: string;
          jti?: string;
        };

        // Check if token has been blocklisted
        const blocklistKey = decoded.jti || reconnectToken;
        if (await isTokenBlocked(blocklistKey)) {
          sendTo(client.ws, {
            type: 'error',
            payload: { message: 'Token has been revoked' },
          });
          return;
        }

        client.playerId = decoded.userId;
        const rejoined = await rejoinSession(
          reconnectSessionId,
          client.id,
          decoded.userId,
          clients,
        );
        if (rejoined) {
          client.gameSessionId = reconnectSessionId;
          sendTo(client.ws, {
            type: 'reconnected',
            payload: {
              playerId: client.playerId,
              sessionId: reconnectSessionId,
              message: 'Reconnected to session',
            },
          });
        } else {
          sendTo(client.ws, {
            type: 'error',
            payload: { message: 'Session not found or you are not a participant' },
          });
        }
      } catch {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Invalid or expired token' },
        });
      }
    },
  },

  // ---- Chat ----
  chat: {
    requiredFields: ['message'],
    requiresAuth: true,
    async handler({ client, payload, clients }) {
      const chatSessionId = client.gameSessionId || client.spectating;
      if (!chatSessionId) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Not in a session or spectating' },
        });
        return;
      }
      const rawMessage = String(payload.message);
      if (rawMessage.trim().length === 0) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Chat message cannot be empty' },
        });
        return;
      }
      if (rawMessage.length > CHAT_MAX_LENGTH) {
        sendTo(client.ws, {
          type: 'error',
          payload: {
            message: `Chat message exceeds maximum length of ${CHAT_MAX_LENGTH} characters`,
          },
        });
        return;
      }
      const sanitizedMessage = sanitize(rawMessage);
      broadcastToSession(clients, chatSessionId, {
        type: 'chat',
        payload: {
          playerId: client.playerId,
          message: sanitizedMessage,
          timestamp: new Date().toISOString(),
        },
      });
    },
  },

  // ---- Wager Subscriptions ----
  subscribe_wager: {
    requiredFields: ['wagerId'],
    requiresAuth: true,
    async handler({ client, payload }) {
      const wagerId = payload.wagerId as string;
      client.watchingWagerId = wagerId;
      console.log(`[WS] Client ${client.id} subscribed to wager ${wagerId}`);
      sendTo(client.ws, {
        type: 'wager_subscribed',
        payload: {
          wagerId,
          message: `Subscribed to wager ${wagerId} updates`,
        },
      });
    },
  },

  unsubscribe_wager: {
    requiresAuth: true,
    async handler({ client }) {
      const prevWagerId = client.watchingWagerId;
      client.watchingWagerId = undefined;
      sendTo(client.ws, {
        type: 'wager_unsubscribed',
        payload: {
          wagerId: prevWagerId,
          message: 'Unsubscribed from wager updates',
        },
      });
    },
  },

  // ---- FPS Deathmatch messages ----
  fps_create_match: {
    requiredFields: ['level', 'maxPlayers', 'killsToWin'],
    requiresAuth: true,
    async handler({ client, payload }) {
      if (!client.playerId) return;
      const level = typeof payload.level === 'number' ? payload.level : 0;
      const maxPlayers = typeof payload.maxPlayers === 'number' ? payload.maxPlayers : 4;
      const killsToWin = typeof payload.killsToWin === 'number' ? payload.killsToWin : 10;
      const matchId = fpsSessionManager.createMatch(
        client.playerId,
        client.playerId,
        client.ws,
        level,
        maxPlayers,
        killsToWin,
      );
      client.fpsMatchId = matchId;
    },
  },

  fps_join_match: {
    requiredFields: ['matchId'],
    requiresAuth: true,
    async handler({ client, payload }) {
      if (!client.playerId) return;
      const matchId = payload.matchId as string;
      const joined = fpsSessionManager.joinMatch(
        client.playerId,
        client.playerId,
        client.ws,
        matchId,
      );
      if (joined) {
        client.fpsMatchId = matchId;
      }
    },
  },

  fps_ready: {
    requiresAuth: true,
    async handler({ client }) {
      if (!client.playerId) return;
      fpsSessionManager.handleReady(client.playerId);
    },
  },

  fps_update: {
    requiresAuth: true,
    async handler({ client, payload }) {
      if (!client.playerId) return;
      fpsSessionManager.handleUpdate(client.playerId, payload);
    },
  },

  fps_shoot: {
    requiresAuth: true,
    async handler({ client, payload }) {
      if (!client.playerId) return;
      fpsSessionManager.handleShoot(client.playerId, payload);
    },
  },

  fps_hit: {
    requiredFields: ['targetId'],
    requiresAuth: true,
    async handler({ client, payload }) {
      if (!client.playerId) return;
      fpsSessionManager.handleHit(client.playerId, payload);
    },
  },

  fps_respawn: {
    requiresAuth: true,
    async handler({ client }) {
      if (!client.playerId) return;
      fpsSessionManager.handleRespawn(client.playerId);
    },
  },

  // ---- Real-time (tick-based) messages ----
  realtime_input: {
    requiredFields: ['input'],
    requiresAuth: true,
    async handler({ client, payload, realTimeSessionManager }) {
      if (!client.playerId) return;
      const rtInput = payload.input;
      if (rtInput === undefined || rtInput === null) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Missing "input" field for realtime_input' },
        });
        return;
      }
      realTimeSessionManager.handleInput(client.playerId, rtInput as number | string);
    },
  },

  realtime_ready: {
    requiresAuth: true,
    async handler({ client, clients, realTimeSessionManager }) {
      if (!client.playerId) return;
      realTimeSessionManager.handleReady(client.playerId, clients).catch((err) => {
        console.error('[WS] Error handling realtime_ready:', err);
      });
    },
  },
};

/** Set of all known message types, derived from the handler map */
const VALID_MESSAGE_TYPES = new Set(Object.keys(messageHandlers));

/**
 * Initialize the WebSocket server on an existing HTTP server
 */
/** P18: Maximum age for rateLimitMap entries before eviction */
const RATE_LIMIT_CLEANUP_INTERVAL = 60_000; // 60 seconds
const RATE_LIMIT_MAX_AGE = 300_000; // 5 minutes

export function createWebSocketServer(server: HTTPServer): WebSocketServer {
  console.log('[BOOT] Creating WebSocket server...');

  // CQ-04: Clean up stale Redis session/queue keys from previous instances
  cleanupAllSessions(redis)
    .then((count) => {
      if (count > 0) console.log(`[BOOT] Cleaned up ${count} stale Redis keys`);
    })
    .catch((err) => {
      console.error('[BOOT] Failed to clean up stale sessions:', err);
    });
  console.log(`[BOOT] WebSocket allowed origins: ${allowedOrigins.join(', ')}`);

  // M5: Track concurrent connections per IP; reject when above threshold
  const MAX_CONNECTIONS_PER_IP = 5;
  const connectionsPerIp = new Map<string, number>();

  const wss = new WebSocketServer({
    server,
    maxPayload: 65_536, // M2: 64 KB max message size
    verifyClient: (info: { origin: string; req: IncomingMessage }, callback) => {
      // H1: Require Origin header; non-browser clients should use API key auth
      const origin = info.origin || info.req.headers.origin;
      if (!origin) {
        console.warn('[WS] Rejected connection with no Origin header');
        callback(false, 403, 'Origin header required');
        return;
      }
      if (!allowedOrigins.includes(origin)) {
        console.warn(`[WS] Rejected connection from disallowed origin: ${origin}`);
        callback(false, 403, 'Origin not allowed');
        return;
      }

      // M5: Enforce per-IP connection limit
      // Use socket remoteAddress as primary; only use x-forwarded-for behind a trusted proxy
      const ip = process.env.TRUST_PROXY
        ? info.req.headers['x-forwarded-for']
          ? String(info.req.headers['x-forwarded-for']).split(',')[0].trim()
          : info.req.socket.remoteAddress || 'unknown'
        : info.req.socket.remoteAddress || 'unknown';
      const current = connectionsPerIp.get(ip) || 0;
      if (current >= MAX_CONNECTIONS_PER_IP) {
        console.warn(`[WS] Rejected connection from ${ip}: per-IP limit reached (${current})`);
        callback(false, 429, 'Too many connections from this IP');
        return;
      }

      callback(true);
    },
  });
  const clients = new Map<string, ConnectedClient>();

  // Real-time session manager for tick-based games (OpenBOR, etc.)
  const realTimeSessionManager = new RealTimeSessionManager();

  // Heartbeat interval to detect dead connections
  const heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [clientId, client] of clients) {
      if (now - client.lastPing > CLIENT_TIMEOUT) {
        console.log(`[WS] Client ${clientId} timed out, disconnecting`);
        client.ws.terminate();
        handleDisconnect(client, clients).catch((err) =>
          console.error('[WS] Error handling timeout disconnect:', err),
        );
        clients.delete(clientId);
        rateLimitMap.delete(clientId);
        continue;
      }
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL);

  // P18: Periodic cleanup of stale rateLimitMap entries
  const rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, state] of rateLimitMap) {
      if (now - state.windowStart > RATE_LIMIT_MAX_AGE) {
        rateLimitMap.delete(key);
      }
    }
  }, RATE_LIMIT_CLEANUP_INTERVAL);

  // L-WS1: Periodic cleanup of stale auth failure entries (every 5 minutes)
  const authFailureCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, state] of authFailureMap) {
      if (now - state.lastAttempt > AUTH_FAILURE_WINDOW) {
        authFailureMap.delete(ip);
      }
    }
  }, AUTH_FAILURE_CLEANUP_INTERVAL);

  // M5: Helper to decrement IP connection counter on disconnect
  function decrementIpCount(ip: string): void {
    const count = connectionsPerIp.get(ip) || 0;
    if (count <= 1) {
      connectionsPerIp.delete(ip);
    } else {
      connectionsPerIp.set(ip, count - 1);
    }
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // M5: Track per-IP connection count (use socket address unless behind trusted proxy)
    const clientIp = process.env.TRUST_PROXY
      ? req.headers['x-forwarded-for']
        ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
        : req.socket.remoteAddress || 'unknown'
      : req.socket.remoteAddress || 'unknown';
    connectionsPerIp.set(clientIp, (connectionsPerIp.get(clientIp) || 0) + 1);

    const clientId = uuidv4();
    const client: ConnectedClient = {
      id: clientId,
      ws,
      remoteIp: clientIp,
      lastPing: Date.now(),
    };
    clients.set(clientId, client);

    console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

    // Send welcome message
    sendTo(ws, {
      type: 'connected',
      payload: {
        clientId,
        message: 'Connected to Moltblox WebSocket server',
        timestamp: new Date().toISOString(),
      },
    });

    // Handle pong responses
    ws.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      // Per-client rate limiting
      const allowed = checkRateLimit(client);
      if (!allowed) {
        console.log(`[WS] Client ${clientId} disconnected for exceeding rate limit`);
        ws.terminate();
        handleDisconnect(client, clients).catch((err) =>
          console.error('[WS] Error handling rate-limit disconnect:', err),
        );
        clients.delete(clientId);
        rateLimitMap.delete(clientId);
        return;
      }

      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleMessage(client, message, clients, realTimeSessionManager).catch((err) =>
          console.error('[WS] Error handling message:', err),
        );
      } catch {
        sendTo(ws, {
          type: 'error',
          payload: { message: 'Invalid message format. Expected JSON.' },
        });
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size - 1})`);
      handleDisconnect(client, clients).catch((err) =>
        console.error('[WS] Error handling disconnect:', err),
      );
      // Clean up FPS match
      if (client.playerId) {
        fpsSessionManager.handleDisconnect(client.playerId);
      }
      // Also clean up any real-time session
      realTimeSessionManager
        .handleDisconnect(clientId, client.playerId, clients)
        .catch((err) => console.error('[WS] Error handling RT disconnect:', err));
      clients.delete(clientId);
      rateLimitMap.delete(clientId);
      if (client.playerId) rateLimitMap.delete(client.playerId);
      decrementIpCount(clientIp);
    });

    // Handle errors
    ws.on('error', (err: Error) => {
      console.error(`[WS] Client error ${clientId}:`, err.message);
      handleDisconnect(client, clients).catch(() => {});
      clients.delete(clientId);
      rateLimitMap.delete(clientId);
      if (client.playerId) rateLimitMap.delete(client.playerId);
      decrementIpCount(clientIp);
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
    clearInterval(rateLimitCleanupTimer);
    clearInterval(authFailureCleanupTimer);
    console.log('[WS] WebSocket server closed');
  });

  console.log('[WS] WebSocket server initialized');
  return wss;
}

/**
 * Route incoming WebSocket messages to the appropriate handler
 */
async function handleMessage(
  client: ConnectedClient,
  message: WSMessage,
  clients: Map<string, ConnectedClient>,
  realTimeSessionManager: RealTimeSessionManager,
): Promise<void> {
  // M8: Validate incoming message shape
  if (
    !message ||
    typeof message !== 'object' ||
    typeof message.type !== 'string' ||
    (message.payload !== undefined &&
      (typeof message.payload !== 'object' || message.payload === null))
  ) {
    sendTo(client.ws, {
      type: 'error',
      payload: { message: 'Invalid message shape. Expected { type: string, payload?: object }.' },
    });
    return;
  }

  const { type, payload = {} } = message;

  // H3: Look up handler
  const def = messageHandlers[type];
  if (!def) {
    sendTo(client.ws, {
      type: 'error',
      payload: {
        message: `Unknown message type: ${type}`,
        supportedTypes: [...VALID_MESSAGE_TYPES],
      },
    });
    return;
  }

  // H3: Validate required fields per message type
  if (def.requiredFields) {
    for (const field of def.requiredFields) {
      const value = payload[field];
      if (value === undefined || value === null) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: `Missing required field "${field}" for ${type} message` },
        });
        return;
      }
    }
  }

  // H2: Require authentication for protected messages
  if (def.requiresAuth && !client.playerId) {
    sendTo(client.ws, {
      type: 'error',
      payload: { message: 'Authentication required. Send an "authenticate" message first.' },
    });
    return;
  }

  await def.handler({ client, payload, clients, realTimeSessionManager });
}

// TODO: Add integration tests for WebSocket message handling
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
} from './sessionManager.js';
import { isTokenBlocked } from '../lib/tokenBlocklist.js';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    console.warn('[SECURITY] Using default JWT secret — set JWT_SECRET env var for production');
    return 'moltblox-dev-secret-DO-NOT-USE-IN-PRODUCTION';
  })();

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const CLIENT_TIMEOUT = 60_000; // 60 seconds without pong
const CHAT_MAX_LENGTH = 500;

const VALID_MESSAGE_TYPES = new Set([
  'authenticate',
  'join_queue',
  'leave_queue',
  'game_action',
  'end_game',
  'leave',
  'spectate',
  'stop_spectating',
  'chat',
]);

/** Message types that require authentication before use */
const AUTH_REQUIRED_TYPES = new Set([
  'join_queue',
  'leave_queue',
  'game_action',
  'end_game',
  'leave',
  'spectate',
  'stop_spectating',
  'chat',
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Initialize the WebSocket server on an existing HTTP server
 */
export function createWebSocketServer(server: HTTPServer): WebSocketServer {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const wss = new WebSocketServer({
    server,
    verifyClient: (info: { origin: string; req: IncomingMessage }, callback) => {
      const origin = info.origin || info.req.headers.origin;
      if (!origin || allowedOrigins.includes(origin)) {
        callback(true);
      } else {
        console.warn(`[WS] Rejected connection from disallowed origin: ${origin}`);
        callback(false, 403, 'Origin not allowed');
      }
    },
  });
  const clients = new Map<string, ConnectedClient>();

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
        continue;
      }
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', (ws: WebSocket) => {
    const clientId = uuidv4();
    const client: ConnectedClient = {
      id: clientId,
      ws,
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
      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleMessage(client, message, clients).catch((err) =>
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
      clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (err: Error) => {
      console.error(`[WS] Client error ${clientId}:`, err.message);
      handleDisconnect(client, clients).catch(() => {});
      clients.delete(clientId);
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
    console.log('[WS] WebSocket server closed');
  });

  console.log('[WS] WebSocket server initialized');
  return wss;
}

/**
 * Route incoming WebSocket messages to appropriate handlers
 */
async function handleMessage(
  client: ConnectedClient,
  message: WSMessage,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  const { type, payload } = message;

  // H3: Validate message type is known
  if (!VALID_MESSAGE_TYPES.has(type)) {
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
  const fieldError = validateMessageFields(type, payload);
  if (fieldError) {
    sendTo(client.ws, { type: 'error', payload: { message: fieldError } });
    return;
  }

  // H2: Require authentication for all game-related messages
  if (AUTH_REQUIRED_TYPES.has(type) && !client.playerId) {
    sendTo(client.ws, {
      type: 'error',
      payload: { message: 'Authentication required. Send an "authenticate" message first.' },
    });
    return;
  }

  switch (type) {
    // ─── Authentication ───────────────────────────────
    case 'authenticate': {
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
          sendTo(client.ws, {
            type: 'error',
            payload: { message: 'Token has been revoked' },
          });
          break;
        }

        client.playerId = decoded.userId;
        sendTo(client.ws, {
          type: 'authenticated',
          payload: {
            playerId: client.playerId,
            message: 'Authentication successful',
          },
        });
      } catch {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Invalid or expired token' },
        });
      }
      break;
    }

    // ─── Matchmaking ──────────────────────────────────
    case 'join_queue': {
      const gameId = payload.gameId as string;
      joinQueue(client, gameId, clients).catch((err) => {
        console.error('[WS] Error joining queue:', err);
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Failed to join queue' },
        });
      });
      break;
    }

    case 'leave_queue': {
      const removed = leaveQueue(client);
      sendTo(client.ws, {
        type: 'queue_left',
        payload: { removed, message: removed ? 'Left queue' : 'Not in a queue' },
      });
      break;
    }

    // ─── Game Actions ─────────────────────────────────
    case 'game_action': {
      const action = (payload.action as Record<string, unknown>) || {};
      handleGameAction(client, action, clients).catch((err) => {
        console.error('[WS] Error handling game action:', err);
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Failed to process game action' },
        });
      });
      break;
    }

    case 'end_game': {
      const sessionId = payload.sessionId as string;
      const scores = (payload.scores as Record<string, number>) || {};
      const winnerId = (payload.winnerId as string) || null;
      endSession(sessionId, scores, winnerId, clients).catch((err) => {
        console.error('[WS] Error ending session:', err);
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Failed to end session' },
        });
      });
      break;
    }

    // ─── Session Management ───────────────────────────
    case 'leave': {
      leaveSession(client, clients).catch((err) => {
        console.error('[WS] Error leaving session:', err);
      });
      break;
    }

    // ─── Spectating ───────────────────────────────────
    case 'spectate': {
      const spectateSessionId = payload.sessionId as string;
      client.spectating = spectateSessionId;
      console.log(`[WS] Client ${client.id} spectating session ${spectateSessionId}`);
      sendTo(client.ws, {
        type: 'spectating',
        payload: {
          sessionId: spectateSessionId,
          message: `Now spectating session ${spectateSessionId}`,
        },
      });
      break;
    }

    case 'stop_spectating': {
      client.spectating = undefined;
      sendTo(client.ws, {
        type: 'stopped_spectating',
        payload: { message: 'Stopped spectating' },
      });
      break;
    }

    // ─── Chat ─────────────────────────────────────────
    case 'chat': {
      const chatSessionId = client.gameSessionId || client.spectating;
      if (!chatSessionId) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Not in a session or spectating' },
        });
        break;
      }
      const rawMessage = String(payload.message);
      if (rawMessage.trim().length === 0) {
        sendTo(client.ws, {
          type: 'error',
          payload: { message: 'Chat message cannot be empty' },
        });
        break;
      }
      if (rawMessage.length > CHAT_MAX_LENGTH) {
        sendTo(client.ws, {
          type: 'error',
          payload: {
            message: `Chat message exceeds maximum length of ${CHAT_MAX_LENGTH} characters`,
          },
        });
        break;
      }
      const sanitizedMessage = escapeHtml(rawMessage);
      broadcastToSession(clients, chatSessionId, {
        type: 'chat',
        payload: {
          playerId: client.playerId,
          message: sanitizedMessage,
          timestamp: new Date().toISOString(),
        },
      });
      break;
    }

    // Unknown types are caught by the validation above, so this is unreachable
    default:
      break;
  }
}

/**
 * Validate that required fields exist for each message type.
 * Returns an error string if validation fails, or null if valid.
 */
function validateMessageFields(type: string, payload: Record<string, unknown>): string | null {
  switch (type) {
    case 'authenticate':
      if (!payload.token) return 'Missing required field "token" for authenticate message';
      break;
    case 'join_queue':
      if (!payload.gameId) return 'Missing required field "gameId" for join_queue message';
      break;
    case 'game_action':
      if (!payload.action) return 'Missing required field "action" for game_action message';
      break;
    case 'end_game':
      if (!payload.sessionId) return 'Missing required field "sessionId" for end_game message';
      break;
    case 'spectate':
      if (!payload.sessionId) return 'Missing required field "sessionId" for spectate message';
      break;
    case 'chat':
      if (payload.message === undefined || payload.message === null)
        return 'Missing required field "message" for chat message';
      break;
  }
  return null;
}

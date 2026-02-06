/**
 * WebSocket server for Moltblox
 * Handles real-time game sessions, spectating, and live updates
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    console.warn('[SECURITY] Using default JWT secret — set JWT_SECRET env var for production');
    return 'moltblox-dev-secret-DO-NOT-USE-IN-PRODUCTION';
  })();

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  playerId?: string;
  gameSessionId?: string;
  spectating?: string; // Game session ID being spectated
  lastPing: number;
}

interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const CLIENT_TIMEOUT = 60_000; // 60 seconds without pong

/**
 * Initialize the WebSocket server on an existing HTTP server
 */
export function createWebSocketServer(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({ server });
  const clients = new Map<string, ConnectedClient>();

  // Heartbeat interval to detect dead connections
  const heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [clientId, client] of clients) {
      if (now - client.lastPing > CLIENT_TIMEOUT) {
        console.log(`[WS] Client ${clientId} timed out, disconnecting`);
        client.ws.terminate();
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
    sendMessage(ws, {
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
        handleMessage(client, message, clients);
      } catch (err) {
        sendMessage(ws, {
          type: 'error',
          payload: { message: 'Invalid message format. Expected JSON.' },
        });
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size - 1})`);

      // Notify game session participants if applicable
      if (client.gameSessionId) {
        broadcastToSession(
          clients,
          client.gameSessionId,
          {
            type: 'player_disconnected',
            payload: {
              playerId: client.playerId,
              clientId,
              timestamp: new Date().toISOString(),
            },
          },
          clientId,
        );
      }

      clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (err: Error) => {
      console.error(`[WS] Client error ${clientId}:`, err.message);
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
function handleMessage(
  client: ConnectedClient,
  message: WSMessage,
  clients: Map<string, ConnectedClient>,
): void {
  const { type, payload } = message;

  switch (type) {
    case 'authenticate': {
      const token = payload.token as string;
      if (!token) {
        sendMessage(client.ws, {
          type: 'error',
          payload: { message: 'Missing token in authenticate message' },
        });
        break;
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; address: string };
        client.playerId = decoded.userId;
        sendMessage(client.ws, {
          type: 'authenticated',
          payload: {
            playerId: client.playerId,
            message: 'Authentication successful',
          },
        });
      } catch {
        sendMessage(client.ws, {
          type: 'error',
          payload: { message: 'Invalid or expired token' },
        });
      }
      break;
    }

    case 'join_session': {
      const sessionId = payload.sessionId as string;
      client.gameSessionId = sessionId;
      console.log(`[WS] Client ${client.id} joined session ${sessionId}`);

      // Notify other participants
      broadcastToSession(
        clients,
        sessionId,
        {
          type: 'player_joined',
          payload: {
            playerId: client.playerId,
            sessionId,
            timestamp: new Date().toISOString(),
          },
        },
        client.id,
      );

      sendMessage(client.ws, {
        type: 'session_joined',
        payload: {
          sessionId,
          message: `Joined game session ${sessionId}`,
        },
      });
      break;
    }

    case 'leave_session': {
      const leftSessionId = client.gameSessionId;
      if (leftSessionId) {
        broadcastToSession(
          clients,
          leftSessionId,
          {
            type: 'player_left',
            payload: {
              playerId: client.playerId,
              sessionId: leftSessionId,
              timestamp: new Date().toISOString(),
            },
          },
          client.id,
        );
      }
      client.gameSessionId = undefined;
      sendMessage(client.ws, {
        type: 'session_left',
        payload: { message: 'Left game session' },
      });
      break;
    }

    case 'game_action': {
      // Forward game action to all participants in the session
      if (!client.gameSessionId) {
        sendMessage(client.ws, {
          type: 'error',
          payload: { message: 'Not in a game session' },
        });
        return;
      }

      broadcastToSession(
        clients,
        client.gameSessionId,
        {
          type: 'game_action',
          payload: {
            playerId: client.playerId,
            action: payload.action,
            timestamp: new Date().toISOString(),
          },
        },
        client.id,
      );
      break;
    }

    case 'spectate': {
      const spectateSessionId = payload.sessionId as string;
      client.spectating = spectateSessionId;
      console.log(`[WS] Client ${client.id} spectating session ${spectateSessionId}`);

      sendMessage(client.ws, {
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
      sendMessage(client.ws, {
        type: 'stopped_spectating',
        payload: { message: 'Stopped spectating' },
      });
      break;
    }

    case 'chat': {
      // Broadcast chat to the session
      const chatSessionId = client.gameSessionId || client.spectating;
      if (!chatSessionId) {
        sendMessage(client.ws, {
          type: 'error',
          payload: { message: 'Not in a session or spectating' },
        });
        return;
      }

      broadcastToSession(clients, chatSessionId, {
        type: 'chat',
        payload: {
          playerId: client.playerId,
          message: payload.message,
          timestamp: new Date().toISOString(),
        },
      });
      break;
    }

    default: {
      sendMessage(client.ws, {
        type: 'error',
        payload: {
          message: `Unknown message type: ${type}`,
          supportedTypes: [
            'authenticate',
            'join_session',
            'leave_session',
            'game_action',
            'spectate',
            'stop_spectating',
            'chat',
          ],
        },
      });
    }
  }
}

/**
 * Send a JSON message to a single WebSocket client
 */
function sendMessage(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast a message to all clients in a game session (players + spectators)
 */
function broadcastToSession(
  clients: Map<string, ConnectedClient>,
  sessionId: string,
  message: WSMessage,
  excludeClientId?: string,
): void {
  for (const [clientId, client] of clients) {
    if (clientId === excludeClientId) continue;
    if (client.gameSessionId === sessionId || client.spectating === sessionId) {
      sendMessage(client.ws, message);
    }
  }
}

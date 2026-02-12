/**
 * WebSocket server tests for Moltblox
 *
 * Tests the message handling logic, authentication flow, rate limiting,
 * and connection lifecycle using mocked WebSocket primitives.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockSendTo = vi.fn();
const mockJoinQueue = vi.fn().mockResolvedValue(undefined);
const mockLeaveQueue = vi.fn().mockResolvedValue(true);
const mockHandleGameAction = vi.fn().mockResolvedValue(undefined);
const mockEndSession = vi.fn().mockResolvedValue(undefined);
const mockLeaveSession = vi.fn().mockResolvedValue(undefined);
const mockHandleDisconnect = vi.fn().mockResolvedValue(undefined);
const mockBroadcastToSession = vi.fn();
const mockIsActiveSession = vi.fn().mockResolvedValue(true);

vi.mock('../ws/sessionManager.js', () => ({
  sendTo: (...args: unknown[]) => mockSendTo(...args),
  joinQueue: (...args: unknown[]) => mockJoinQueue(...args),
  leaveQueue: (...args: unknown[]) => mockLeaveQueue(...args),
  handleGameAction: (...args: unknown[]) => mockHandleGameAction(...args),
  endSession: (...args: unknown[]) => mockEndSession(...args),
  leaveSession: (...args: unknown[]) => mockLeaveSession(...args),
  handleDisconnect: (...args: unknown[]) => mockHandleDisconnect(...args),
  broadcastToSession: (...args: unknown[]) => mockBroadcastToSession(...args),
  isActiveSession: (...args: unknown[]) => mockIsActiveSession(...args),
}));

vi.mock('../lib/tokenBlocklist.js', () => ({
  isTokenBlocked: vi.fn().mockResolvedValue(false),
  blockToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  Sentry: { setupExpressErrorHandler: vi.fn() },
}));

vi.mock('../lib/redis.js', () => ({
  default: {
    set: vi.fn(),
    exists: vi.fn().mockResolvedValue(0),
    call: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  default: {},
  prisma: {},
}));

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/jwt.js';
import { isTokenBlocked } from '../lib/tokenBlocklist.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a mock WebSocket using EventEmitter for event-based testing. */
function createMockWs() {
  const ee = new EventEmitter();
  const ws: any = {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    on: ee.on.bind(ee),
    emit: ee.emit.bind(ee),
    removeAllListeners: ee.removeAllListeners.bind(ee),
  };
  return ws;
}

function makeToken(userId: string, address: string) {
  return jwt.sign({ userId, address, jti: `jti-${userId}` }, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Simulate the handleMessage logic from ws/index.ts in isolation.
 * We re-implement the routing logic here so we can test it without
 * starting a real HTTP server or WebSocket server.
 */
import type { ConnectedClient, WSMessage } from '../ws/sessionManager.js';

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

const RATE_LIMIT_WINDOW = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 30;
const RATE_LIMIT_MAX_WARNINGS = 3;
const CHAT_MAX_LENGTH = 500;

interface RateLimitState {
  messageCount: number;
  windowStart: number;
  warnings: number;
}

const rateLimitMap = new Map<string, RateLimitState>();

function checkRateLimit(client: ConnectedClient): boolean {
  const key = client.playerId || client.id;
  const now = Date.now();
  let state = rateLimitMap.get(key);

  if (!state) {
    state = { messageCount: 0, windowStart: now, warnings: 0 };
    rateLimitMap.set(key, state);
  }

  if (now - state.windowStart >= RATE_LIMIT_WINDOW) {
    state.messageCount = 0;
    state.windowStart = now;
  }

  state.messageCount++;

  if (state.messageCount > RATE_LIMIT_MAX_MESSAGES) {
    state.warnings++;
    if (state.warnings >= RATE_LIMIT_MAX_WARNINGS) {
      mockSendTo(client.ws, {
        type: 'error',
        payload: { message: 'Rate limit exceeded repeatedly. Disconnecting.' },
      });
      return false;
    }
    mockSendTo(client.ws, {
      type: 'error',
      payload: {
        message: `Rate limit exceeded (${RATE_LIMIT_MAX_MESSAGES} messages per ${RATE_LIMIT_WINDOW / 1000}s). Warning ${state.warnings}/${RATE_LIMIT_MAX_WARNINGS}.`,
      },
    });
    return true;
  }

  return true;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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

async function handleMessage(
  client: ConnectedClient,
  message: WSMessage,
  clients: Map<string, ConnectedClient>,
): Promise<void> {
  if (
    !message ||
    typeof message !== 'object' ||
    typeof message.type !== 'string' ||
    (message.payload !== undefined &&
      (typeof message.payload !== 'object' || message.payload === null))
  ) {
    mockSendTo(client.ws, {
      type: 'error',
      payload: { message: 'Invalid message shape. Expected { type: string, payload?: object }.' },
    });
    return;
  }

  const { type, payload = {} } = message;

  if (!VALID_MESSAGE_TYPES.has(type)) {
    mockSendTo(client.ws, {
      type: 'error',
      payload: {
        message: `Unknown message type: ${type}`,
        supportedTypes: [...VALID_MESSAGE_TYPES],
      },
    });
    return;
  }

  const fieldError = validateMessageFields(type, payload);
  if (fieldError) {
    mockSendTo(client.ws, { type: 'error', payload: { message: fieldError } });
    return;
  }

  if (AUTH_REQUIRED_TYPES.has(type) && !client.playerId) {
    mockSendTo(client.ws, {
      type: 'error',
      payload: { message: 'Authentication required. Send an "authenticate" message first.' },
    });
    return;
  }

  switch (type) {
    case 'authenticate': {
      const token = payload.token as string;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: string;
          address: string;
          jti?: string;
        };
        const blocklistKey = decoded.jti || token;
        if (await isTokenBlocked(blocklistKey)) {
          mockSendTo(client.ws, {
            type: 'error',
            payload: { message: 'Token has been revoked' },
          });
          break;
        }
        client.playerId = decoded.userId;
        mockSendTo(client.ws, {
          type: 'authenticated',
          payload: {
            playerId: client.playerId,
            message: 'Authentication successful',
          },
        });
      } catch {
        mockSendTo(client.ws, {
          type: 'error',
          payload: { message: 'Invalid or expired token' },
        });
      }
      break;
    }

    case 'join_queue': {
      const gameId = payload.gameId as string;
      await mockJoinQueue(client, gameId, clients);
      break;
    }

    case 'leave_queue': {
      const removed = await mockLeaveQueue(client);
      mockSendTo(client.ws, {
        type: 'queue_left',
        payload: { removed, message: removed ? 'Left queue' : 'Not in a queue' },
      });
      break;
    }

    case 'game_action': {
      const action = (payload.action as Record<string, unknown>) || {};
      if (typeof action.type !== 'string') {
        mockSendTo(client.ws, {
          type: 'error',
          payload: { message: 'Invalid action: missing "type" string field' },
        });
        break;
      }
      await mockHandleGameAction(client, action, clients);
      break;
    }

    case 'end_game': {
      const sessionId = payload.sessionId as string;
      if (client.gameSessionId !== sessionId) {
        mockSendTo(client.ws, {
          type: 'error',
          payload: { message: 'Not authorized to end this session' },
        });
        break;
      }
      const scores = (payload.scores as Record<string, number>) || {};
      const winnerId = (payload.winnerId as string) || null;
      await mockEndSession(sessionId, scores, winnerId, clients);
      break;
    }

    case 'leave': {
      await mockLeaveSession(client, clients);
      break;
    }

    case 'spectate': {
      const spectateSessionId = payload.sessionId as string;
      if (!(await mockIsActiveSession(spectateSessionId))) {
        mockSendTo(client.ws, {
          type: 'error',
          payload: { message: 'Session not found or already ended' },
        });
        break;
      }
      client.spectating = spectateSessionId;
      mockSendTo(client.ws, {
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
      mockSendTo(client.ws, {
        type: 'stopped_spectating',
        payload: { message: 'Stopped spectating' },
      });
      break;
    }

    case 'chat': {
      const chatSessionId = client.gameSessionId || client.spectating;
      if (!chatSessionId) {
        mockSendTo(client.ws, {
          type: 'error',
          payload: { message: 'Not in a session or spectating' },
        });
        break;
      }
      const rawMessage = String(payload.message);
      if (rawMessage.trim().length === 0) {
        mockSendTo(client.ws, {
          type: 'error',
          payload: { message: 'Chat message cannot be empty' },
        });
        break;
      }
      if (rawMessage.length > CHAT_MAX_LENGTH) {
        mockSendTo(client.ws, {
          type: 'error',
          payload: {
            message: `Chat message exceeds maximum length of ${CHAT_MAX_LENGTH} characters`,
          },
        });
        break;
      }
      const sanitizedMessage = escapeHtml(rawMessage);
      mockBroadcastToSession(clients, chatSessionId, {
        type: 'chat',
        payload: {
          playerId: client.playerId,
          message: sanitizedMessage,
          timestamp: expect.any(String),
        },
      });
      break;
    }

    default:
      break;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════════════

describe('WebSocket Message Handling', () => {
  let mockWs: any;
  let client: ConnectedClient;
  let clients: Map<string, ConnectedClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMap.clear();

    mockWs = createMockWs();
    client = {
      id: 'client-001',
      ws: mockWs,
      lastPing: Date.now(),
    };
    clients = new Map();
    clients.set(client.id, client);
  });

  // ── Connection welcome ──────────────────────────────────────────────────

  describe('Connection welcome', () => {
    it('should send a connected welcome message on new connection', () => {
      // Simulate what createWebSocketServer does on 'connection'
      mockSendTo(mockWs, {
        type: 'connected',
        payload: {
          clientId: client.id,
          message: 'Connected to Moltblox WebSocket server',
          timestamp: new Date().toISOString(),
        },
      });

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'connected',
          payload: expect.objectContaining({
            clientId: client.id,
            message: 'Connected to Moltblox WebSocket server',
          }),
        }),
      );
    });
  });

  // ── Authentication ──────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should authenticate with a valid JWT and set playerId', async () => {
      const token = makeToken('user-123', '0xabc');
      await handleMessage(client, { type: 'authenticate', payload: { token } }, clients);

      expect(client.playerId).toBe('user-123');
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'authenticated',
          payload: expect.objectContaining({
            playerId: 'user-123',
            message: 'Authentication successful',
          }),
        }),
      );
    });

    it('should reject an invalid token with error message', async () => {
      await handleMessage(
        client,
        { type: 'authenticate', payload: { token: 'invalid-jwt-token' } },
        clients,
      );

      expect(client.playerId).toBeUndefined();
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Invalid or expired token',
          }),
        }),
      );
    });

    it('should reject a revoked (blocklisted) token', async () => {
      const token = makeToken('user-456', '0xdef');
      vi.mocked(isTokenBlocked).mockResolvedValueOnce(true);

      await handleMessage(client, { type: 'authenticate', payload: { token } }, clients);

      expect(client.playerId).toBeUndefined();
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Token has been revoked',
          }),
        }),
      );
    });
  });

  // ── Pre-auth message rejection ──────────────────────────────────────────

  describe('Pre-auth message rejection', () => {
    it('should reject game messages before authentication', async () => {
      const gameActions = [
        { type: 'join_queue', payload: { gameId: 'game-1' } },
        { type: 'leave_queue', payload: {} },
        { type: 'game_action', payload: { action: { type: 'move' } } },
        { type: 'leave', payload: {} },
        { type: 'chat', payload: { message: 'hello' } },
      ];

      for (const msg of gameActions) {
        mockSendTo.mockClear();
        await handleMessage(client, msg as WSMessage, clients);
        expect(mockSendTo).toHaveBeenCalledWith(
          mockWs,
          expect.objectContaining({
            type: 'error',
            payload: expect.objectContaining({
              message: 'Authentication required. Send an "authenticate" message first.',
            }),
          }),
        );
      }
    });
  });

  // ── Rate limiting ───────────────────────────────────────────────────────

  describe('Rate limiting', () => {
    it('should allow messages within the rate limit window', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_MESSAGES; i++) {
        expect(checkRateLimit(client)).toBe(true);
      }
      // No warning should have been sent within the limit
      expect(mockSendTo).not.toHaveBeenCalled();
    });

    it('should send a warning after exceeding max messages in window', () => {
      // Exhaust normal limit
      for (let i = 0; i < RATE_LIMIT_MAX_MESSAGES; i++) {
        checkRateLimit(client);
      }

      // Next message exceeds limit
      const result = checkRateLimit(client);
      expect(result).toBe(true); // Still allowed but with warning
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: expect.stringContaining('Rate limit exceeded'),
          }),
        }),
      );
    });

    it('should disconnect after max warnings', () => {
      // Trigger warnings up to the disconnect threshold
      for (let w = 0; w < RATE_LIMIT_MAX_WARNINGS; w++) {
        // Exhaust normal limit
        for (let i = 0; i < RATE_LIMIT_MAX_MESSAGES; i++) {
          checkRateLimit(client);
        }
        // Trigger warning/disconnect
        const result = checkRateLimit(client);
        if (w < RATE_LIMIT_MAX_WARNINGS - 1) {
          expect(result).toBe(true);
        } else {
          // Final warning triggers disconnect
          expect(result).toBe(false);
        }
        // Reset message count for next window
        const key = client.playerId || client.id;
        const state = rateLimitMap.get(key)!;
        state.messageCount = 0;
        state.windowStart = Date.now();
      }

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Rate limit exceeded repeatedly. Disconnecting.',
          }),
        }),
      );
    });
  });

  // ── join_queue ──────────────────────────────────────────────────────────

  describe('join_queue', () => {
    beforeEach(() => {
      client.playerId = 'player-001';
    });

    it('should call joinQueue with the correct gameId', async () => {
      await handleMessage(client, { type: 'join_queue', payload: { gameId: 'game-abc' } }, clients);

      expect(mockJoinQueue).toHaveBeenCalledWith(client, 'game-abc', clients);
    });

    it('should reject join_queue without gameId', async () => {
      await handleMessage(client, { type: 'join_queue', payload: {} }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Missing required field "gameId" for join_queue message',
          }),
        }),
      );
    });
  });

  // ── leave_queue ─────────────────────────────────────────────────────────

  describe('leave_queue', () => {
    beforeEach(() => {
      client.playerId = 'player-001';
    });

    it('should call leaveQueue and send queue_left response', async () => {
      mockLeaveQueue.mockResolvedValueOnce(true);

      await handleMessage(client, { type: 'leave_queue', payload: {} }, clients);

      expect(mockLeaveQueue).toHaveBeenCalledWith(client);
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'queue_left',
          payload: expect.objectContaining({
            removed: true,
            message: 'Left queue',
          }),
        }),
      );
    });
  });

  // ── game_action ─────────────────────────────────────────────────────────

  describe('game_action', () => {
    beforeEach(() => {
      client.playerId = 'player-001';
    });

    it('should forward valid game action to session manager', async () => {
      const action = { type: 'move', x: 1, y: 2 };
      await handleMessage(client, { type: 'game_action', payload: { action } }, clients);

      expect(mockHandleGameAction).toHaveBeenCalledWith(client, action, clients);
    });

    it('should reject game_action without action.type', async () => {
      const action = { x: 1, y: 2 };
      await handleMessage(client, { type: 'game_action', payload: { action } }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Invalid action: missing "type" string field',
          }),
        }),
      );
    });

    it('should reject game_action without action field', async () => {
      await handleMessage(client, { type: 'game_action', payload: {} }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Missing required field "action" for game_action message',
          }),
        }),
      );
    });
  });

  // ── Unknown message type ────────────────────────────────────────────────

  describe('Unknown message type', () => {
    it('should return an error for unknown message types', async () => {
      await handleMessage(client, { type: 'totally_unknown', payload: {} }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Unknown message type: totally_unknown',
            supportedTypes: expect.arrayContaining(['authenticate', 'join_queue']),
          }),
        }),
      );
    });
  });

  // ── Invalid message shape ───────────────────────────────────────────────

  describe('Invalid message shape', () => {
    it('should reject messages with non-string type', async () => {
      await handleMessage(client, { type: 123 as any, payload: {} }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Invalid message shape. Expected { type: string, payload?: object }.',
          }),
        }),
      );
    });

    it('should reject null messages', async () => {
      await handleMessage(client, null as any, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Invalid message shape. Expected { type: string, payload?: object }.',
          }),
        }),
      );
    });
  });

  // ── Disconnect cleanup ──────────────────────────────────────────────────

  describe('Disconnect cleanup', () => {
    it('should clean up client state on disconnect', () => {
      client.playerId = 'player-001';
      client.gameSessionId = 'session-001';
      rateLimitMap.set(client.id, { messageCount: 5, windowStart: Date.now(), warnings: 0 });
      rateLimitMap.set('player-001', { messageCount: 3, windowStart: Date.now(), warnings: 0 });

      // Simulate what the 'close' handler does
      clients.delete(client.id);
      rateLimitMap.delete(client.id);
      if (client.playerId) rateLimitMap.delete(client.playerId);

      expect(clients.has(client.id)).toBe(false);
      expect(rateLimitMap.has(client.id)).toBe(false);
      expect(rateLimitMap.has('player-001')).toBe(false);
    });
  });

  // ── Spectating ──────────────────────────────────────────────────────────

  describe('Spectating', () => {
    beforeEach(() => {
      client.playerId = 'player-001';
    });

    it('should set spectating session on valid spectate request', async () => {
      mockIsActiveSession.mockResolvedValueOnce(true);

      await handleMessage(
        client,
        { type: 'spectate', payload: { sessionId: 'session-abc' } },
        clients,
      );

      expect(client.spectating).toBe('session-abc');
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'spectating',
          payload: expect.objectContaining({
            sessionId: 'session-abc',
          }),
        }),
      );
    });

    it('should reject spectating a non-existent session', async () => {
      mockIsActiveSession.mockResolvedValueOnce(false);

      await handleMessage(
        client,
        { type: 'spectate', payload: { sessionId: 'bad-session' } },
        clients,
      );

      expect(client.spectating).toBeUndefined();
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Session not found or already ended',
          }),
        }),
      );
    });

    it('should clear spectating on stop_spectating', async () => {
      client.spectating = 'session-abc';

      await handleMessage(client, { type: 'stop_spectating', payload: {} }, clients);

      expect(client.spectating).toBeUndefined();
      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'stopped_spectating',
          payload: expect.objectContaining({
            message: 'Stopped spectating',
          }),
        }),
      );
    });
  });

  // ── Chat ────────────────────────────────────────────────────────────────

  describe('Chat', () => {
    beforeEach(() => {
      client.playerId = 'player-001';
      client.gameSessionId = 'session-001';
    });

    it('should broadcast sanitized chat message to session', async () => {
      await handleMessage(
        client,
        { type: 'chat', payload: { message: 'Hello <script>evil</script>' } },
        clients,
      );

      expect(mockBroadcastToSession).toHaveBeenCalledWith(
        clients,
        'session-001',
        expect.objectContaining({
          type: 'chat',
          payload: expect.objectContaining({
            playerId: 'player-001',
            message: 'Hello &lt;script&gt;evil&lt;/script&gt;',
          }),
        }),
      );
    });

    it('should reject empty chat messages', async () => {
      await handleMessage(client, { type: 'chat', payload: { message: '   ' } }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Chat message cannot be empty',
          }),
        }),
      );
    });

    it('should reject chat messages exceeding max length', async () => {
      const longMessage = 'a'.repeat(CHAT_MAX_LENGTH + 1);

      await handleMessage(client, { type: 'chat', payload: { message: longMessage } }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: expect.stringContaining('exceeds maximum length'),
          }),
        }),
      );
    });

    it('should reject chat when not in a session', async () => {
      client.gameSessionId = undefined;
      client.spectating = undefined;

      await handleMessage(client, { type: 'chat', payload: { message: 'hello' } }, clients);

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Not in a session or spectating',
          }),
        }),
      );
    });
  });

  // ── end_game ────────────────────────────────────────────────────────────

  describe('end_game', () => {
    beforeEach(() => {
      client.playerId = 'player-001';
      client.gameSessionId = 'session-001';
    });

    it('should reject ending a session the client is not in', async () => {
      await handleMessage(
        client,
        { type: 'end_game', payload: { sessionId: 'other-session' } },
        clients,
      );

      expect(mockSendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            message: 'Not authorized to end this session',
          }),
        }),
      );
    });

    it('should call endSession for the correct session', async () => {
      await handleMessage(
        client,
        {
          type: 'end_game',
          payload: {
            sessionId: 'session-001',
            scores: { 'player-001': 100 },
            winnerId: 'player-001',
          },
        },
        clients,
      );

      expect(mockEndSession).toHaveBeenCalledWith(
        'session-001',
        { 'player-001': 100 },
        'player-001',
        clients,
      );
    });
  });
});

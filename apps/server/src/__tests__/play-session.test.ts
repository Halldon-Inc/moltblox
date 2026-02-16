/**
 * Play-session route handler tests for Moltblox API.
 *
 * Tests the POST /games/:id/play-session endpoint that records template
 * game plays, updates totalPlays, and conditionally increments uniquePlayers.
 *
 * Prisma and other external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import http from 'http';

const mockPrisma = vi.hoisted(() => ({
  game: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  gameSession: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  gameSessionPlayer: {
    findFirst: vi.fn(),
    create: vi.fn(),
    groupBy: vi.fn(),
  },
  gameRating: {
    count: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  item: {
    findMany: vi.fn(),
  },
  purchase: {
    aggregate: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock('../lib/tokenBlocklist.js', () => ({
  isTokenBlocked: vi.fn().mockResolvedValue(false),
  blockToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  Sentry: { setupExpressErrorHandler: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../lib/redis.js', () => ({
  default: {
    set: vi.fn(),
    exists: vi.fn().mockResolvedValue(0),
    call: vi.fn().mockImplementation((...args: string[]) => {
      if (args[0] === 'SCRIPT') return Promise.resolve('fakeSha1Hash');
      if (args[0] === 'EVALSHA') return Promise.resolve([1, 60000]);
      return Promise.resolve('OK');
    }),
  },
  createRedisStore: vi.fn(() => ({
    init: vi.fn(),
    increment: vi.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
    decrement: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../lib/sanitize.js', () => ({
  sanitize: vi.fn((input: string) => input),
  sanitizeObject: vi.fn((obj: Record<string, unknown>, keys: string[]) => obj),
}));

import { signToken } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import gamesRouter from '../routes/games/index.js';

// Helpers

function buildApp(path: string, router: express.Router): Express {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  app.use(errorHandler);
  return app;
}

interface TestResponse {
  status: number;
  body: any;
  headers: Record<string, string | string[] | undefined>;
}

async function request(
  app: Express,
  method: string,
  path: string,
  options: { body?: any; headers?: Record<string, string> } = {},
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      const bodyStr = options.body ? JSON.stringify(options.body) : undefined;
      const reqOptions: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
      };

      const req = http.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          let body: any;
          try {
            body = JSON.parse(data);
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, body, headers: res.headers as any });
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  });
}

const botUser = {
  id: 'bot-user-001',
  walletAddress: '0x1111111111111111111111111111111111111111',
  displayName: 'TestBot',
  username: 'testbot',
  role: 'bot',
};

const humanUser = {
  id: 'human-user-001',
  walletAddress: '0x2222222222222222222222222222222222222222',
  displayName: 'TestHuman',
  username: 'testhuman',
  role: 'human',
};

function authHeaderFor(userId: string, address: string) {
  const token = signToken(userId, address);
  return { Authorization: `Bearer ${token}` };
}

// Use a valid CUID for the game ID (Zod validates .cuid())
const validGameId = 'clgame0000000000000000001';

// Tests

describe('Play Session Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/games', gamesRouter);
    mockPrisma.user.findUnique.mockResolvedValue(humanUser);
  });

  describe('POST /games/:id/play-session', () => {
    it('should record a play session successfully', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        status: 'published',
      });

      const fakeSession = { id: 'session-001', gameId: validGameId, status: 'completed' };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          gameSessionPlayer: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
          gameSession: {
            create: vi.fn().mockResolvedValue(fakeSession),
          },
          game: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/games/${validGameId}/play-session`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBe('session-001');
      expect(res.body.recorded).toBe(true);
    });

    it('should increment totalPlays on every play', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        status: 'published',
      });

      let gameUpdateData: any = null;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          gameSessionPlayer: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
          gameSession: {
            create: vi.fn().mockResolvedValue({ id: 'session-002' }),
          },
          game: {
            update: vi.fn().mockImplementation(({ data }) => {
              gameUpdateData = data;
              return Promise.resolve({});
            }),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      await request(app, 'POST', `/games/${validGameId}/play-session`, {
        body: {},
        headers,
      });

      expect(gameUpdateData).toBeDefined();
      expect(gameUpdateData.totalPlays).toEqual({ increment: 1 });
    });

    it('should increment uniquePlayers on first play', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        status: 'published',
      });

      let gameUpdateData: any = null;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          gameSessionPlayer: {
            // No existing play = first time player
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
          gameSession: {
            create: vi.fn().mockResolvedValue({ id: 'session-003' }),
          },
          game: {
            update: vi.fn().mockImplementation(({ data }) => {
              gameUpdateData = data;
              return Promise.resolve({});
            }),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      await request(app, 'POST', `/games/${validGameId}/play-session`, {
        body: {},
        headers,
      });

      expect(gameUpdateData.uniquePlayers).toEqual({ increment: 1 });
    });

    it('should NOT increment uniquePlayers on repeat play', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        status: 'published',
      });

      let gameUpdateData: any = null;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          gameSessionPlayer: {
            // Existing play found = repeat player
            findFirst: vi.fn().mockResolvedValue({ id: 'existing-session-player' }),
            create: vi.fn().mockResolvedValue({}),
          },
          gameSession: {
            create: vi.fn().mockResolvedValue({ id: 'session-004' }),
          },
          game: {
            update: vi.fn().mockImplementation(({ data }) => {
              gameUpdateData = data;
              return Promise.resolve({});
            }),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      await request(app, 'POST', `/games/${validGameId}/play-session`, {
        body: {},
        headers,
      });

      expect(gameUpdateData.totalPlays).toEqual({ increment: 1 });
      expect(gameUpdateData.uniquePlayers).toBeUndefined();
    });

    it('should require auth (401 without)', async () => {
      const res = await request(app, 'POST', `/games/${validGameId}/play-session`, {
        body: {},
      });
      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/games/${validGameId}/play-session`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });
});

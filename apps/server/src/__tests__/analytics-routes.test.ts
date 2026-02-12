/**
 * Analytics route handler tests for Moltblox API.
 *
 * Tests game-level analytics (GET /games/:id/analytics) which is on the
 * games router, and creator dashboard (GET /creator/analytics) which is
 * on the analytics router. Both require bot auth.
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
  },
  gameSessionPlayer: {
    groupBy: vi.fn(),
  },
  gameRating: {
    count: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  item: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
}));

vi.mock('../lib/sanitize.js', () => ({
  sanitize: vi.fn((input: string) => input),
  sanitizeObject: vi.fn((obj: Record<string, unknown>, keys: string[]) => obj),
}));

import { signToken } from '../middleware/auth.js';
import gamesRouter from '../routes/games.js';
import analyticsRouter from '../routes/analytics.js';

// Helpers

function buildApp(path: string, router: express.Router): Express {
  const app = express();
  app.use(express.json());
  app.use(path, router);
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

const otherBotUser = {
  id: 'bot-user-002',
  walletAddress: '0x3333333333333333333333333333333333333333',
  displayName: 'OtherBot',
  username: 'otherbot',
  role: 'bot',
};

function authHeaderFor(userId: string, address: string) {
  const token = signToken(userId, address);
  return { Authorization: `Bearer ${token}` };
}

const validGameId = 'clgame0000000000000000001';

// Tests

describe('Game Analytics (GET /games/:id/analytics)', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/games', gamesRouter);
  });

  it('should return daily play and revenue data for game owner', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(botUser);

    mockPrisma.game.findUnique.mockResolvedValue({
      id: validGameId,
      creatorId: botUser.id,
      name: 'Test Game',
    });

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ day: '2026-02-10', count: BigInt(5) }])
      .mockResolvedValueOnce([{ day: '2026-02-10', total: BigInt(1000) }])
      .mockResolvedValueOnce([{ total: BigInt(2), returning: BigInt(1) }]);

    mockPrisma.item.findMany.mockResolvedValue([]);

    const headers = authHeaderFor(botUser.id, botUser.walletAddress);
    const res = await request(app, 'GET', `/games/${validGameId}/analytics`, { headers });

    expect(res.status).toBe(200);
    expect(res.body.gameId).toBe(validGameId);
    expect(res.body.gameName).toBe('Test Game');
    expect(res.body.dailyPlays).toBeDefined();
    expect(Array.isArray(res.body.dailyPlays)).toBe(true);
    expect(res.body.dailyRevenue).toBeDefined();
    expect(res.body.playerStats.totalUnique).toBe(2);
    expect(res.body.playerStats.returning).toBe(1);
  });

  it('should require game owner auth (reject non-owner bot)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(otherBotUser);

    mockPrisma.game.findUnique.mockResolvedValue({
      id: validGameId,
      creatorId: botUser.id,
      name: 'Test Game',
    });

    const headers = authHeaderFor(otherBotUser.id, otherBotUser.walletAddress);
    const res = await request(app, 'GET', `/games/${validGameId}/analytics`, { headers });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('should reject human users (require bot role)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(humanUser);

    const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
    const res = await request(app, 'GET', `/games/${validGameId}/analytics`, { headers });

    expect(res.status).toBe(403);
  });

  it('should require authentication', async () => {
    const res = await request(app, 'GET', `/games/${validGameId}/analytics`);
    expect(res.status).toBe(401);
  });
});

describe('Creator Analytics (GET /creator/analytics)', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/creator/analytics', analyticsRouter);
  });

  it('should return creator dashboard data', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(botUser);

    mockPrisma.game.findMany.mockResolvedValue([
      {
        id: 'game-001',
        name: 'Game One',
        totalPlays: 100,
        totalRevenue: BigInt(5000),
        uniquePlayers: 20,
        averageRating: 4.2,
      },
    ]);

    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.gameSessionPlayer.groupBy.mockResolvedValue([]);
    mockPrisma.item.findMany.mockResolvedValue([]);

    const headers = authHeaderFor(botUser.id, botUser.walletAddress);
    const res = await request(app, 'GET', '/creator/analytics', { headers });

    expect(res.status).toBe(200);
    expect(res.body.totalGames).toBe(1);
    expect(res.body.perGameRevenue).toHaveLength(1);
    expect(res.body.perGameRevenue[0].gameName).toBe('Game One');
    expect(res.body.perGameRevenue[0].totalRevenue).toBe('5000');
    expect(res.body.dailyPlays).toBeDefined();
    expect(res.body.playerStats).toBeDefined();
  });

  it('should require bot role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(humanUser);

    const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
    const res = await request(app, 'GET', '/creator/analytics', { headers });

    expect(res.status).toBe(403);
  });

  it('should require authentication', async () => {
    const res = await request(app, 'GET', '/creator/analytics');
    expect(res.status).toBe(401);
  });
});

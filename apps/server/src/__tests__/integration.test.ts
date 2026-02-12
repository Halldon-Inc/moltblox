/**
 * Integration test for the full game lifecycle with mocked Prisma.
 *
 * Simulates:
 * 1. Bot user creates a game with templateSlug
 * 2. Bot updates game status to published
 * 3. Human user records a play session
 * 4. Human user rates the game
 * 5. Verify game stats show 1 play, 1 unique player, and the rating
 *
 * All Prisma calls are mocked but the test exercises the full Express
 * middleware chain (validation, auth, serialization).
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
    groupBy: vi.fn(),
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
    create: vi.fn(),
  },
  inventoryItem: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn(),
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
      // SCRIPT LOAD returns a SHA1 hash string
      if (args[0] === 'SCRIPT') return Promise.resolve('fakeSha1Hash');
      // EVALSHA returns [totalHits, timeToExpire]
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

function authHeaderFor(userId: string, address: string) {
  const token = signToken(userId, address);
  return { Authorization: `Bearer ${token}` };
}

const gameId = 'clgame0000000000000000001';

// Tests

describe('Game Lifecycle Integration', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/games', gamesRouter);
  });

  it('should complete a full create > publish > play > rate > stats cycle', async () => {
    // Step 1: Bot creates a game with templateSlug
    mockPrisma.user.findUnique.mockResolvedValue(botUser);

    const createdGame = {
      id: gameId,
      name: 'Lifecycle Test Game',
      slug: 'lifecycle-test-game',
      description: 'A game for integration testing',
      status: 'draft',
      templateSlug: 'puzzle',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
      totalRevenue: BigInt(0),
      creator: {
        username: botUser.username,
        displayName: botUser.displayName,
        walletAddress: botUser.walletAddress,
      },
    };
    mockPrisma.game.create.mockResolvedValue(createdGame);

    const botHeaders = authHeaderFor(botUser.id, botUser.walletAddress);
    const createRes = await request(app, 'POST', '/games', {
      body: {
        name: 'Lifecycle Test Game',
        description: 'A game for integration testing',
        templateSlug: 'puzzle',
      },
      headers: botHeaders,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Lifecycle Test Game');
    expect(createRes.body.totalRevenue).toBe('0');

    // Step 2: Bot updates game status to published
    const publishedGame = {
      ...createdGame,
      status: 'published',
      publishedAt: new Date(),
    };
    mockPrisma.game.findUnique.mockResolvedValue({
      id: gameId,
      creatorId: botUser.id,
    });
    mockPrisma.game.update.mockResolvedValue(publishedGame);

    const updateRes = await request(app, 'PUT', `/games/${gameId}`, {
      body: { status: 'published' },
      headers: botHeaders,
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('published');

    // Step 3: Human user records a play session
    mockPrisma.user.findUnique.mockResolvedValue(humanUser);
    mockPrisma.game.findUnique.mockResolvedValue({
      id: gameId,
      status: 'published',
    });

    const fakeSession = { id: 'session-int-001', gameId, status: 'completed' };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const mockTx = {
        gameSessionPlayer: {
          findFirst: vi.fn().mockResolvedValue(null), // first time player
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

    const humanHeaders = authHeaderFor(humanUser.id, humanUser.walletAddress);
    const playRes = await request(app, 'POST', `/games/${gameId}/play-session`, {
      body: {},
      headers: humanHeaders,
    });

    expect(playRes.status).toBe(200);
    expect(playRes.body.recorded).toBe(true);
    expect(playRes.body.sessionId).toBe('session-int-001');

    // Step 4: Human user rates the game
    mockPrisma.game.findUnique.mockResolvedValue({ id: gameId });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const mockTx = {
        gameRating: {
          upsert: vi.fn().mockResolvedValue({}),
          aggregate: vi.fn().mockResolvedValue({
            _avg: { rating: 4 },
            _count: { rating: 1 },
          }),
        },
        game: {
          update: vi.fn().mockResolvedValue({
            averageRating: 4,
            ratingCount: 1,
          }),
        },
      };
      return fn(mockTx);
    });

    const rateRes = await request(app, 'POST', `/games/${gameId}/rate`, {
      body: { rating: 4 },
      headers: humanHeaders,
    });

    expect(rateRes.status).toBe(200);
    expect(rateRes.body.rating).toBe(4);
    expect(rateRes.body.averageRating).toBe(4);
    expect(rateRes.body.ratingCount).toBe(1);

    // Step 5: Verify game stats show 1 play, 1 unique player, and the rating
    mockPrisma.game.findUnique.mockResolvedValue({
      id: gameId,
      totalPlays: 1,
      uniquePlayers: 1,
      totalRevenue: BigInt(0),
      averageRating: 4,
      ratingCount: 1,
    });

    mockPrisma.gameRating.groupBy.mockResolvedValue([{ rating: 4, _count: { id: 1 } }]);

    mockPrisma.purchase.aggregate.mockResolvedValue({
      _sum: {
        price: null,
        creatorAmount: null,
        platformAmount: null,
      },
      _count: { id: 0 },
    });

    const statsRes = await request(app, 'GET', `/games/${gameId}/stats`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.plays.total).toBe(1);
    expect(statsRes.body.players.total).toBe(1);
    expect(statsRes.body.ratings.average).toBe(4);
    expect(statsRes.body.ratings.count).toBe(1);
    expect(statsRes.body.ratings.distribution[4]).toBe(1);
    expect(statsRes.body.revenue.total).toBe('0');
  });
});

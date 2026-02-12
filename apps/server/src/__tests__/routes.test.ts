/**
 * Route handler tests for critical API endpoints.
 *
 * Tests the games, marketplace, and tournament route handlers by mounting
 * each router on a minimal Express app and using direct HTTP-style calls
 * via mock request/response objects.
 *
 * Prisma and other external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';

// ── Mocks ───────────────────────────────────────────────────────────────────

// vi.hoisted runs before vi.mock hoisting, so references are available
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
    create: vi.fn(),
  },
  inventoryItem: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
  },
  tournament: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tournamentParticipant: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  tournamentMatch: {
    findMany: vi.fn(),
  },
  gameSessionPlayer: {
    groupBy: vi.fn(),
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
    call: vi.fn(),
  },
}));

vi.mock('rate-limit-redis', () => ({
  RedisStore: class MockRedisStore {
    constructor() {}
    init() {}
    increment() {
      return Promise.resolve({ totalHits: 1, resetTime: new Date() });
    }
    decrement() {
      return Promise.resolve();
    }
    resetKey() {
      return Promise.resolve();
    }
    resetAll() {
      return Promise.resolve();
    }
    get() {
      return Promise.resolve({ totalHits: 0, resetTime: new Date() });
    }
  },
}));

// Import after mocks are set up
import { signToken } from '../middleware/auth.js';
import gamesRouter from '../routes/games.js';
import marketplaceRouter from '../routes/marketplace.js';
import tournamentsRouter from '../routes/tournaments.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Express app with a router mounted at the given path. */
function buildApp(path: string, router: express.Router): Express {
  const app = express();
  app.use(express.json());
  // Skip CSRF for tests — matching req/res mock pattern from existing tests
  app.use(path, router);
  return app;
}

/** Make a simple mock request directly (for unit-style tests). */
function mockReq(overrides: Partial<any> = {}): any {
  return { body: {}, params: {}, query: {}, headers: {}, cookies: {}, ...overrides };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  return res;
}

// Simulated user objects
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

// ── Supertest-like helper (lightweight) ─────────────────────────────────────

/**
 * A minimal request helper that pipes an HTTP-like call through Express.
 * Uses Node's built-in http module so we can test full middleware chains.
 */
import http from 'http';

interface TestResponse {
  status: number;
  body: any;
  headers: Record<string, string | string[] | undefined>;
}

async function request(
  app: Express,
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
  } = {},
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

// ════════════════════════════════════════════════════════════════════════════
// GAMES ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe('Games Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/games', gamesRouter);

    // Default: user lookup returns the bot user
    mockPrisma.game.findMany.mockResolvedValue([]);
    mockPrisma.game.count.mockResolvedValue(0);
  });

  // ── GET /games ──────────────────────────────────────────────────────────

  describe('GET /games', () => {
    it('should return a game list with pagination', async () => {
      const fakeGames = [
        {
          id: 'clgame00000000000000000001',
          name: 'Test Game',
          totalRevenue: BigInt(1000),
          creator: { username: 'bot1', displayName: 'Bot One', walletAddress: '0xabc' },
        },
      ];
      mockPrisma.game.findMany.mockResolvedValue(fakeGames);
      mockPrisma.game.count.mockResolvedValue(1);

      const res = await request(app, 'GET', '/games');
      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(1);
      expect(res.body.games[0].totalRevenue).toBe('1000');
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    it('should respect limit and offset query params', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.game.count.mockResolvedValue(50);

      const res = await request(app, 'GET', '/games?limit=10&offset=5');
      expect(res.status).toBe(200);
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
    });

    it('should filter by genre', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.game.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/games?genre=puzzle');
      expect(res.status).toBe(200);
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ genre: 'puzzle' }),
        }),
      );
    });

    it('should sort by newest', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.game.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/games?sort=newest');
      expect(res.status).toBe(200);
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.game.count.mockResolvedValue(0);

      await request(app, 'GET', '/games?limit=999');
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  // ── GET /games/:id ────────────────────────────────────────────────────

  describe('GET /games/:id', () => {
    const validId = 'clgame00000000000000000001';

    it('should return a game by ID', async () => {
      const fakeGame = {
        id: validId,
        name: 'Test Game',
        totalRevenue: BigInt(0),
        creator: { username: 'bot1', displayName: 'Bot One', walletAddress: '0xabc' },
      };
      mockPrisma.game.findUnique.mockResolvedValue(fakeGame);

      const res = await request(app, 'GET', `/games/${validId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(validId);
      expect(res.body.name).toBe('Test Game');
      expect(res.body.totalRevenue).toBe('0');
    });

    it('should return 404 when game not found', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', `/games/${validId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(app, 'GET', '/games/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });

  // ── POST /games ───────────────────────────────────────────────────────

  describe('POST /games', () => {
    it('should require authentication', async () => {
      const res = await request(app, 'POST', '/games', {
        body: { name: 'New Game', description: 'A test game' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject human users (require bot)', async () => {
      // Mock prisma user lookup for auth middleware
      (mockPrisma.game.findMany as any).mockResolvedValue([]);
      vi.mocked(mockPrisma.game.create).mockResolvedValue({} as any);

      // Set up user lookup to return human
      const originalFindUnique = mockPrisma.game.findUnique;
      const mockUserFindUnique = vi.fn();
      (mockPrisma as any).user = { findUnique: mockUserFindUnique };
      mockUserFindUnique.mockResolvedValue(humanUser);

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/games', {
        body: { name: 'New Game', description: 'A test game' },
        headers,
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should allow bot users to create games', async () => {
      // Set up user lookup to return bot
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      const fakeGame = {
        id: 'clgame00000000000000000099',
        name: 'New Game',
        slug: 'new-game',
        description: 'A test game',
        totalRevenue: BigInt(0),
        creator: {
          username: botUser.username,
          displayName: botUser.displayName,
          walletAddress: botUser.walletAddress,
        },
      };
      mockPrisma.game.create.mockResolvedValue(fakeGame);

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/games', {
        body: { name: 'New Game', description: 'A test game' },
        headers,
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Game');
      expect(res.body.totalRevenue).toBe('0');
    });

    it('should reject missing name', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/games', {
        body: { description: 'A test game' },
        headers,
      });
      // Zod validation should catch missing name
      expect(res.status).toBe(400);
    });

    it('should reject missing description', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/games', {
        body: { name: 'Test Game' },
        headers,
      });
      expect(res.status).toBe(400);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MARKETPLACE ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe('Marketplace Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/marketplace', marketplaceRouter);
  });

  // ── GET /marketplace/items ────────────────────────────────────────────

  describe('GET /marketplace/items', () => {
    it('should return item list with pagination', async () => {
      const fakeItems = [
        {
          id: 'clitem0000000000000000010',
          name: 'Cool Sword',
          price: BigInt(1000000000000000000),
          active: true,
          game: { id: 'g1', name: 'Game 1', slug: 'game-1', thumbnailUrl: null },
          creator: { id: 'c1', displayName: 'Bot', walletAddress: '0xabc' },
        },
      ];
      mockPrisma.item.findMany.mockResolvedValue(fakeItems);
      mockPrisma.item.count.mockResolvedValue(1);

      const res = await request(app, 'GET', '/marketplace/items');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].price).toBe('1000000000000000000');
      expect(res.body.pagination.total).toBe(1);
    });

    it('should filter by category', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/marketplace/items?category=cosmetic');
      expect(res.status).toBe(200);
      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'cosmetic' }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      await request(app, 'GET', '/marketplace/items?limit=500');
      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  // ── GET /marketplace/items/:id ────────────────────────────────────────

  describe('GET /marketplace/items/:id', () => {
    const validId = 'clitem0000000000000000010';

    it('should return item details', async () => {
      const fakeItem = {
        id: validId,
        name: 'Cool Sword',
        price: BigInt(5000),
        game: { id: 'g1', name: 'Game 1', slug: 'game-1', thumbnailUrl: null },
        creator: { id: 'c1', displayName: 'Bot', walletAddress: '0xabc' },
      };
      mockPrisma.item.findUnique.mockResolvedValue(fakeItem);

      const res = await request(app, 'GET', `/marketplace/items/${validId}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Cool Sword');
      expect(res.body.price).toBe('5000');
    });

    it('should return 404 when item not found', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', `/marketplace/items/${validId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  // ── POST /marketplace/items ───────────────────────────────────────────

  describe('POST /marketplace/items', () => {
    it('should require authentication', async () => {
      const res = await request(app, 'POST', '/marketplace/items', {
        body: {
          gameId: 'clgame00000000000000000001',
          name: 'Item',
          description: 'An item',
          price: '100',
        },
      });
      expect(res.status).toBe(401);
    });

    it('should reject human users', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/marketplace/items', {
        body: {
          gameId: 'clgame00000000000000000001',
          name: 'Item',
          description: 'An item',
          price: '100',
        },
        headers,
      });
      expect(res.status).toBe(403);
    });

    it('should allow bot to create items for their own game', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      const gameId = 'clgame00000000000000000001';
      mockPrisma.game.findUnique.mockResolvedValue({
        id: gameId,
        creatorId: botUser.id,
      });

      const fakeItem = {
        id: 'clitem0000000000000000020',
        gameId,
        name: 'Cool Sword',
        description: 'A sword',
        price: BigInt(100),
        game: { id: gameId, name: 'Game', slug: 'game' },
        creator: {
          id: botUser.id,
          displayName: botUser.displayName,
          walletAddress: botUser.walletAddress,
        },
      };
      mockPrisma.item.create.mockResolvedValue(fakeItem);

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/marketplace/items', {
        body: {
          gameId,
          name: 'Cool Sword',
          description: 'A sword',
          price: '100',
        },
        headers,
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Cool Sword');
      expect(res.body.price).toBe('100');
    });

    it('should reject creating items for games you do not own', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      const gameId = 'clgame00000000000000000001';
      mockPrisma.game.findUnique.mockResolvedValue({
        id: gameId,
        creatorId: 'someone-else',
      });

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/marketplace/items', {
        body: {
          gameId,
          name: 'Cool Sword',
          description: 'A sword',
          price: '100',
        },
        headers,
      });
      expect(res.status).toBe(403);
    });
  });

  // ── POST /marketplace/items/:id/purchase ──────────────────────────────

  describe('POST /marketplace/items/:id/purchase', () => {
    const itemId = 'clitem0000000000000000010';

    it('should require authentication', async () => {
      const res = await request(app, 'POST', `/marketplace/items/${itemId}/purchase`, {
        body: { quantity: 1 },
      });
      expect(res.status).toBe(401);
    });

    it('should allow authenticated users to purchase items', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const fakePurchaseResult = {
        purchase: {
          id: 'purchase-001',
          itemId,
          gameId: 'game-001',
          buyerId: humanUser.id,
          buyerAddress: humanUser.walletAddress,
          sellerId: botUser.id,
          sellerAddress: botUser.walletAddress,
          price: '100',
          creatorAmount: '85',
          platformAmount: '15',
          quantity: 1,
          txHash: null,
          blockNumber: null,
          createdAt: new Date().toISOString(),
        },
      };
      mockPrisma.$transaction.mockResolvedValue(fakePurchaseResult);

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/marketplace/items/${itemId}/purchase`, {
        body: { quantity: 1 },
        headers,
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Purchase successful. Item added to your inventory.');
    });

    it('should return 404 for nonexistent item via transaction error', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      mockPrisma.$transaction.mockRejectedValue(
        Object.assign(new Error(`Item with id "${itemId}" not found`), { statusCode: 404 }),
      );

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/marketplace/items/${itemId}/purchase`, {
        body: { quantity: 1 },
        headers,
      });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid UUID param', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/marketplace/items/bad-id/purchase', {
        body: { quantity: 1 },
        headers,
      });
      expect(res.status).toBe(400);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TOURNAMENT ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe('Tournament Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/tournaments', tournamentsRouter);
  });

  // ── GET /tournaments ──────────────────────────────────────────────────

  describe('GET /tournaments', () => {
    it('should return tournament list with pagination', async () => {
      const fakeTournaments = [
        {
          id: 'cltournament000000000030',
          name: 'Weekly Showdown',
          prizePool: BigInt(10000),
          entryFee: BigInt(100),
          game: { id: 'g1', name: 'Game 1' },
          sponsor: {
            id: 's1',
            username: 'sponsorbot',
            displayName: 'Sponsor',
            walletAddress: '0xabc',
          },
        },
      ];
      mockPrisma.tournament.findMany.mockResolvedValue(fakeTournaments);
      mockPrisma.tournament.count.mockResolvedValue(1);

      const res = await request(app, 'GET', '/tournaments');
      expect(res.status).toBe(200);
      expect(res.body.tournaments).toHaveLength(1);
      expect(res.body.tournaments[0].prizePool).toBe('10000');
      expect(res.body.tournaments[0].entryFee).toBe('100');
      expect(res.body.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/tournaments?status=registration');
      expect(res.status).toBe(200);
      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'registration' }),
        }),
      );
    });

    it('should filter by format', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/tournaments?format=round_robin');
      expect(res.status).toBe(200);
      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ format: 'round_robin' }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      await request(app, 'GET', '/tournaments?limit=999');
      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ── GET /tournaments/:id ──────────────────────────────────────────────

  describe('GET /tournaments/:id', () => {
    const validId = 'cltournament000000000030';

    it('should return tournament details', async () => {
      const fakeTournament = {
        id: validId,
        name: 'Weekly Showdown',
        prizePool: BigInt(10000),
        entryFee: BigInt(100),
        game: { id: 'g1', name: 'Game 1' },
        sponsor: {
          id: 's1',
          username: 'sponsorbot',
          displayName: 'Sponsor',
          walletAddress: '0xabc',
        },
        participants: [
          {
            id: 'p1',
            entryFeePaid: BigInt(100),
            prizeWon: null,
            user: {
              id: 'u1',
              username: 'player1',
              displayName: 'Player 1',
              walletAddress: '0xp1',
            },
          },
        ],
      };
      mockPrisma.tournament.findUnique.mockResolvedValue(fakeTournament);

      const res = await request(app, 'GET', `/tournaments/${validId}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Weekly Showdown');
      expect(res.body.prizePool).toBe('10000');
      expect(res.body.participants[0].entryFeePaid).toBe('100');
    });

    it('should return 404 when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', `/tournaments/${validId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(app, 'GET', '/tournaments/bad-id');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });

  // ── POST /tournaments ─────────────────────────────────────────────────

  describe('POST /tournaments', () => {
    const validTournamentBody = {
      name: 'Weekly Showdown',
      description: 'A weekly tournament for all players',
      gameId: 'clgame00000000000000000001',
      maxParticipants: 16,
      registrationStart: '2026-03-01T00:00:00Z',
      registrationEnd: '2026-03-05T00:00:00Z',
      startTime: '2026-03-06T00:00:00Z',
    };

    it('should require authentication', async () => {
      const res = await request(app, 'POST', '/tournaments', {
        body: validTournamentBody,
      });
      expect(res.status).toBe(401);
    });

    it('should reject human users', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/tournaments', {
        body: validTournamentBody,
        headers,
      });
      expect(res.status).toBe(403);
    });

    it('should allow bot users to create tournaments', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      mockPrisma.game.findUnique.mockResolvedValue({ id: validTournamentBody.gameId });

      const fakeTournament = {
        id: 'cltournament000000000040',
        ...validTournamentBody,
        prizePool: BigInt(0),
        entryFee: BigInt(0),
        game: { id: validTournamentBody.gameId, name: 'Game' },
        sponsor: {
          id: botUser.id,
          username: botUser.username,
          displayName: botUser.displayName,
          walletAddress: botUser.walletAddress,
        },
      };
      mockPrisma.tournament.create.mockResolvedValue(fakeTournament);

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/tournaments', {
        body: validTournamentBody,
        headers,
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Weekly Showdown');
    });

    it('should reject when game not found', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/tournaments', {
        body: validTournamentBody,
        headers,
      });
      expect(res.status).toBe(404);
    });

    it('should reject missing required fields', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(botUser) };

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', '/tournaments', {
        body: { name: 'Incomplete' },
        headers,
      });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /tournaments/:id/register ────────────────────────────────────

  describe('POST /tournaments/:id/register', () => {
    const tournamentId = 'cltournament000000000030';

    it('should require authentication', async () => {
      const res = await request(app, 'POST', `/tournaments/${tournamentId}/register`, {
        body: {},
      });
      expect(res.status).toBe(401);
    });

    it('should allow authenticated users to register', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const now = new Date();
      const regStart = new Date(now.getTime() - 3600000);
      const regEnd = new Date(now.getTime() + 3600000);

      const fakeResult = {
        tournamentId,
        participant: {
          id: 'part-001',
          tournamentId,
          userId: humanUser.id,
          entryFeePaid: BigInt(100),
          prizeWon: null,
          status: 'registered',
          user: {
            id: humanUser.id,
            username: humanUser.username,
            displayName: humanUser.displayName,
            walletAddress: humanUser.walletAddress,
          },
        },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        // Simulate the transaction callback
        const mockTx = {
          tournament: {
            findUnique: vi.fn().mockResolvedValue({
              id: tournamentId,
              status: 'registration',
              maxParticipants: 16,
              currentParticipants: 5,
              entryFee: BigInt(100),
              registrationStart: regStart,
              registrationEnd: regEnd,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          tournamentParticipant: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(fakeResult.participant),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/tournaments/${tournamentId}/register`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Successfully registered for tournament');
    });

    it('should return 404 for nonexistent tournament', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          tournament: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/tournaments/${tournamentId}/register`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(404);
    });

    it('should reject registration when tournament is not in registration status', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          tournament: {
            findUnique: vi.fn().mockResolvedValue({
              id: tournamentId,
              status: 'in_progress',
              maxParticipants: 16,
              currentParticipants: 5,
              entryFee: BigInt(100),
              registrationStart: new Date(),
              registrationEnd: new Date(),
            }),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/tournaments/${tournamentId}/register`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Tournament is not open for registration');
    });

    it('should reject duplicate registration', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const now = new Date();
      const regStart = new Date(now.getTime() - 3600000);
      const regEnd = new Date(now.getTime() + 3600000);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          tournament: {
            findUnique: vi.fn().mockResolvedValue({
              id: tournamentId,
              status: 'registration',
              maxParticipants: 16,
              currentParticipants: 5,
              entryFee: BigInt(100),
              registrationStart: regStart,
              registrationEnd: regEnd,
            }),
          },
          tournamentParticipant: {
            findUnique: vi.fn().mockResolvedValue({ id: 'existing-participant' }),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/tournaments/${tournamentId}/register`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Already registered for this tournament');
    });

    it('should reject registration when tournament is full', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const now = new Date();
      const regStart = new Date(now.getTime() - 3600000);
      const regEnd = new Date(now.getTime() + 3600000);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          tournament: {
            findUnique: vi.fn().mockResolvedValue({
              id: tournamentId,
              status: 'registration',
              maxParticipants: 16,
              currentParticipants: 16,
              entryFee: BigInt(100),
              registrationStart: regStart,
              registrationEnd: regEnd,
            }),
          },
          tournamentParticipant: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/tournaments/${tournamentId}/register`, {
        body: {},
        headers,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Tournament is full');
    });

    it('should return 400 for invalid tournament UUID', async () => {
      (mockPrisma as any).user = { findUnique: vi.fn().mockResolvedValue(humanUser) };

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/tournaments/invalid-id/register', {
        body: {},
        headers,
      });
      expect(res.status).toBe(400);
    });
  });
});

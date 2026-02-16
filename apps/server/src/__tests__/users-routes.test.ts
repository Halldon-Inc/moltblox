/**
 * Users route handler tests for Moltblox API.
 *
 * Tests the GET /users/:username endpoint that returns a public user profile
 * with associated games and stats.
 *
 * Prisma and other external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import http from 'http';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  game: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  purchase: {
    count: vi.fn(),
  },
  tournamentParticipant: {
    findMany: vi.fn(),
  },
  userBadge: {
    findMany: vi.fn(),
  },
  tournamentWinner: {
    count: vi.fn(),
  },
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

import usersRouter from '../routes/users.js';

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

// Tests

describe('Users Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/users', usersRouter);
  });

  describe('GET /users/:username', () => {
    it('should return user profile with games', async () => {
      const fakeUser = {
        id: 'user-001',
        username: 'testbot',
        displayName: 'TestBot',
        avatarUrl: null,
        bio: 'A test bot',
        role: 'bot',
        botVerified: true,
        moltbookAgentName: 'testbot-agent',
        moltbookKarma: 100,
        reputationTotal: 50,
        createdAt: new Date('2025-01-01'),
      };

      const fakeGames = [
        {
          id: 'game-001',
          name: 'Test Game',
          slug: 'test-game',
          description: 'A test game',
          genre: 'puzzle',
          tags: ['test'],
          thumbnailUrl: null,
          totalPlays: 42,
          averageRating: 4.5,
          ratingCount: 10,
          createdAt: new Date('2025-02-01'),
        },
      ];

      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
      mockPrisma.game.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalPlays: 42 },
      });
      mockPrisma.purchase.count.mockResolvedValue(5);
      mockPrisma.game.findMany.mockResolvedValue(fakeGames);
      mockPrisma.tournamentParticipant.findMany.mockResolvedValue([]);
      mockPrisma.userBadge.findMany.mockResolvedValue([]);
      mockPrisma.tournamentWinner.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/users/testbot');
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('testbot');
      expect(res.body.user.stats.gamesCreated).toBe(1);
      expect(res.body.user.stats.totalPlays).toBe(42);
      expect(res.body.user.stats.itemsSold).toBe(5);
      expect(res.body.games).toHaveLength(1);
      expect(res.body.games[0].name).toBe('Test Game');
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app, 'GET', '/users/nobody');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
      expect(res.body.message).toBe('User not found');
    });

    it('should handle users with no games', async () => {
      const fakeUser = {
        id: 'user-002',
        username: 'newuser',
        displayName: 'New User',
        avatarUrl: null,
        bio: null,
        role: 'human',
        botVerified: false,
        moltbookAgentName: null,
        moltbookKarma: 0,
        reputationTotal: 0,
        createdAt: new Date('2025-06-01'),
      };

      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
      mockPrisma.game.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalPlays: null },
      });
      mockPrisma.purchase.count.mockResolvedValue(0);
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.tournamentParticipant.findMany.mockResolvedValue([]);
      mockPrisma.userBadge.findMany.mockResolvedValue([]);
      mockPrisma.tournamentWinner.count.mockResolvedValue(0);

      const res = await request(app, 'GET', '/users/newuser');
      expect(res.status).toBe(200);
      expect(res.body.user.stats.gamesCreated).toBe(0);
      expect(res.body.user.stats.totalPlays).toBe(0);
      expect(res.body.games).toHaveLength(0);
    });
  });
});

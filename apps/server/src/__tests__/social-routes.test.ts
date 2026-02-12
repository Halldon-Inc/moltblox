/**
 * Social route handler tests for Moltblox API.
 *
 * Tests submolts, posts, comments, voting, and heartbeat endpoints
 * by mounting the social router on a minimal Express app.
 *
 * Prisma and other external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import http from 'http';

// vi.hoisted runs before vi.mock hoisting
const mockPrisma = vi.hoisted(() => ({
  submolt: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  post: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  comment: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  vote: {
    upsert: vi.fn(),
    count: vi.fn(),
  },
  game: {
    findMany: vi.fn(),
  },
  notification: {
    count: vi.fn(),
  },
  tournament: {
    findMany: vi.fn(),
  },
  heartbeatLog: {
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
    call: vi.fn(),
  },
}));

vi.mock('../lib/sanitize.js', () => ({
  sanitize: vi.fn((input: string) => input),
  sanitizeObject: vi.fn((obj: Record<string, unknown>, keys: string[]) => obj),
}));

import { signToken } from '../middleware/auth.js';
import socialRouter from '../routes/social.js';

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

// Tests

describe('Social Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/social', socialRouter);
    mockPrisma.user.findUnique.mockResolvedValue(humanUser);
  });

  // GET /social/submolts

  describe('GET /social/submolts', () => {
    it('should return submolt list with _count', async () => {
      const fakeSubmolts = [
        {
          id: 'submolt-001',
          name: 'General',
          slug: 'general',
          active: true,
          memberCount: 42,
          _count: { posts: 10, games: 3 },
        },
      ];
      mockPrisma.submolt.findMany.mockResolvedValue(fakeSubmolts);

      const res = await request(app, 'GET', '/social/submolts');
      expect(res.status).toBe(200);
      expect(res.body.submolts).toHaveLength(1);
      expect(res.body.submolts[0]._count.posts).toBe(10);
      expect(res.body.submolts[0]._count.games).toBe(3);
    });
  });

  // GET /social/submolts/:slug

  describe('GET /social/submolts/:slug', () => {
    it('should return submolt with posts', async () => {
      const fakeSubmolt = {
        id: 'submolt-001',
        name: 'General',
        slug: 'general',
        active: true,
      };
      const fakePosts = [
        {
          id: 'post-001',
          title: 'Hello World',
          content: 'Test content',
          author: { username: 'testhuman', displayName: 'TestHuman', walletAddress: '0x222' },
        },
      ];
      mockPrisma.submolt.findUnique.mockResolvedValue(fakeSubmolt);
      mockPrisma.post.findMany.mockResolvedValue(fakePosts);
      mockPrisma.post.count.mockResolvedValue(1);

      const res = await request(app, 'GET', '/social/submolts/general');
      expect(res.status).toBe(200);
      expect(res.body.submolt.slug).toBe('general');
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should return 404 for non-existent slug', async () => {
      mockPrisma.submolt.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', '/social/submolts/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  // POST /social/submolts/:slug/posts

  describe('POST /social/submolts/:slug/posts', () => {
    it('should create a post when authenticated', async () => {
      const fakeSubmolt = { id: 'submolt-001', slug: 'general' };
      const fakePost = {
        id: 'post-new',
        title: 'New Post',
        content: 'Post content',
        submoltId: 'submolt-001',
        authorId: humanUser.id,
        type: 'discussion',
      };

      mockPrisma.submolt.findUnique.mockResolvedValue(fakeSubmolt);
      mockPrisma.post.create.mockResolvedValue(fakePost);
      mockPrisma.submolt.update.mockResolvedValue({});

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/social/submolts/general/posts', {
        body: { title: 'New Post', content: 'Post content' },
        headers,
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Post');
    });

    it('should reject without auth (401)', async () => {
      const res = await request(app, 'POST', '/social/submolts/general/posts', {
        body: { title: 'New Post', content: 'Post content' },
      });
      expect(res.status).toBe(401);
    });
  });

  // GET /social/submolts/:slug/posts/:id

  describe('GET /social/submolts/:slug/posts/:id', () => {
    it('should return post with comments', async () => {
      // Use a valid CUID-like string for validation
      const postId = 'clpost00000000000000000001';
      const fakePost = {
        id: postId,
        title: 'Test Post',
        content: 'Content',
        deleted: false,
        author: { username: 'testhuman', displayName: 'TestHuman', walletAddress: '0x222' },
      };
      const fakeComments = [
        {
          id: 'comment-001',
          content: 'Nice post!',
          author: { username: 'testbot', displayName: 'TestBot', walletAddress: '0x111' },
          parent: null,
        },
      ];

      mockPrisma.post.findUnique.mockResolvedValue(fakePost);
      mockPrisma.comment.findMany.mockResolvedValue(fakeComments);

      const res = await request(app, 'GET', `/social/submolts/general/posts/${postId}`);
      expect(res.status).toBe(200);
      expect(res.body.post.title).toBe('Test Post');
      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].content).toBe('Nice post!');
    });
  });

  // POST comments

  describe('POST /social/submolts/:slug/posts/:id/comments', () => {
    it('should create comment when authenticated', async () => {
      const postId = 'clpost00000000000000000001';
      const fakePost = { id: postId, deleted: false };
      const fakeComment = {
        id: 'comment-new',
        content: 'Great post!',
        postId,
        authorId: humanUser.id,
        parentId: null,
      };

      mockPrisma.post.findUnique.mockResolvedValue(fakePost);
      mockPrisma.comment.create.mockResolvedValue(fakeComment);
      mockPrisma.post.update.mockResolvedValue({});

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/social/submolts/general/posts/${postId}/comments`, {
        body: { content: 'Great post!' },
        headers,
      });
      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Great post!');
    });
  });

  // POST vote

  describe('POST /social/submolts/:slug/posts/:id/vote', () => {
    it('should toggle upvote/downvote', async () => {
      const postId = 'clpost00000000000000000001';
      const fakePost = { id: postId, deleted: false };
      const updatedPost = { id: postId, upvotes: 5, downvotes: 1 };

      mockPrisma.post.findUnique.mockResolvedValue(fakePost);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          vote: {
            upsert: vi.fn().mockResolvedValue({}),
            count: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(1),
          },
          post: {
            update: vi.fn().mockResolvedValue(updatedPost),
          },
        };
        return fn(mockTx);
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', `/social/submolts/general/posts/${postId}/vote`, {
        body: { value: 1 },
        headers,
      });
      expect(res.status).toBe(200);
      expect(res.body.upvotes).toBe(5);
      expect(res.body.downvotes).toBe(1);
      expect(res.body.userVote).toBe(1);
    });
  });

  // POST /social/heartbeat

  describe('POST /social/heartbeat', () => {
    it('should return activity data when authenticated', async () => {
      const now = new Date();
      mockPrisma.game.findMany
        .mockResolvedValueOnce([
          { id: 'g1', name: 'Game1', totalPlays: 100, totalRevenue: BigInt(0) },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.notification.count.mockResolvedValue(3);
      mockPrisma.post.count.mockResolvedValue(12);
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.heartbeatLog.create.mockResolvedValue({
        id: 'hb-001',
        createdAt: now,
      });

      const headers = authHeaderFor(humanUser.id, humanUser.walletAddress);
      const res = await request(app, 'POST', '/social/heartbeat', {
        body: {},
        headers,
      });
      expect(res.status).toBe(200);
      expect(res.body.playerId).toBe(humanUser.id);
      expect(res.body.newNotifications).toBe(3);
      expect(res.body.submoltActivity).toBe(12);
      expect(res.body.trendingGames).toHaveLength(1);
    });

    it('should require authentication', async () => {
      const res = await request(app, 'POST', '/social/heartbeat', { body: {} });
      expect(res.status).toBe(401);
    });
  });
});

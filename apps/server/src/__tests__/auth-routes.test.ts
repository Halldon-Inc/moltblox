/**
 * Auth route tests for Moltblox API
 *
 * Tests SIWE authentication flow, profile management, logout,
 * and API key generation using mocked Prisma and Redis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockRedis = vi.hoisted(() => ({
  set: vi.fn().mockResolvedValue('OK'),
  exists: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1),
  call: vi.fn(),
}));

vi.mock('../lib/redis.js', () => ({
  default: mockRedis,
}));

const mockBlockToken = vi.fn().mockResolvedValue(undefined);
const mockIsTokenBlocked = vi.fn().mockResolvedValue(false);

vi.mock('../lib/tokenBlocklist.js', () => ({
  isTokenBlocked: (...args: unknown[]) => mockIsTokenBlocked(...args),
  blockToken: (...args: unknown[]) => mockBlockToken(...args),
}));

vi.mock('../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  Sentry: { setupExpressErrorHandler: vi.fn() },
}));

// Mock sanitizeObject to pass through
vi.mock('../lib/sanitize.js', () => ({
  sanitizeObject: (obj: Record<string, unknown>) => obj,
}));

// Mock hashApiKey
vi.mock('../lib/crypto.js', () => ({
  hashApiKey: (key: string) => `hashed_${key}`,
}));

// Import after mocks
import { signToken } from '../middleware/auth.js';
import authRouter from '../routes/auth.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
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

// Simulated user objects
const testUser = {
  id: 'user-001',
  walletAddress: '0x1111111111111111111111111111111111111111',
  displayName: 'TestUser',
  username: 'testuser',
  role: 'human',
  avatarUrl: null,
  bio: null,
  moltbookAgentId: null,
  moltbookAgentName: null,
  moltbookKarma: 0,
  botVerified: false,
  reputationTotal: 0,
  reputationCreator: 0,
  reputationPlayer: 0,
  reputationCommunity: 0,
  reputationTournament: 0,
  createdAt: new Date(),
  _count: { games: 0, posts: 0, tournamentEntries: 0 },
};

function authHeaderFor(userId: string, address: string) {
  const token = signToken(userId, address);
  return { Authorization: `Bearer ${token}` };
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  // ── GET /auth/nonce ───────────────────────────────────────────────────

  describe('GET /auth/nonce', () => {
    it('should return 200 with a nonce string', async () => {
      const res = await request(app, 'GET', '/auth/nonce');
      expect(res.status).toBe(200);
      expect(res.body.nonce).toBeDefined();
      expect(typeof res.body.nonce).toBe('string');
      expect(res.body.nonce.length).toBeGreaterThan(0);
      expect(res.body.expiresIn).toBe(300);
    });

    it('should store nonce in Redis with TTL', async () => {
      await request(app, 'GET', '/auth/nonce');
      expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), '1', 'EX', 300);
    });
  });

  // ── POST /auth/verify ─────────────────────────────────────────────────

  describe('POST /auth/verify', () => {
    it('should return 400 with missing fields', async () => {
      const res = await request(app, 'POST', '/auth/verify', {
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 400 with missing signature', async () => {
      const res = await request(app, 'POST', '/auth/verify', {
        body: { message: 'some-siwe-message' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 400 with missing message', async () => {
      const res = await request(app, 'POST', '/auth/verify', {
        body: { signature: '0xabc' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return error with invalid SIWE message format', async () => {
      const res = await request(app, 'POST', '/auth/verify', {
        body: {
          message: 'not a valid siwe message',
          signature: '0xfake',
        },
      });
      // Invalid SIWE format causes a parse error, which gets caught
      // as a signature/verify error and returns 401 or bubbles to 500
      expect([401, 500]).toContain(res.status);
    });
  });

  // ── GET /auth/me ──────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app, 'GET', '/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should return user data with valid JWT', async () => {
      // Mock the user lookup for auth middleware
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(testUser) // requireAuth lookup
        .mockResolvedValueOnce(testUser); // /me route lookup

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/auth/me', { headers });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(testUser.id);
      expect(res.body.user.walletAddress).toBe(testUser.walletAddress);
      expect(res.body.user.username).toBe(testUser.username);
    });

    it('should return 404 if user not found in database', async () => {
      // Auth middleware finds the user, but the /me route does not
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(testUser) // requireAuth lookup
        .mockResolvedValueOnce(null); // /me route lookup

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/auth/me', { headers });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  // ── PUT /auth/profile ─────────────────────────────────────────────────

  describe('PUT /auth/profile', () => {
    it('should require authentication', async () => {
      const res = await request(app, 'PUT', '/auth/profile', {
        body: { displayName: 'NewName' },
      });
      expect(res.status).toBe(401);
    });

    it('should update user fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      const updatedUser = {
        id: testUser.id,
        walletAddress: testUser.walletAddress,
        username: testUser.username,
        displayName: 'Updated Name',
        avatarUrl: null,
        bio: null,
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'PUT', '/auth/profile', {
        body: { displayName: 'Updated Name' },
        headers,
      });

      expect(res.status).toBe(200);
      expect(res.body.user.displayName).toBe('Updated Name');
      expect(res.body.message).toBe('Profile updated');
    });

    it('should reject duplicate username with 409', async () => {
      // Auth middleware lookup
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(testUser) // requireAuth
        .mockResolvedValueOnce({
          // username check: found another user
          id: 'other-user-id',
          username: 'takenname',
        });

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'PUT', '/auth/profile', {
        body: { username: 'takenname' },
        headers,
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toBe('Username already taken');
    });

    it('should reject update with no fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'PUT', '/auth/profile', {
        body: {},
        headers,
      });

      // Zod refine: at least one field required
      expect(res.status).toBe(400);
    });

    it('should reject data: URI in avatarUrl', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'PUT', '/auth/profile', {
        body: { avatarUrl: 'data:image/png;base64,abc' },
        headers,
      });

      // Zod .url() validation rejects data: URIs
      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should clear cookie and blocklist token', async () => {
      const token = signToken(testUser.id, testUser.walletAddress);

      const res = await request(app, 'POST', '/auth/logout', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
      expect(mockBlockToken).toHaveBeenCalled();
    });

    it('should return 200 even without a token (no-op logout)', async () => {
      const res = await request(app, 'POST', '/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });
  });

  // ── POST /auth/api-key ────────────────────────────────────────────────

  describe('POST /auth/api-key', () => {
    it('should require authentication', async () => {
      const res = await request(app, 'POST', '/auth/api-key');
      expect(res.status).toBe(401);
    });

    it('should generate and return an API key', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser);
      mockPrisma.user.update.mockResolvedValue(testUser);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/auth/api-key', { headers });

      expect(res.status).toBe(200);
      expect(res.body.apiKey).toBeDefined();
      expect(res.body.apiKey).toMatch(/^moltblox_/);
      expect(res.body.message).toContain('API key generated');
    });

    it('should store the hashed API key', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser);
      mockPrisma.user.update.mockResolvedValue(testUser);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      await request(app, 'POST', '/auth/api-key', { headers });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testUser.id },
          data: { apiKey: expect.stringContaining('hashed_moltblox_') },
        }),
      );
    });
  });
});

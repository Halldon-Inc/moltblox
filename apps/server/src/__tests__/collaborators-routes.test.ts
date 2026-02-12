/**
 * Collaborator route handler tests for Moltblox API.
 *
 * Tests adding, removing, and listing game collaborators.
 * The collaborators router is mounted at /games (same prefix as games router)
 * with paths like /:gameId/collaborators.
 *
 * Prisma and other external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import http from 'http';

const mockPrisma = vi.hoisted(() => ({
  game: {
    findUnique: vi.fn(),
  },
  gameCollaborator: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
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

import { signToken } from '../middleware/auth.js';
import collaboratorRoutes from '../routes/collaborators.js';

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
  id: 'clbotuser000000000000001',
  walletAddress: '0x1111111111111111111111111111111111111111',
  displayName: 'TestBot',
  username: 'testbot',
  role: 'bot',
};

const otherBotUser = {
  id: 'clbotuser000000000000002',
  walletAddress: '0x3333333333333333333333333333333333333333',
  displayName: 'OtherBot',
  username: 'otherbot',
  role: 'bot',
};

const targetUser = {
  id: 'cltargetuser0000000000001',
  username: 'targetuser',
  displayName: 'Target User',
};

function authHeaderFor(userId: string, address: string) {
  const token = signToken(userId, address);
  return { Authorization: `Bearer ${token}` };
}

const validGameId = 'clgame0000000000000000001';

// Tests

describe('Collaborator Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp('/games', collaboratorRoutes);
  });

  // GET /games/:gameId/collaborators

  describe('GET /games/:gameId/collaborators', () => {
    it('should list collaborators for a game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: validGameId });
      mockPrisma.gameCollaborator.findMany.mockResolvedValue([
        {
          id: 'collab-001',
          gameId: validGameId,
          userId: targetUser.id,
          role: 'contributor',
          user: {
            id: targetUser.id,
            username: targetUser.username,
            displayName: targetUser.displayName,
            walletAddress: '0x444',
            role: 'bot',
          },
        },
      ]);

      const res = await request(app, 'GET', `/games/${validGameId}/collaborators`);
      expect(res.status).toBe(200);
      expect(res.body.gameId).toBe(validGameId);
      expect(res.body.collaborators).toHaveLength(1);
      expect(res.body.collaborators[0].user.username).toBe('targetuser');
    });

    it('should return 404 for non-existent game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', `/games/${validGameId}/collaborators`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  // POST /games/:gameId/collaborators

  describe('POST /games/:gameId/collaborators', () => {
    it('should add a collaborator as game owner', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(botUser) // auth middleware lookup
        .mockResolvedValueOnce(targetUser); // target user lookup

      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        creatorId: botUser.id,
      });
      mockPrisma.gameCollaborator.findUnique.mockResolvedValue(null);
      mockPrisma.gameCollaborator.create.mockResolvedValue({
        id: 'collab-new',
        gameId: validGameId,
        userId: targetUser.id,
        role: 'contributor',
        canEditCode: false,
        canEditMeta: true,
        canCreateItems: false,
        canPublish: false,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          walletAddress: '0x444',
          role: 'bot',
        },
      });

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', `/games/${validGameId}/collaborators`, {
        body: { userId: targetUser.id, role: 'contributor' },
        headers,
      });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Collaborator added successfully');
    });

    it('should reject adding self as collaborator', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(botUser);
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        creatorId: botUser.id,
      });

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(app, 'POST', `/games/${validGameId}/collaborators`, {
        body: { userId: botUser.id, role: 'contributor' },
        headers,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cannot add yourself as a collaborator');
    });

    it('should require game owner for adding collaborators', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(otherBotUser);
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        creatorId: botUser.id, // different from otherBotUser
      });

      const headers = authHeaderFor(otherBotUser.id, otherBotUser.walletAddress);
      const res = await request(app, 'POST', `/games/${validGameId}/collaborators`, {
        body: { userId: targetUser.id, role: 'contributor' },
        headers,
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should require authentication', async () => {
      const res = await request(app, 'POST', `/games/${validGameId}/collaborators`, {
        body: { userId: targetUser.id },
      });
      expect(res.status).toBe(401);
    });
  });

  // DELETE /games/:gameId/collaborators/:userId

  describe('DELETE /games/:gameId/collaborators/:userId', () => {
    it('should remove a collaborator as game owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(botUser);
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        creatorId: botUser.id,
      });
      mockPrisma.gameCollaborator.findUnique.mockResolvedValue({
        id: 'collab-001',
        gameId: validGameId,
        userId: targetUser.id,
      });
      mockPrisma.gameCollaborator.delete.mockResolvedValue({});

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(
        app,
        'DELETE',
        `/games/${validGameId}/collaborators/${targetUser.id}`,
        { headers },
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Collaborator removed successfully');
    });

    it('should require game owner for removing collaborators', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(otherBotUser);
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        creatorId: botUser.id,
      });

      const headers = authHeaderFor(otherBotUser.id, otherBotUser.walletAddress);
      const res = await request(
        app,
        'DELETE',
        `/games/${validGameId}/collaborators/${targetUser.id}`,
        { headers },
      );
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent collaborator', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(botUser);
      mockPrisma.game.findUnique.mockResolvedValue({
        id: validGameId,
        creatorId: botUser.id,
      });
      mockPrisma.gameCollaborator.findUnique.mockResolvedValue(null);

      const headers = authHeaderFor(botUser.id, botUser.walletAddress);
      const res = await request(
        app,
        'DELETE',
        `/games/${validGameId}/collaborators/${targetUser.id}`,
        { headers },
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Collaborator not found');
    });
  });
});

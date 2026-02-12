/**
 * Wallet route tests for Moltblox API
 *
 * Tests balance retrieval, transfer creation, and transaction
 * history using mocked Prisma and Redis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  transaction: {
    aggregate: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock('../lib/redis.js', () => ({
  default: {
    set: vi.fn(),
    exists: vi.fn().mockResolvedValue(0),
    call: vi.fn(),
  },
}));

vi.mock('../lib/tokenBlocklist.js', () => ({
  isTokenBlocked: vi.fn().mockResolvedValue(false),
  blockToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  Sentry: { setupExpressErrorHandler: vi.fn() },
}));

vi.mock('../lib/crypto.js', () => ({
  hashApiKey: (key: string) => `hashed_${key}`,
}));

// Import after mocks
import { signToken } from '../middleware/auth.js';
import walletRouter from '../routes/wallet.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/wallet', walletRouter);
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

// Simulated user
const testUser = {
  id: 'user-001',
  walletAddress: '0x1111111111111111111111111111111111111111',
  displayName: 'TestUser',
  username: 'testuser',
  role: 'human',
};

function authHeaderFor(userId: string, address: string) {
  const token = signToken(userId, address);
  return { Authorization: `Bearer ${token}` };
}

// ════════════════════════════════════════════════════════════════════════════
// WALLET ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe('Wallet Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();

    // Default user lookup for auth middleware
    mockPrisma.user.findUnique.mockResolvedValue(testUser);
  });

  // ── GET /wallet ───────────────────────────────────────────────────────

  describe('GET /wallet', () => {
    it('should require authentication', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', '/wallet');
      expect(res.status).toBe(401);
    });

    it('should return balance, earnings, and spending', async () => {
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: BigInt(5000) } }) // sale
        .mockResolvedValueOnce({ _sum: { amount: BigInt(2000) } }) // tournament_prize
        .mockResolvedValueOnce({ _sum: { amount: BigInt(1000) } }) // purchase
        .mockResolvedValueOnce({ _sum: { amount: BigInt(500) } }); // tournament_entry

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet', { headers });

      expect(res.status).toBe(200);
      expect(res.body.playerId).toBe(testUser.id);
      expect(res.body.currency).toBe('MBUCKS');

      // balance = (5000 + 2000) - (1000 + 500) = 5500
      expect(res.body.balance).toBe('5500');

      expect(res.body.earnings.total).toBe('7000');
      expect(res.body.earnings.sales).toBe('5000');
      expect(res.body.earnings.tournamentPrizes).toBe('2000');

      expect(res.body.spending.total).toBe('1500');
      expect(res.body.spending.purchases).toBe('1000');
      expect(res.body.spending.tournamentEntries).toBe('500');
    });

    it('should handle zero balances (null aggregates)', async () => {
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet', { headers });

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe('0');
      expect(res.body.earnings.total).toBe('0');
      expect(res.body.spending.total).toBe('0');
    });
  });

  // ── GET /wallet/balance ───────────────────────────────────────────────

  describe('GET /wallet/balance', () => {
    it('should require authentication', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', '/wallet/balance');
      expect(res.status).toBe(401);
    });

    it('should return formatted balance metadata', async () => {
      const lastTx = { createdAt: new Date('2025-06-01T12:00:00Z') };
      mockPrisma.transaction.findFirst.mockResolvedValue(lastTx);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet/balance', { headers });

      expect(res.status).toBe(200);
      expect(res.body.playerId).toBe(testUser.id);
      expect(res.body.address).toBe(testUser.walletAddress);
      expect(res.body.currency).toBe('MBUCKS');
      expect(res.body.decimals).toBe(18);
      expect(res.body.lastTransactionAt).toBeDefined();
    });

    it('should return null lastTransactionAt when no transactions exist', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet/balance', { headers });

      expect(res.status).toBe(200);
      expect(res.body.lastTransactionAt).toBeNull();
    });
  });

  // ── POST /wallet/transfer ─────────────────────────────────────────────

  describe('POST /wallet/transfer', () => {
    const validTransferBody = {
      to: '0x2222222222222222222222222222222222222222',
      amount: '1000000000000000000',
    };

    it('should require authentication', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app, 'POST', '/wallet/transfer', {
        body: validTransferBody,
      });
      expect(res.status).toBe(401);
    });

    it('should create a transaction record for valid transfer', async () => {
      const outgoingTx = {
        id: 'tx-001',
        userId: testUser.id,
        type: 'transfer_out',
        amount: BigInt(1000000000000000000),
        counterparty: validTransferBody.to,
        createdAt: new Date(),
      };

      mockPrisma.$transaction.mockResolvedValue({
        outgoingTx,
        recipientFound: true,
      });

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: validTransferBody,
        headers,
      });

      expect(res.status).toBe(200);
      expect(res.body.transfer).toBeDefined();
      expect(res.body.transfer.from).toBe(testUser.walletAddress);
      expect(res.body.transfer.to).toBe(validTransferBody.to);
      expect(res.body.transfer.amount).toBe('1000000000000000000');
      expect(res.body.transfer.status).toBe('pending_onchain');
    });

    it('should reject zero amount', async () => {
      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: { to: validTransferBody.to, amount: '0' },
        headers,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should reject negative amount (non-numeric string)', async () => {
      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: { to: validTransferBody.to, amount: '-100' },
        headers,
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid address format', async () => {
      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: { to: 'not-an-address', amount: '1000' },
        headers,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should reject self-transfer', async () => {
      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: { to: testUser.walletAddress, amount: '1000' },
        headers,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cannot transfer to yourself');
    });

    it('should reject missing to field', async () => {
      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: { amount: '1000' },
        headers,
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing amount field', async () => {
      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'POST', '/wallet/transfer', {
        body: { to: validTransferBody.to },
        headers,
      });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /wallet/transactions ──────────────────────────────────────────

  describe('GET /wallet/transactions', () => {
    it('should require authentication', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app, 'GET', '/wallet/transactions');
      expect(res.status).toBe(401);
    });

    it('should return a paginated transaction list', async () => {
      const fakeTransactions = [
        {
          id: 'tx-001',
          type: 'sale',
          amount: BigInt(5000),
          description: 'Sold item',
          txHash: '0xhash1',
          blockNumber: 12345,
          itemId: 'item-001',
          tournamentId: null,
          counterparty: '0xabc',
          createdAt: new Date(),
        },
        {
          id: 'tx-002',
          type: 'purchase',
          amount: BigInt(1000),
          description: 'Bought item',
          txHash: null,
          blockNumber: null,
          itemId: 'item-002',
          tournamentId: null,
          counterparty: '0xdef',
          createdAt: new Date(),
        },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(fakeTransactions);
      mockPrisma.transaction.count.mockResolvedValue(2);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet/transactions', { headers });

      expect(res.status).toBe(200);
      expect(res.body.playerId).toBe(testUser.id);
      expect(res.body.transactions).toHaveLength(2);
      expect(res.body.transactions[0].amount).toBe('5000');
      expect(res.body.transactions[1].amount).toBe('1000');
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    it('should respect limit and offset query params', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(50);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet/transactions?limit=10&offset=5', { headers });

      expect(res.status).toBe(200);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.offset).toBe(5);
      expect(res.body.pagination.hasMore).toBe(true);
    });

    it('should cap limit at 100', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      await request(app, 'GET', '/wallet/transactions?limit=999', { headers });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should return empty list when no transactions exist', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const headers = authHeaderFor(testUser.id, testUser.walletAddress);
      const res = await request(app, 'GET', '/wallet/transactions', { headers });

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
      expect(res.body.pagination.hasMore).toBe(false);
    });
  });
});

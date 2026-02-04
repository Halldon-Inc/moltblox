/**
 * Wallet routes for Moltblox API
 * MOLT token balance, transfers, and transaction history
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All wallet routes require authentication
router.use(requireAuth);

/**
 * GET /wallet - Get wallet info
 */
router.get('/', (req: Request, res: Response) => {
  const user = req.user!;

  res.json({
    playerId: user.id,
    address: user.address,
    balance: '125500000000000000000', // 125.5 MOLT
    currency: 'MOLT',
    network: 'base-sepolia',
    connected: true,
    earnings: {
      total: '85000000000000000000', // 85 MOLT
      gameRevenue: '45000000000000000000', // 45 MOLT
      tournamentPrizes: '30000000000000000000', // 30 MOLT
      other: '10000000000000000000', // 10 MOLT
    },
    spent: {
      total: '34500000000000000000', // 34.5 MOLT
      itemPurchases: '24500000000000000000', // 24.5 MOLT
      tournamentEntries: '10000000000000000000', // 10 MOLT
    },
  });
});

/**
 * GET /wallet/balance - Get MOLT balance
 */
router.get('/balance', (req: Request, res: Response) => {
  const user = req.user!;

  res.json({
    playerId: user.id,
    address: user.address,
    balance: '125500000000000000000', // 125.5 MOLT
    formattedBalance: '125.5',
    currency: 'MOLT',
    decimals: 18,
    lastUpdated: new Date().toISOString(),
  });
});

/**
 * POST /wallet/transfer - Transfer MOLT (auth required)
 */
router.post('/transfer', (req: Request, res: Response) => {
  const user = req.user!;

  const amount = req.body.amount || '1000000000000000000'; // 1 MOLT default
  const to = req.body.to || '0x0000000000000000000000000000000000000000';

  res.json({
    transfer: {
      id: 'transfer-001',
      from: user.address,
      to,
      amount,
      formattedAmount: '1.0',
      currency: 'MOLT',
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      blockNumber: 12345679,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
    },
    newBalance: '124500000000000000000', // 124.5 MOLT
    message: 'Transfer successful',
  });
});

/**
 * GET /wallet/transactions - Get transaction history
 */
router.get('/transactions', (req: Request, res: Response) => {
  const user = req.user!;

  res.json({
    playerId: user.id,
    transactions: [
      {
        id: 'tx-001',
        type: 'earning',
        subtype: 'game_revenue',
        amount: '1700000000000000000', // 1.7 MOLT (85% of 2 MOLT sale)
        formattedAmount: '+1.7',
        currency: 'MOLT',
        description: 'Item sale: Golden Block Skin',
        gameId: 'game-002',
        txHash: '0xaaa111bbb222ccc333ddd444eee555fff666aaa777bbb888ccc999ddd000eee1',
        blockNumber: 12345670,
        timestamp: '2025-03-02T12:00:00Z',
      },
      {
        id: 'tx-002',
        type: 'spending',
        subtype: 'item_purchase',
        amount: '300000000000000000', // 0.3 MOLT
        formattedAmount: '-0.3',
        currency: 'MOLT',
        description: 'Purchased: Speed Boost Pack x5',
        gameId: 'game-001',
        txHash: '0xbbb222ccc333ddd444eee555fff666aaa777bbb888ccc999ddd000eee111fff2',
        blockNumber: 12345665,
        timestamp: '2025-03-01T09:00:00Z',
      },
      {
        id: 'tx-003',
        type: 'earning',
        subtype: 'tournament_prize',
        amount: '12500000000000000000', // 12.5 MOLT
        formattedAmount: '+12.5',
        currency: 'MOLT',
        description: 'Tournament prize: 1st place - Molt Runner Speed Tournament',
        tournamentId: 'tourney-003',
        txHash: '0xccc333ddd444eee555fff666aaa777bbb888ccc999ddd000eee111fff222aaa3',
        blockNumber: 12345660,
        timestamp: '2025-02-15T18:30:00Z',
      },
      {
        id: 'tx-004',
        type: 'spending',
        subtype: 'tournament_entry',
        amount: '500000000000000000', // 0.5 MOLT
        formattedAmount: '-0.5',
        currency: 'MOLT',
        description: 'Tournament entry fee: Molt Runner Speed Tournament',
        tournamentId: 'tourney-003',
        txHash: '0xddd444eee555fff666aaa777bbb888ccc999ddd000eee111fff222aaa333bbb4',
        blockNumber: 12345650,
        timestamp: '2025-02-14T08:00:00Z',
      },
    ],
    pagination: {
      total: 4,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  });
});

export default router;

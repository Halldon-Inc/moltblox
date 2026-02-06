/**
 * Wallet routes for Moltblox API
 * MOLT token balance, transfers, and transaction history
 * Uses Prisma for all database operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { transferSchema, transactionsQuerySchema } from '../schemas/wallet.js';

const router: Router = Router();

// All wallet routes require authentication
router.use(requireAuth);

/**
 * GET /wallet - Get wallet overview
 * Aggregates transactions by type to calculate earnings and spending.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // Aggregate earnings: sale + tournament_prize
    const [saleAggregate, tournamentPrizeAggregate, purchaseAggregate, tournamentEntryAggregate] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: { userId: user.id, type: 'sale' },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: 'tournament_prize' },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: 'purchase' },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: 'tournament_entry' },
          _sum: { amount: true },
        }),
      ]);

    const saleEarnings = saleAggregate._sum.amount ?? 0n;
    const tournamentPrizes = tournamentPrizeAggregate._sum.amount ?? 0n;
    const totalEarnings = BigInt(saleEarnings) + BigInt(tournamentPrizes);

    const purchaseSpending = purchaseAggregate._sum.amount ?? 0n;
    const tournamentEntries = tournamentEntryAggregate._sum.amount ?? 0n;
    const totalSpending = BigInt(purchaseSpending) + BigInt(tournamentEntries);

    res.json({
      playerId: user.id,
      address: user.address,
      currency: 'MOLT',
      network: 'base-sepolia',
      balanceNote:
        'On-chain balance is read from the MOLT token contract. This endpoint provides transaction-based summaries only.',
      earnings: {
        total: totalEarnings.toString(),
        sales: saleEarnings.toString(),
        tournamentPrizes: tournamentPrizes.toString(),
      },
      spending: {
        total: totalSpending.toString(),
        purchases: purchaseSpending.toString(),
        tournamentEntries: tournamentEntries.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /wallet/balance - Get MOLT balance info
 * Real balance comes from on-chain query; this returns the user address
 * and last known transaction timestamp.
 */
router.get('/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    const lastTransaction = await prisma.transaction.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    res.json({
      playerId: user.id,
      address: user.address,
      currency: 'MOLT',
      decimals: 18,
      balanceNote:
        'Query the MOLT token contract on-chain for the real-time balance. This endpoint provides metadata only.',
      lastTransactionAt: lastTransaction?.createdAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /wallet/transfer - Record a MOLT transfer intent
 * Creates transaction records for sender (transfer_out) and receiver (transfer_in).
 * NOTE: This is a record-keeping endpoint. The actual on-chain MOLT token
 * transfer must be executed separately by the client via the smart contract.
 * Required body: to (address), amount (string, wei)
 */
router.post(
  '/transfer',
  validate(transferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { to, amount } = req.body;

      if (!to) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: to (recipient address)',
        });
        return;
      }

      if (!amount) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: amount',
        });
        return;
      }

      // Prevent self-transfer
      if (to.toLowerCase() === user.address.toLowerCase()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot transfer to yourself',
        });
        return;
      }

      let transferAmount: bigint;
      try {
        transferAmount = BigInt(amount);
        if (transferAmount <= 0n) {
          res.status(400).json({ error: 'Bad Request', message: 'Amount must be positive' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Bad Request', message: 'Invalid amount format' });
        return;
      }

      // Record outgoing transaction for sender
      const outgoingTx = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'transfer_out',
          amount: transferAmount,
          counterparty: to,
          description: `Transfer to ${to}`,
        },
      });

      // If the recipient exists in the database, record an incoming transaction for them
      const recipient = await prisma.user.findUnique({
        where: { walletAddress: to },
        select: { id: true },
      });

      if (recipient) {
        await prisma.transaction.create({
          data: {
            userId: recipient.id,
            type: 'transfer_in',
            amount: transferAmount,
            counterparty: user.address,
            description: `Transfer from ${user.address}`,
          },
        });
      }

      res.json({
        transfer: {
          id: outgoingTx.id,
          from: user.address,
          to,
          amount: transferAmount.toString(),
          currency: 'MOLT',
          status: 'recorded',
          recipientFound: !!recipient,
          createdAt: outgoingTx.createdAt,
        },
        message:
          'Transfer recorded. Execute the on-chain MOLT token transfer separately to complete.',
        note: 'This endpoint records the intent to transfer. The actual token transfer must be executed on-chain via the MOLT token contract.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /wallet/transactions - Get transaction history
 * Query params: limit (default 20), offset (default 0)
 * Ordered by createdAt desc. Amounts serialized as strings.
 */
router.get(
  '/transactions',
  validate(transactionsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;

      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.transaction.count({
          where: { userId: user.id },
        }),
      ]);

      const serializedTransactions = transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        currency: 'MOLT',
        description: tx.description,
        txHash: tx.txHash,
        blockNumber: tx.blockNumber,
        itemId: tx.itemId,
        tournamentId: tx.tournamentId,
        counterparty: tx.counterparty,
        createdAt: tx.createdAt,
      }));

      res.json({
        playerId: user.id,
        transactions: serializedTransactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

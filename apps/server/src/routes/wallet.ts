/**
 * Wallet routes for Moltblox API
 * Moltbucks token balance, transfers, and transaction history
 * Uses Prisma for all database operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { transferSchema, transactionsQuerySchema } from '../schemas/wallet.js';
import { parseBigInt, ParseBigIntError } from '../lib/parseBigInt.js';

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
    const totalEarnings = saleEarnings + tournamentPrizes;

    const purchaseSpending = purchaseAggregate._sum.amount ?? 0n;
    const tournamentEntries = tournamentEntryAggregate._sum.amount ?? 0n;
    const totalSpending = purchaseSpending + tournamentEntries;

    res.json({
      playerId: user.id,
      address: user.address,
      currency: 'MBUCKS',
      network: 'base-sepolia',
      balanceNote:
        'On-chain balance is read from the Moltbucks token contract. This endpoint provides transaction-based summaries only.',
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
 * GET /wallet/balance - Get Moltbucks balance info
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
      currency: 'MBUCKS',
      decimals: 18,
      balanceNote:
        'Query the Moltbucks token contract on-chain for the real-time balance. This endpoint provides metadata only.',
      lastTransactionAt: lastTransaction?.createdAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /wallet/transfer - Record a Moltbucks transfer intent
 * Creates transaction records for sender (transfer_out) and receiver (transfer_in).
 * NOTE: This is a record-keeping endpoint. The actual on-chain Moltbucks token
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
        transferAmount = parseBigInt(amount, 'amount');
      } catch (err) {
        if (err instanceof ParseBigIntError) {
          res.status(400).json({ error: 'Bad Request', message: err.message });
          return;
        }
        throw err;
      }

      // Wrap both records in a transaction for atomicity
      const { outgoingTx, recipientFound } = await prisma.$transaction(async (tx) => {
        // Record outgoing transaction for sender
        const outgoing = await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'transfer_out',
            amount: transferAmount,
            counterparty: to,
            description: `Transfer to ${to}`,
          },
        });

        // If the recipient exists in the database, record an incoming transaction for them
        const recipient = await tx.user.findUnique({
          where: { walletAddress: to },
          select: { id: true },
        });

        if (recipient) {
          await tx.transaction.create({
            data: {
              userId: recipient.id,
              type: 'transfer_in',
              amount: transferAmount,
              counterparty: user.address,
              description: `Transfer from ${user.address}`,
            },
          });
        }

        return { outgoingTx: outgoing, recipientFound: !!recipient };
      });

      res.json({
        transfer: {
          id: outgoingTx.id,
          from: user.address,
          to,
          amount: transferAmount.toString(),
          currency: 'MBUCKS',
          status: 'pending_onchain',
          recipientFound,
          createdAt: outgoingTx.createdAt,
        },
        message:
          'Transfer recorded. Execute the on-chain Moltbucks token transfer separately to complete.',
        note: 'This endpoint records the intent to transfer. The actual token transfer must be executed on-chain via the Moltbucks token contract. Clients should verify on-chain execution before considering the transfer final.',
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
        currency: 'MBUCKS',
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

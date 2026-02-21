/**
 * Wager routes for Moltblox API
 *
 * Handles 1v1 wagers between players with spectator betting and odds.
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createWagerSchema,
  wagerIdParamSchema,
  acceptWagerSchema,
  settleWagerSchema,
  disputeWagerSchema,
  spectatorBetSchema,
  listWagersSchema,
  listSpectatorBetsSchema,
} from '../schemas/wagers.js';
import type { Prisma, WagerStatus } from '../generated/prisma/client.js';
import { mbucksToWei } from '../lib/parseBigInt.js';
import { serializeBigIntFields } from '../lib/serialize.js';
import { AppError } from '../middleware/errorHandler.js';

/** Maximum wager amount in MBUCKS */
const MAX_WAGER_MBUCKS = 10_000;
const MAX_WAGER_WEI = BigInt(MAX_WAGER_MBUCKS) * 10n ** 18n;

const router: Router = Router();

/**
 * Check if a Prisma error indicates missing wager tables (migration not applied).
 * Returns true if the error should be converted to a 503 response.
 */
function isWagerMigrationError(err: unknown): boolean {
  const code = (err as Record<string, unknown>).code;
  // P2021 = table does not exist, P2010 = raw query failed
  // P2003 = foreign key constraint (could indicate missing tables)
  return code === 'P2021' || code === 'P2010';
}

function handleWagerDbError(err: unknown, res: Response, operation: string): boolean {
  if (isWagerMigrationError(err)) {
    const code = (err as Record<string, unknown>).code;
    console.error(`[WAGER_${operation}] Migration error code=${code}`);
    res.status(503).json({
      error: 'ServiceUnavailable',
      message: 'Wager tables not yet created. Database migration may be pending.',
    });
    return true;
  }
  return false;
}

/**
 * Serialize BigInt fields on a wager to strings for JSON output.
 */
function serializeWager(wager: Record<string, unknown>) {
  const result = serializeBigIntFields(wager, ['stakeAmount']);

  if (Array.isArray(result.spectatorBets)) {
    result.spectatorBets = (result.spectatorBets as Record<string, unknown>[]).map((sb) =>
      serializeBigIntFields(sb, ['amount', 'payout']),
    );
  }

  return result;
}

/**
 * POST /wagers : Create a new wager
 */
router.post(
  '/',
  requireAuth,
  validate(createWagerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { gameId, stakeAmount, opponentId } = req.body;

      // Verify game exists
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      // Cannot wager against yourself
      if (opponentId && opponentId === user.id) {
        res
          .status(400)
          .json({ error: 'BadRequest', message: 'Cannot create a wager against yourself' });
        return;
      }

      // Verify opponent exists if specified
      if (opponentId) {
        const opponent = await prisma.user.findUnique({
          where: { id: opponentId },
          select: { id: true },
        });
        if (!opponent) {
          res.status(404).json({ error: 'NotFound', message: 'Opponent not found' });
          return;
        }
      }

      const weiAmount = mbucksToWei(stakeAmount);
      if (weiAmount <= 0n) {
        res.status(400).json({ error: 'BadRequest', message: 'Stake amount must be positive' });
        return;
      }

      if (weiAmount > MAX_WAGER_WEI) {
        res
          .status(400)
          .json({ error: 'BadRequest', message: 'Wager amount exceeds maximum allowed' });
        return;
      }

      let wager;
      try {
        wager = await prisma.wager.create({
          data: {
            gameId,
            creatorId: user.id,
            opponentId: opponentId || null,
            stakeAmount: weiAmount,
            status: 'OPEN',
          },
          include: {
            game: {
              select: { id: true, name: true, slug: true },
            },
            creator: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
            opponent: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
          },
        });
      } catch (dbError: unknown) {
        if (handleWagerDbError(dbError, res, 'CREATE')) return;
        throw dbError;
      }

      res.status(201).json({
        ...serializeWager(wager),
        message: 'Wager created successfully',
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'CREATE')) return;
      next(error);
    }
  },
);

/**
 * GET /wagers : List wagers with optional filters
 */
router.get(
  '/',
  optionalAuth,
  validate(listWagersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId, status, page = '1', limit = '20' } = req.query;

      const take = Math.min(parseInt(limit as string, 10) || 20, 50);
      const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
      const skip = (pageNum - 1) * take;

      const where: Prisma.WagerWhereInput = {};
      if (gameId) where.gameId = gameId as string;
      if (status) where.status = status as WagerStatus;

      const [wagers, total] = await Promise.all([
        prisma.wager.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
          include: {
            game: {
              select: { id: true, name: true, slug: true },
            },
            creator: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
            opponent: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
          },
        }),
        prisma.wager.count({ where }),
      ]);

      // M9: Redact walletAddress for unauthenticated requests
      const isAuthenticated = !!req.user;
      const serialized = wagers.map((w) => {
        const s = serializeWager(w) as Record<string, unknown>;
        if (!isAuthenticated) {
          const creator = s.creator as Record<string, unknown> | null;
          const opponent = s.opponent as Record<string, unknown> | null;
          if (creator) creator.walletAddress = undefined;
          if (opponent) opponent.walletAddress = undefined;
        }
        return s;
      });

      res.json({
        wagers: serialized,
        pagination: {
          total,
          page: pageNum,
          limit: take,
          hasMore: skip + take < total,
        },
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'LIST')) return;
      next(error);
    }
  },
);

/**
 * GET /wagers/:id : Get wager details
 */
router.get(
  '/:id',
  validate(wagerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const wager = await prisma.wager.findUnique({
        where: { id },
        include: {
          game: {
            select: { id: true, name: true, slug: true },
          },
          creator: {
            select: { id: true, username: true, displayName: true, walletAddress: true },
          },
          opponent: {
            select: { id: true, username: true, displayName: true, walletAddress: true },
          },
          spectatorBets: {
            include: {
              bettor: {
                select: { id: true, username: true, displayName: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!wager) {
        res.status(404).json({ error: 'NotFound', message: 'Wager not found' });
        return;
      }

      res.json(serializeWager(wager));
    } catch (error) {
      if (handleWagerDbError(error, res, 'GET')) return;
      next(error);
    }
  },
);

/**
 * POST /wagers/:id/accept : Accept an open wager
 */
router.post(
  '/:id/accept',
  requireAuth,
  validate(acceptWagerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const result = await prisma.$transaction(async (tx) => {
        const wager = await tx.wager.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            creatorId: true,
            opponentId: true,
            stakeAmount: true,
          },
        });

        if (!wager) {
          throw new AppError('Wager not found', 404);
        }

        if (wager.status !== 'OPEN') {
          throw new AppError('Wager is not open for acceptance', 400);
        }

        if (wager.creatorId === user.id) {
          throw new AppError('Cannot accept your own wager', 400);
        }

        // If wager has a specified opponent, only that user can accept
        if (wager.opponentId && wager.opponentId !== user.id) {
          throw new AppError('This wager is reserved for a specific opponent', 403);
        }

        const updated = await tx.wager.update({
          where: { id },
          data: {
            opponentId: user.id,
            status: 'LOCKED',
            acceptedAt: new Date(),
          },
          include: {
            game: {
              select: { id: true, name: true, slug: true },
            },
            creator: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
            opponent: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
          },
        });

        return updated;
      });

      res.json({
        ...serializeWager(result),
        message: 'Wager accepted. Match is now locked.',
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'WAGER_OP')) return;
      next(error);
    }
  },
);

/**
 * POST /wagers/:id/cancel : Cancel a wager (creator only, must be OPEN)
 */
router.post(
  '/:id/cancel',
  requireAuth,
  validate(wagerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const result = await prisma.$transaction(async (tx) => {
        const wager = await tx.wager.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            creatorId: true,
          },
        });

        if (!wager) {
          throw new AppError('Wager not found', 404);
        }

        if (wager.creatorId !== user.id) {
          throw new AppError('Only the wager creator can cancel', 403);
        }

        if (wager.status !== 'OPEN') {
          throw new AppError('Only open wagers can be cancelled', 400);
        }

        const updated = await tx.wager.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        return updated;
      });

      res.json({
        ...serializeWager(result),
        message: 'Wager cancelled successfully',
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'WAGER_OP')) return;
      next(error);
    }
  },
);

/**
 * POST /wagers/:id/settle : Settle a wager (bot/server only)
 */
router.post(
  '/:id/settle',
  requireAuth,
  validate(settleWagerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { winnerId, gameSessionId } = req.body;

      // H11: Verify winner against game session result if provided
      if (gameSessionId) {
        const gameSession = await prisma.gameSession.findUnique({
          where: { id: gameSessionId },
          select: { winnerId: true },
        });
        if (!gameSession) {
          throw new AppError('Game session not found', 404);
        }
        if (gameSession.winnerId !== winnerId) {
          throw new AppError('Winner does not match game session result', 400);
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const wager = await tx.wager.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            creatorId: true,
            opponentId: true,
            stakeAmount: true,
          },
        });

        if (!wager) {
          throw new AppError('Wager not found', 404);
        }

        // H12: Only the wager creator or a bot can settle
        const settlingUser = req.user!;
        if (wager.creatorId !== settlingUser.id && settlingUser.role !== 'bot') {
          throw new AppError('Not authorized to settle this wager', 403);
        }

        if (wager.status !== 'LOCKED') {
          throw new AppError('Only locked wagers can be settled', 400);
        }

        // Winner must be one of the two participants
        if (winnerId !== wager.creatorId && winnerId !== wager.opponentId) {
          throw new AppError('Winner must be a wager participant', 400);
        }

        const updated = await tx.wager.update({
          where: { id },
          data: {
            winnerId,
            status: 'SETTLED',
            settledAt: new Date(),
          },
          include: {
            game: {
              select: { id: true, name: true, slug: true },
            },
            creator: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
            opponent: {
              select: { id: true, username: true, displayName: true, walletAddress: true },
            },
          },
        });

        // Calculate and update spectator bet payouts
        const spectatorBets = await tx.spectatorBet.findMany({
          where: { wagerId: id },
        });

        if (spectatorBets.length > 0) {
          // Total pool of all spectator bets
          let totalPool = 0n;
          let winningPool = 0n;

          for (const bet of spectatorBets) {
            totalPool += bet.amount;
            if (bet.predictedWinner === winnerId) {
              winningPool += bet.amount;
            }
          }

          // Distribute payouts proportionally to winning bettors
          if (winningPool > 0n) {
            for (const bet of spectatorBets) {
              if (bet.predictedWinner === winnerId) {
                // Proportional payout: (bet.amount / winningPool) * totalPool
                const payout = (bet.amount * totalPool) / winningPool;
                await tx.spectatorBet.update({
                  where: { id: bet.id },
                  data: { payout, paid: true },
                });
              } else {
                await tx.spectatorBet.update({
                  where: { id: bet.id },
                  data: { payout: 0n, paid: true },
                });
              }
            }
          } else {
            // All bets were on the loser: mark them as paid with zero payout
            console.log(`[WAGER_SETTLE] Wager ${id}: entire spectator pool lost (no winning bets)`);
            for (const bet of spectatorBets) {
              await tx.spectatorBet.update({
                where: { id: bet.id },
                data: { payout: 0n, paid: true },
              });
            }
          }
        }

        return updated;
      });

      res.json({
        ...serializeWager(result),
        message: 'Wager settled successfully',
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'WAGER_OP')) return;
      next(error);
    }
  },
);

/**
 * POST /wagers/:id/dispute : Dispute a wager settlement (participant only)
 */
router.post(
  '/:id/dispute',
  requireAuth,
  validate(disputeWagerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = req.user!;

      const result = await prisma.$transaction(async (tx) => {
        const wager = await tx.wager.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            creatorId: true,
            opponentId: true,
          },
        });

        if (!wager) {
          throw new AppError('Wager not found', 404);
        }

        // Only participants can dispute
        if (wager.creatorId !== user.id && wager.opponentId !== user.id) {
          throw new AppError('Only wager participants can dispute', 403);
        }

        if (wager.status !== 'LOCKED' && wager.status !== 'SETTLED') {
          throw new AppError('Only locked or settled wagers can be disputed', 400);
        }

        const updated = await tx.wager.update({
          where: { id },
          data: { status: 'DISPUTED' },
        });

        return updated;
      });

      res.json({
        ...serializeWager(result),
        disputeReason: reason,
        message: 'Wager dispute filed',
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'WAGER_OP')) return;
      next(error);
    }
  },
);

/**
 * POST /wagers/:id/spectator-bets : Place a spectator bet on a locked wager
 */
router.post(
  '/:id/spectator-bets',
  requireAuth,
  validate(spectatorBetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { predictedWinnerId, amount } = req.body;
      const user = req.user!;

      const result = await prisma.$transaction(async (tx) => {
        const wager = await tx.wager.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            creatorId: true,
            opponentId: true,
          },
        });

        if (!wager) {
          throw new AppError('Wager not found', 404);
        }

        if (wager.status !== 'LOCKED') {
          throw new AppError('Spectator bets are only allowed on locked wagers', 400);
        }

        // Cannot bet on a wager you are participating in
        if (wager.creatorId === user.id || wager.opponentId === user.id) {
          throw new AppError('Wager participants cannot place spectator bets', 400);
        }

        // Predicted winner must be one of the participants
        if (predictedWinnerId !== wager.creatorId && predictedWinnerId !== wager.opponentId) {
          throw new AppError('Predicted winner must be a wager participant', 400);
        }

        // Prevent betting on both sides of the same wager
        const existingOppositeBet = await tx.spectatorBet.findFirst({
          where: {
            wagerId: id,
            bettorId: user.id,
            predictedWinner: { not: predictedWinnerId },
          },
        });
        if (existingOppositeBet) {
          throw new AppError('Cannot bet on both sides of the same wager', 409);
        }

        const weiAmount = mbucksToWei(amount);
        if (weiAmount <= 0n) {
          throw new AppError('Bet amount must be positive', 400);
        }

        const bet = await tx.spectatorBet.create({
          data: {
            wagerId: id,
            bettorId: user.id,
            predictedWinner: predictedWinnerId,
            amount: weiAmount,
          },
          include: {
            bettor: {
              select: { id: true, username: true, displayName: true },
            },
          },
        });

        return bet;
      });

      res.status(201).json({
        ...result,
        amount: result.amount.toString(),
        payout: result.payout?.toString() ?? null,
        message: 'Spectator bet placed successfully',
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'WAGER_OP')) return;
      next(error);
    }
  },
);

/**
 * GET /wagers/:id/spectator-bets : List spectator bets for a wager
 */
router.get(
  '/:id/spectator-bets',
  validate(listSpectatorBetsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Verify wager exists
      const wager = await prisma.wager.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!wager) {
        res.status(404).json({ error: 'NotFound', message: 'Wager not found' });
        return;
      }

      const bets = await prisma.spectatorBet.findMany({
        where: { wagerId: id },
        include: {
          bettor: {
            select: { id: true, username: true, displayName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        wagerId: id,
        bets: bets.map((b) => ({
          ...b,
          amount: b.amount.toString(),
          payout: b.payout?.toString() ?? null,
        })),
        total: bets.length,
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'SPECTATOR_LIST')) return;
      next(error);
    }
  },
);

/**
 * GET /wagers/:id/odds : Get current betting odds for a wager
 */
router.get(
  '/:id/odds',
  validate(wagerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const wager = await prisma.wager.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          creatorId: true,
          opponentId: true,
          stakeAmount: true,
        },
      });

      if (!wager) {
        res.status(404).json({ error: 'NotFound', message: 'Wager not found' });
        return;
      }

      const bets = await prisma.spectatorBet.findMany({
        where: { wagerId: id },
        select: {
          predictedWinner: true,
          amount: true,
        },
      });

      // Calculate totals for each side
      let totalPool = 0n;
      const sidePool: Record<string, bigint> = {};

      if (wager.creatorId) sidePool[wager.creatorId] = 0n;
      if (wager.opponentId) sidePool[wager.opponentId] = 0n;

      for (const bet of bets) {
        totalPool += bet.amount;
        if (sidePool[bet.predictedWinner] !== undefined) {
          sidePool[bet.predictedWinner] += bet.amount;
        }
      }

      // Calculate implied odds
      // If totalPool is 0, odds are even (1:1)
      const odds: Record<string, { pool: string; percentage: number; impliedOdds: string }> = {};

      for (const [playerId, pool] of Object.entries(sidePool)) {
        const percentage = totalPool > 0n ? Number((pool * 10000n) / totalPool) / 100 : 50;
        const impliedOdds =
          pool > 0n && totalPool > 0n ? (Number(totalPool) / Number(pool)).toFixed(2) : '2.00';

        odds[playerId] = {
          pool: pool.toString(),
          percentage,
          impliedOdds,
        };
      }

      res.json({
        wagerId: id,
        status: wager.status,
        stakeAmount: wager.stakeAmount.toString(),
        totalBetPool: totalPool.toString(),
        totalBets: bets.length,
        odds,
      });
    } catch (error) {
      if (handleWagerDbError(error, res, 'ODDS')) return;
      next(error);
    }
  },
);

export default router;

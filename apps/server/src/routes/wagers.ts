/**
 * Wager routes for Moltblox API
 *
 * Handles 1v1 wagers between players with spectator betting and odds.
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireBot } from '../middleware/auth.js';
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

const router: Router = Router();

/**
 * Convert MBUCKS human-readable string to wei (18 decimals).
 * Example: "2.5" => 2500000000000000000n
 */
function mbucksToWei(mbucks: string): bigint {
  const parts = mbucks.split('.');
  const whole = parts[0] || '0';
  let fraction = parts[1] || '';
  // Pad or truncate fraction to 18 decimal places
  if (fraction.length > 18) {
    fraction = fraction.slice(0, 18);
  } else {
    fraction = fraction.padEnd(18, '0');
  }
  return BigInt(whole + fraction);
}

/**
 * Serialize BigInt fields on a wager to strings for JSON output.
 */
function serializeWager(wager: {
  stakeAmount?: bigint | null;
  spectatorBets?: Array<{
    amount?: bigint | null;
    payout?: bigint | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}) {
  const spectatorBets = wager.spectatorBets?.map((sb) => ({
    ...sb,
    amount: sb.amount?.toString() ?? '0',
    payout: sb.payout?.toString() ?? null,
  }));

  return {
    ...wager,
    stakeAmount: wager.stakeAmount?.toString() ?? '0',
    ...(spectatorBets && { spectatorBets }),
  };
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
        const code = (dbError as Record<string, unknown>).code;
        const meta = (dbError as Record<string, unknown>).meta;
        console.error(
          `[WAGER_CREATE] code=${code} meta=${JSON.stringify(meta)} msg=${dbError instanceof Error ? dbError.message : String(dbError)}`,
        );
        // P2021 = table does not exist (migration not applied)
        if (code === 'P2021') {
          res.status(503).json({
            error: 'ServiceUnavailable',
            message: 'Wager tables not yet created. Database migration may be pending.',
          });
          return;
        }
        throw dbError;
      }

      res.status(201).json({
        ...serializeWager(wager),
        message: 'Wager created successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /wagers : List wagers with optional filters
 */
router.get(
  '/',
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

      res.json({
        wagers: wagers.map(serializeWager),
        pagination: {
          total,
          page: pageNum,
          limit: take,
          hasMore: skip + take < total,
        },
      });
    } catch (error) {
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
          throw Object.assign(new Error('Wager not found'), { statusCode: 404 });
        }

        if (wager.status !== 'OPEN') {
          throw Object.assign(new Error('Wager is not open for acceptance'), { statusCode: 400 });
        }

        if (wager.creatorId === user.id) {
          throw Object.assign(new Error('Cannot accept your own wager'), { statusCode: 400 });
        }

        // If wager has a specified opponent, only that user can accept
        if (wager.opponentId && wager.opponentId !== user.id) {
          throw Object.assign(new Error('This wager is reserved for a specific opponent'), {
            statusCode: 403,
          });
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
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'NotFound' : statusCode === 403 ? 'Forbidden' : 'BadRequest',
          message: error.message,
        });
        return;
      }
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
          throw Object.assign(new Error('Wager not found'), { statusCode: 404 });
        }

        if (wager.creatorId !== user.id) {
          throw Object.assign(new Error('Only the wager creator can cancel'), { statusCode: 403 });
        }

        if (wager.status !== 'OPEN') {
          throw Object.assign(new Error('Only open wagers can be cancelled'), { statusCode: 400 });
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
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'NotFound' : statusCode === 403 ? 'Forbidden' : 'BadRequest',
          message: error.message,
        });
        return;
      }
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
  requireBot,
  validate(settleWagerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { winnerId } = req.body;

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
          throw Object.assign(new Error('Wager not found'), { statusCode: 404 });
        }

        if (wager.status !== 'LOCKED') {
          throw Object.assign(new Error('Only locked wagers can be settled'), { statusCode: 400 });
        }

        // Winner must be one of the two participants
        if (winnerId !== wager.creatorId && winnerId !== wager.opponentId) {
          throw Object.assign(new Error('Winner must be a wager participant'), { statusCode: 400 });
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
          }
        }

        return updated;
      });

      res.json({
        ...serializeWager(result),
        message: 'Wager settled successfully',
      });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'NotFound' : 'BadRequest',
          message: error.message,
        });
        return;
      }
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
          throw Object.assign(new Error('Wager not found'), { statusCode: 404 });
        }

        // Only participants can dispute
        if (wager.creatorId !== user.id && wager.opponentId !== user.id) {
          throw Object.assign(new Error('Only wager participants can dispute'), {
            statusCode: 403,
          });
        }

        if (wager.status !== 'LOCKED' && wager.status !== 'SETTLED') {
          throw Object.assign(new Error('Only locked or settled wagers can be disputed'), {
            statusCode: 400,
          });
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
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'NotFound' : statusCode === 403 ? 'Forbidden' : 'BadRequest',
          message: error.message,
        });
        return;
      }
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
          throw Object.assign(new Error('Wager not found'), { statusCode: 404 });
        }

        if (wager.status !== 'LOCKED') {
          throw Object.assign(new Error('Spectator bets are only allowed on locked wagers'), {
            statusCode: 400,
          });
        }

        // Cannot bet on a wager you are participating in
        if (wager.creatorId === user.id || wager.opponentId === user.id) {
          throw Object.assign(new Error('Wager participants cannot place spectator bets'), {
            statusCode: 400,
          });
        }

        // Predicted winner must be one of the participants
        if (predictedWinnerId !== wager.creatorId && predictedWinnerId !== wager.opponentId) {
          throw Object.assign(new Error('Predicted winner must be a wager participant'), {
            statusCode: 400,
          });
        }

        const weiAmount = mbucksToWei(amount);
        if (weiAmount <= 0n) {
          throw Object.assign(new Error('Bet amount must be positive'), { statusCode: 400 });
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
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'NotFound' : 'BadRequest',
          message: error.message,
        });
        return;
      }
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
      next(error);
    }
  },
);

export default router;

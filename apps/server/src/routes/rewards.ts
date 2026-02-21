/**
 * Rewards routes for Moltblox API
 * Season-based points and airdrop system.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { JsonRpcProvider, Contract } from 'ethers';
import { requireAuth, requireBot, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getUserRewardsSummary,
  getRewardsLeaderboard,
  getUserRewardHistory,
  getActiveSeason,
  getCurrentOrUpcomingSeason,
  getSeasonInfo,
  awardPoints,
  awardHolderPoints,
} from '../lib/rewardsEngine.js';
import {
  getLeaderboardSchema,
  getHistorySchema,
  recordPointsSchema,
  claimHolderSchema,
} from '../schemas/rewards.js';
import { serializeBigIntFields } from '../lib/serialize.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

// Minimal ERC20 ABI for balanceOf (read-only, no gas)
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

/**
 * Query on-chain MBUCKS balance for a wallet address.
 * Returns balance in whole MBUCKS (18 decimals divided out).
 * Returns 0 if RPC or contract is unavailable (fail-closed).
 */
async function getOnChainBalance(walletAddress: string): Promise<number> {
  const rpcUrl = process.env.BASE_RPC_URL;
  const tokenAddress = process.env.MOLTBUCKS_ADDRESS;
  if (!rpcUrl || !tokenAddress) return 0;

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const token = new Contract(tokenAddress, ERC20_BALANCE_ABI, provider);
    const balanceWei: bigint = await token.balanceOf(walletAddress);
    return Number(balanceWei / 10n ** 18n);
  } catch {
    return 0;
  }
}

/** Maximum claimable holder reward per claim: 1000 MBUCKS */
const MAX_HOLDER_CLAIM = 1000;

const router: Router = Router();

/**
 * GET / - Rewards API index with available endpoints
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Rewards API',
    endpoints: {
      summary: 'GET /api/v1/rewards/summary (auth required)',
      leaderboard: 'GET /api/v1/rewards/leaderboard',
      history: 'GET /api/v1/rewards/history (auth required)',
    },
  });
});

/**
 * GET /rewards/summary - User's points summary for the active season
 */
router.get('/summary', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const summary = await getUserRewardsSummary(userId);

    if (!summary) {
      res.json({
        message: 'No active season',
        season: null,
        points: null,
      });
      return;
    }

    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /rewards/leaderboard - Points leaderboard for the active season
 */
router.get(
  '/leaderboard',
  optionalAuth,
  validate(getLeaderboardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 25;
      const category = req.query.category as
        | 'builder'
        | 'player'
        | 'holder'
        | 'purchaser'
        | undefined;
      const leaderboard = await getRewardsLeaderboard(limit, category);

      res.json({
        data: leaderboard,
        season: await getActiveSeason(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /rewards/history - User's reward event history
 */
router.get(
  '/history',
  requireAuth,
  validate(getHistorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const result = await getUserRewardHistory(userId, limit, offset);

      res.json({ data: result.events, total: result.total });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /rewards/season - Current or upcoming season info
 */
router.get('/season', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await getCurrentOrUpcomingSeason();
    if (!season) {
      res.json({ data: null, message: 'No active or upcoming season' });
      return;
    }

    res.json({
      data: serializeBigIntFields(season, ['tokenPool']),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /rewards/multipliers - Current scoring weights for the active season
 */
router.get('/multipliers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await getActiveSeason();
    if (!season) {
      res.json({ data: null, message: 'No active season' });
      return;
    }

    res.json({
      data: {
        seasonId: season.id,
        seasonName: season.name,
        weights: {
          builder: season.weightBuilder,
          player: season.weightPlayer,
          holder: season.weightHolder,
          purchaser: season.weightPurchaser,
        },
        note: 'Weights sum to 100. Higher weight = more tokens per point in that category.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /rewards/season/:id - Specific season info by ID
 */
router.get('/season/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await getSeasonInfo(req.params.id);
    if (!season) {
      res.status(404).json({ error: 'NotFound', message: 'Season not found' });
      return;
    }

    res.json({
      data: serializeBigIntFields(season, ['tokenPool']),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /rewards/claim-holder - Claim daily holder points
 * Server verifies on-chain MBUCKS balance; awards holder points accordingly.
 */
router.post(
  '/claim-holder',
  requireAuth,
  validate(claimHolderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const walletAddress = req.user!.address;

      // Rate limit: one holder claim per 24 hours
      const recentClaim = await prisma.rewardEvent.findFirst({
        where: {
          userId,
          category: 'holder',
          createdAt: { gte: new Date(Date.now() - 86_400_000) },
        },
      });
      if (recentClaim) {
        throw new AppError('Holder rewards can only be claimed once per 24 hours', 429);
      }

      // Verify balance on-chain (ignores client-reported value)
      const onChainBalance = await getOnChainBalance(walletAddress);
      if (onChainBalance <= 0) {
        res.json({ message: 'No MBUCKS balance found on-chain', points: 0 });
        return;
      }

      // Cap the claimable balance
      const cappedBalance = Math.min(onChainBalance, MAX_HOLDER_CLAIM);

      const event = await awardHolderPoints(userId, cappedBalance);
      if (!event) {
        res.json({ message: 'No active season or zero balance', points: 0 });
        return;
      }

      res.json({
        message: `Earned ${event.points} holder points`,
        points: event.points,
        eventId: event.id,
        verifiedBalance: onChainBalance,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /rewards/record - Record reward points (internal / bot API)
 * Used by the server internally or via MCP tools to record points for any user.
 */
router.post(
  '/record',
  requireAuth,
  requireBot,
  validate(recordPointsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, category, points, reason, metadata } = req.body;

      const event = await awardPoints({
        userId,
        category,
        points,
        reason,
        metadata,
      });

      if (!event) {
        res.json({ message: 'No active season', recorded: false });
        return;
      }

      res.json({
        recorded: true,
        eventId: event.id,
        points: event.points,
        category: event.category,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

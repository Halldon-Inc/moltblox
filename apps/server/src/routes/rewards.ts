/**
 * Rewards routes for Moltblox API
 * Season-based points and airdrop system.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
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

const router: Router = Router();

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
 * User reports their on-chain MBUCKS balance; server awards holder points.
 */
router.post(
  '/claim-holder',
  requireAuth,
  validate(claimHolderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { balanceMbucks } = req.body as { balanceMbucks: number };

      const event = await awardHolderPoints(userId, balanceMbucks);
      if (!event) {
        res.json({ message: 'No active season or zero balance', points: 0 });
        return;
      }

      res.json({
        message: `Earned ${event.points} holder points`,
        points: event.points,
        eventId: event.id,
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

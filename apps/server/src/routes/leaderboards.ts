/**
 * Leaderboards alias route
 *
 * Provides GET /leaderboards as an alias for /stats/leaderboard.
 * Supports the same query params: type, period, limit.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { queryLeaderboard } from '../lib/leaderboardQuery.js';

const router: Router = Router();

/**
 * GET / - Get leaderboard rankings
 *
 * Query params:
 *   type   - leaderboard type (top_creators | top_games | top_competitors |
 *            top_earners | rising_stars | community_heroes)
 *   period - time period (week | month | all_time), default "week"
 *   limit  - max entries (1..100, default 25)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = (req.query.type as string) || 'top_creators';
    const period = (req.query.period as string) || 'week';
    const limit = parseInt(req.query.limit as string) || 25;

    const result = await queryLeaderboard(type, period, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

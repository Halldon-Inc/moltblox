/**
 * Game analytics routes (creator-only detailed analytics)
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth, requireBot } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { gameIdParamSchema } from '../../schemas/games.js';
import { requireGameOwnership, buildDailyTimeSeries } from '../../lib/utils.js';

const router: Router = Router();

/**
 * GET /games/:id/analytics - Detailed analytics for a game (bot creator only)
 */
router.get(
  '/:id/analytics',
  requireAuth,
  requireBot,
  validate(gameIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const game = await requireGameOwnership<{ id: string; creatorId: string; name: string }>(
        id,
        user.id,
        { id: true, name: true },
      );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Daily play counts for last 30 days (aggregated at DB level)
      const playRows = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE_TRUNC('day', "startedAt")::date::text AS day, COUNT(*)::bigint AS count
        FROM "game_sessions"
        WHERE "gameId" = ${id} AND "startedAt" >= ${thirtyDaysAgo}
        GROUP BY day ORDER BY day
      `;

      const dailyPlays = buildDailyTimeSeries(30, 0);
      for (const row of playRows) {
        if (row.day in dailyPlays) {
          dailyPlays[row.day] = Number(row.count);
        }
      }

      // Daily revenue for last 30 days (aggregated at DB level)
      const revenueRows = await prisma.$queryRaw<Array<{ day: string; total: bigint }>>`
        SELECT DATE_TRUNC('day', "createdAt")::date::text AS day, COALESCE(SUM("price"), 0)::bigint AS total
        FROM "purchases"
        WHERE "gameId" = ${id} AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY day ORDER BY day
      `;

      const dailyRevenue = buildDailyTimeSeries(30, '0');
      for (const row of revenueRows) {
        if (row.day in dailyRevenue) {
          dailyRevenue[row.day] = row.total.toString();
        }
      }

      // Top selling items (top 5 by soldCount)
      const topItems = await prisma.item.findMany({
        where: { gameId: id },
        orderBy: { soldCount: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          soldCount: true,
          price: true,
          rarity: true,
          imageUrl: true,
        },
      });

      // Player stats: total unique, returning (played more than once)
      const [playerResult] = await prisma.$queryRaw<[{ total: bigint; returning: bigint }]>`
        SELECT
          COUNT(DISTINCT "userId") AS total,
          COUNT(DISTINCT CASE WHEN cnt > 1 THEN "userId" END) AS returning
        FROM (
          SELECT "userId", COUNT(*) AS cnt
          FROM "game_session_players" gsp
          JOIN "game_sessions" gs ON gsp."sessionId" = gs.id
          WHERE gs."gameId" = ${id}
          GROUP BY "userId"
        ) sub
      `;

      const totalUniquePlayers = Number(playerResult.total);
      const returningPlayers = Number(playerResult.returning);

      res.json({
        gameId: id,
        gameName: game.name,
        dailyPlays: Object.entries(dailyPlays)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
        dailyRevenue: Object.entries(dailyRevenue)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, amount]) => ({ date, amount })),
        topItems: topItems.map((item) => ({
          ...item,
          price: item.price.toString(),
        })),
        playerStats: {
          totalUnique: totalUniquePlayers,
          returning: returningPlayers,
          newPlayers: totalUniquePlayers - returningPlayers,
          retentionRate:
            totalUniquePlayers > 0 ? Math.round((returningPlayers / totalUniquePlayers) * 100) : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

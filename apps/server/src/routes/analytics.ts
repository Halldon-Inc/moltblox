/**
 * Creator analytics routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireBot } from '../middleware/auth.js';

const router: Router = Router();

/**
 * GET /creator/analytics - Aggregate analytics across all games owned by the creator
 */
router.get(
  '/',
  requireAuth,
  requireBot,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;

      // Fetch all games by this creator
      const games = await prisma.game.findMany({
        where: { creatorId: user.id },
        select: {
          id: true,
          name: true,
          totalPlays: true,
          totalRevenue: true,
          uniquePlayers: true,
          averageRating: true,
        },
      });

      const gameIds = games.map((g) => g.id);

      // Per-game revenue breakdown
      const perGameRevenue = games.map((g) => ({
        gameId: g.id,
        gameName: g.name,
        totalRevenue: g.totalRevenue.toString(),
        totalPlays: g.totalPlays,
        uniquePlayers: g.uniquePlayers,
        averageRating: g.averageRating,
      }));

      // Total plays across all games over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessions = await prisma.gameSession.findMany({
        where: {
          gameId: { in: gameIds },
          startedAt: { gte: thirtyDaysAgo },
        },
        select: { startedAt: true, gameId: true },
      });

      const dailyPlays: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyPlays[d.toISOString().slice(0, 10)] = 0;
      }
      for (const s of sessions) {
        const key = s.startedAt.toISOString().slice(0, 10);
        if (key in dailyPlays) {
          dailyPlays[key]++;
        }
      }

      // Aggregate player stats across all games
      const playerSessionCounts =
        gameIds.length > 0
          ? await prisma.gameSessionPlayer.groupBy({
              by: ['userId'],
              where: {
                session: { gameId: { in: gameIds } },
              },
              _count: { userId: true },
            })
          : [];

      const totalUniquePlayers = playerSessionCounts.length;
      const returningPlayers = playerSessionCounts.filter((p) => p._count.userId > 1).length;

      // Top items across all creator's games
      const topItems =
        gameIds.length > 0
          ? await prisma.item.findMany({
              where: { gameId: { in: gameIds } },
              orderBy: { soldCount: 'desc' },
              take: 5,
              select: {
                id: true,
                name: true,
                soldCount: true,
                price: true,
                rarity: true,
                imageUrl: true,
                game: { select: { name: true } },
              },
            })
          : [];

      res.json({
        totalGames: games.length,
        perGameRevenue,
        dailyPlays: Object.entries(dailyPlays)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
        topItems: topItems.map((item) => ({
          id: item.id,
          name: item.name,
          soldCount: item.soldCount,
          price: item.price.toString(),
          rarity: item.rarity,
          imageUrl: item.imageUrl,
          gameName: item.game.name,
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

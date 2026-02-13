/**
 * Leaderboards alias route
 *
 * Provides GET /leaderboards as an alias for /stats/leaderboard.
 * Supports the same query params: type, period, limit.
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

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
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);

    // Calculate period start date
    let periodStart: Date | null = null;
    const now = new Date();
    if (period === 'week') {
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    // all_time: no date filter

    let leaderboard: Array<{
      rank: number;
      playerId: string;
      playerName: string;
      score: number | string;
      change: number;
    }> = [];

    if (type === 'top_creators') {
      const creators = await prisma.user.findMany({
        where: { reputationCreator: { gt: 0 } },
        orderBy: { reputationCreator: 'desc' },
        take: limit,
        select: { id: true, username: true, displayName: true, reputationCreator: true },
      });
      leaderboard = creators.map((u, i) => ({
        rank: i + 1,
        playerId: u.id,
        playerName: u.displayName || u.username || u.id,
        score: u.reputationCreator,
        change: 0,
      }));
    } else if (type === 'top_games') {
      const where: Prisma.GameWhereInput = { status: 'published' };
      if (periodStart) where.publishedAt = { gte: periodStart };
      const games = await prisma.game.findMany({
        where,
        orderBy: { totalPlays: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          totalPlays: true,
          creatorId: true,
        },
      });
      leaderboard = games.map((g, i) => ({
        rank: i + 1,
        playerId: g.creatorId,
        playerName: g.name,
        score: g.totalPlays,
        change: 0,
      }));
    } else if (type === 'top_competitors') {
      const competitors = await prisma.user.findMany({
        where: { reputationTournament: { gt: 0 } },
        orderBy: { reputationTournament: 'desc' },
        take: limit,
        select: { id: true, username: true, displayName: true, reputationTournament: true },
      });
      leaderboard = competitors.map((u, i) => ({
        rank: i + 1,
        playerId: u.id,
        playerName: u.displayName || u.username || u.id,
        score: u.reputationTournament,
        change: 0,
      }));
    } else if (type === 'top_earners') {
      const earners = await prisma.tournamentParticipant.groupBy({
        by: ['userId'],
        _sum: { prizeWon: true },
        where: { prizeWon: { not: null } },
        orderBy: { _sum: { prizeWon: 'desc' } },
        take: limit,
      });
      const userIds = earners.map((e) => e.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, displayName: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      leaderboard = earners.map((e, i) => {
        const u = userMap.get(e.userId);
        return {
          rank: i + 1,
          playerId: e.userId,
          playerName: u?.displayName || u?.username || e.userId,
          score: (e._sum.prizeWon ?? 0n).toString(),
          change: 0,
        };
      });
    } else if (type === 'rising_stars') {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const stars = await prisma.user.findMany({
        where: { createdAt: { gte: cutoff }, reputationTotal: { gt: 0 } },
        orderBy: { reputationTotal: 'desc' },
        take: limit,
        select: { id: true, username: true, displayName: true, reputationTotal: true },
      });
      leaderboard = stars.map((u, i) => ({
        rank: i + 1,
        playerId: u.id,
        playerName: u.displayName || u.username || u.id,
        score: u.reputationTotal,
        change: 0,
      }));
    } else if (type === 'community_heroes') {
      const heroes = await prisma.user.findMany({
        where: { reputationCommunity: { gt: 0 } },
        orderBy: { reputationCommunity: 'desc' },
        take: limit,
        select: { id: true, username: true, displayName: true, reputationCommunity: true },
      });
      leaderboard = heroes.map((u, i) => ({
        rank: i + 1,
        playerId: u.id,
        playerName: u.displayName || u.username || u.id,
        score: u.reputationCommunity,
        change: 0,
      }));
    }

    res.json({
      leaderboard,
      type,
      period,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

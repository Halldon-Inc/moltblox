/**
 * Game browse/discovery routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { browseGamesSchema } from '../../schemas/games.js';
import type { Prisma, GameGenre } from '../../generated/prisma/client.js';
import { serializeGame } from './_shared.js';

const router: Router = Router();

/**
 * GET /games - Browse games
 * Query params: genre, sort, limit, offset, search
 */
router.get(
  '/',
  validate(browseGamesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { genre, sort = 'popular', limit = '20', offset = '0', search = '' } = req.query;

      const take = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = parseInt(offset as string, 10) || 0;

      // Build the where clause
      const where: Prisma.GameWhereInput = {
        status: 'published',
      };

      if (genre && genre !== 'all') {
        where.genre = genre as GameGenre;
      }

      if (search) {
        where.name = {
          contains: search as string,
          mode: 'insensitive',
        };
      }

      // Handle trending/featured as special sort modes
      if (sort === 'featured') {
        where.featured = true;
      }

      if (sort === 'trending') {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const trendingGames = await prisma.gameSession.groupBy({
          by: ['gameId'],
          where: { startedAt: { gte: oneDayAgo } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take,
        });
        const gameIds = trendingGames.map((g) => g.gameId);
        const games = await prisma.game.findMany({
          where: { ...where, id: { in: gameIds } },
          include: {
            creator: { select: { username: true, displayName: true, walletAddress: true } },
          },
        });
        const gameMap = new Map(games.map((g) => [g.id, g]));
        const orderedGames = gameIds
          .map((id) => gameMap.get(id))
          .filter((g): g is NonNullable<typeof g> => !!g);
        res.json({
          games: orderedGames.map(serializeGame),
          pagination: { total: orderedGames.length, limit: take, offset: skip, hasMore: false },
          filters: { genre: genre ?? 'all', sort, search },
        });
        return;
      }

      // Build the orderBy clause
      let orderBy: Prisma.GameOrderByWithRelationInput;
      switch (sort) {
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'rating':
        case 'featured':
          orderBy = { averageRating: 'desc' };
          break;
        case 'popular':
        default:
          orderBy = { totalPlays: 'desc' };
          break;
      }

      const [games, total] = await Promise.all([
        prisma.game.findMany({
          where,
          orderBy,
          take,
          skip,
          include: {
            creator: {
              select: {
                username: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
        }),
        prisma.game.count({ where }),
      ]);

      res.json({
        games: games.map(serializeGame),
        pagination: {
          total,
          limit: take,
          offset: skip,
          hasMore: skip + take < total,
        },
        filters: {
          genre: genre ?? 'all',
          sort,
          search,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /games/featured - Staff-picked featured games
 */
router.get('/featured', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
    const games = await prisma.game.findMany({
      where: { status: 'published', featured: true },
      take: limit,
      orderBy: { averageRating: 'desc' },
      include: {
        creator: { select: { id: true, displayName: true, username: true, walletAddress: true } },
      },
    });
    res.json({ games: games.map(serializeGame), total: games.length });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /games/trending - Hot games by recent play velocity
 */
router.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
    // Trending = most plays in last 24 hours (via recent sessions)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trendingGames = await prisma.gameSession.groupBy({
      by: ['gameId'],
      where: { startedAt: { gte: oneDayAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    const gameIds = trendingGames.map((g) => g.gameId);
    const games = await prisma.game.findMany({
      where: { id: { in: gameIds }, status: 'published' },
      include: {
        creator: { select: { id: true, displayName: true, username: true, walletAddress: true } },
      },
    });
    // Maintain trending order
    const gameMap = new Map(games.map((g) => [g.id, g]));
    const orderedGames = gameIds
      .map((id) => gameMap.get(id))
      .filter((g): g is NonNullable<typeof g> => !!g);
    res.json({ games: orderedGames.map((g) => serializeGame(g)), total: orderedGames.length });
  } catch (error) {
    next(error);
  }
});

export default router;

/**
 * Game routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireBot } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  browseGamesSchema,
  gameIdParamSchema,
  createGameSchema,
  updateGameSchema,
  rateGameSchema,
} from '../schemas/games.js';
import { sanitize, sanitizeObject } from '../lib/sanitize.js';
import type { Prisma, GameGenre } from '../generated/prisma/client.js';
import rateLimit from 'express-rate-limit';

// Games-specific write limiter (60s window, 30 max) — stricter burst protection
// than the global Redis-backed writeLimiter in app.ts (15min window, 30 max).
const gamesWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Write rate limit exceeded.' },
});

const router: Router = Router();

/**
 * Generate a URL-friendly slug from a game name.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Serialize BigInt fields to strings so JSON.stringify doesn't throw.
 */
function serializeGame(game: { totalRevenue?: bigint | null; [key: string]: unknown }) {
  return {
    ...game,
    totalRevenue: game.totalRevenue?.toString() ?? '0',
  };
}

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

      // Build the orderBy clause
      let orderBy: Prisma.GameOrderByWithRelationInput;
      switch (sort) {
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'rating':
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

/**
 * GET /games/:id - Get game details
 */
router.get(
  '/:id',
  validate(gameIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const game = await prisma.game.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      res.json(serializeGame(game));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /games - Publish a new game (bot creators only)
 */
router.post(
  '/',
  gamesWriteLimiter,
  requireAuth,
  requireBot,
  validate(createGameSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { name, description, genre, tags, maxPlayers, wasmUrl, thumbnailUrl, screenshots } =
        req.body;

      const sanitized = sanitizeObject({ name, description } as Record<string, unknown>, [
        'name',
        'description',
      ]);

      const slug = slugify(name);

      const game = await prisma.game.create({
        data: {
          name: sanitized.name as string,
          slug,
          description: sanitized.description as string,
          creatorId: user.id,
          genre: genre || 'other',
          tags: tags || [],
          maxPlayers: maxPlayers || 1,
          wasmUrl: wasmUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          screenshots: screenshots || [],
          status: 'draft',
        },
        include: {
          creator: {
            select: {
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      res.status(201).json({
        ...serializeGame(game),
        message: 'Game created successfully. Upload your WASM bundle to publish.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /games/:id - Update a game (bot creators only)
 */
router.put(
  '/:id',
  gamesWriteLimiter,
  requireAuth,
  requireBot,
  validate(updateGameSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Verify ownership
      const existing = await prisma.game.findUnique({
        where: { id },
        select: { creatorId: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      if (existing.creatorId !== user.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You do not own this game' });
        return;
      }

      const {
        name,
        description,
        genre,
        tags,
        maxPlayers,
        status,
        wasmUrl,
        thumbnailUrl,
        screenshots,
      } = req.body;

      // Sanitize name and description if provided
      const fieldsToSanitize: Record<string, unknown> = {};
      const keys: string[] = [];
      if (name !== undefined) {
        fieldsToSanitize.name = name;
        keys.push('name');
      }
      if (description !== undefined) {
        fieldsToSanitize.description = description;
        keys.push('description');
      }
      const sanitized = keys.length > 0 ? sanitizeObject(fieldsToSanitize, keys) : {};

      const data: Prisma.GameUpdateInput = {};
      if (name !== undefined) {
        data.name = sanitized.name as string;
        data.slug = slugify(name);
      }
      if (description !== undefined) data.description = sanitized.description as string;
      if (genre !== undefined) data.genre = genre;
      if (tags !== undefined) data.tags = tags;
      if (maxPlayers !== undefined) data.maxPlayers = maxPlayers;
      if (status !== undefined) {
        data.status = status;
        if (status === 'published') {
          data.publishedAt = new Date();
        }
      }
      if (wasmUrl !== undefined) data.wasmUrl = wasmUrl;
      if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl;
      if (screenshots !== undefined) data.screenshots = screenshots;

      const game = await prisma.game.update({
        where: { id },
        data,
        include: {
          creator: {
            select: {
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      res.json({
        ...serializeGame(game),
        message: 'Game updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /games/:id/stats - Get game statistics
 */
router.get(
  '/:id/stats',
  validate(gameIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const game = await prisma.game.findUnique({
        where: { id },
        select: {
          id: true,
          totalPlays: true,
          uniquePlayers: true,
          totalRevenue: true,
          averageRating: true,
          ratingCount: true,
        },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      // Rating distribution from GameRating model
      const [rating1, rating2, rating3, rating4, rating5] = await Promise.all([
        prisma.gameRating.count({ where: { gameId: id, rating: 1 } }),
        prisma.gameRating.count({ where: { gameId: id, rating: 2 } }),
        prisma.gameRating.count({ where: { gameId: id, rating: 3 } }),
        prisma.gameRating.count({ where: { gameId: id, rating: 4 } }),
        prisma.gameRating.count({ where: { gameId: id, rating: 5 } }),
      ]);

      // Purchase/revenue aggregation
      const purchaseStats = await prisma.purchase.aggregate({
        where: { gameId: id },
        _sum: {
          price: true,
          creatorAmount: true,
          platformAmount: true,
        },
        _count: {
          id: true,
        },
      });

      res.json({
        gameId: game.id,
        plays: {
          total: game.totalPlays,
        },
        players: {
          total: game.uniquePlayers,
        },
        revenue: {
          total: game.totalRevenue.toString(),
          creatorEarnings: (purchaseStats._sum.creatorAmount ?? BigInt(0)).toString(),
          platformFees: (purchaseStats._sum.platformAmount ?? BigInt(0)).toString(),
          itemsSold: purchaseStats._count.id,
        },
        ratings: {
          average: game.averageRating,
          count: game.ratingCount,
          distribution: {
            1: rating1,
            2: rating2,
            3: rating3,
            4: rating4,
            5: rating5,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /games/:id/rate - Rate a game (auth required)
 */
router.post(
  '/:id/rate',
  gamesWriteLimiter,
  requireAuth,
  validate(rateGameSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { rating, review } = req.body;

      const sanitizedReview = review ? sanitize(review) : null;

      // Check game exists
      const game = await prisma.game.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      // Upsert the rating
      await prisma.gameRating.upsert({
        where: {
          gameId_userId: {
            gameId: id,
            userId: user.id,
          },
        },
        create: {
          gameId: id,
          userId: user.id,
          rating,
          review: sanitizedReview,
        },
        update: {
          rating,
          review: sanitizedReview,
        },
      });

      // Recalculate averageRating and ratingCount on the game
      const aggregation = await prisma.gameRating.aggregate({
        where: { gameId: id },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const updatedGame = await prisma.game.update({
        where: { id },
        data: {
          averageRating: aggregation._avg.rating ?? 0,
          ratingCount: aggregation._count.rating,
        },
        select: {
          averageRating: true,
          ratingCount: true,
        },
      });

      res.json({
        gameId: id,
        rating,
        review: sanitizedReview,
        averageRating: updatedGame.averageRating,
        ratingCount: updatedGame.ratingCount,
        message: 'Rating submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

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

      // Verify game exists and caller owns it
      const game = await prisma.game.findUnique({
        where: { id },
        select: { id: true, creatorId: true, name: true },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      if (game.creatorId !== user.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You do not own this game' });
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Daily play counts for last 30 days
      const sessions = await prisma.gameSession.findMany({
        where: {
          gameId: id,
          startedAt: { gte: thirtyDaysAgo },
        },
        select: { startedAt: true },
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

      // Daily revenue for last 30 days
      const purchases = await prisma.purchase.findMany({
        where: {
          gameId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true, price: true },
      });

      const dailyRevenue: Record<string, string> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyRevenue[d.toISOString().slice(0, 10)] = '0';
      }
      for (const p of purchases) {
        const key = p.createdAt.toISOString().slice(0, 10);
        if (key in dailyRevenue) {
          dailyRevenue[key] = (BigInt(dailyRevenue[key]) + p.price).toString();
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
      const playerSessionCounts = await prisma.gameSessionPlayer.groupBy({
        by: ['userId'],
        where: {
          session: { gameId: id },
        },
        _count: { userId: true },
      });

      const totalUniquePlayers = playerSessionCounts.length;
      const returningPlayers = playerSessionCounts.filter((p) => p._count.userId > 1).length;

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

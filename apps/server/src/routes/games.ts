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
  recordPlaySchema,
} from '../schemas/games.js';
import { sanitize, sanitizeObject } from '../lib/sanitize.js';
import type { Prisma, GameGenre } from '../generated/prisma/client.js';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis from '../lib/redis.js';

function createRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<never>,
    prefix: `rl:${prefix}:`,
  });
}

// Games-specific write limiter (60s window, 30 max), Redis-backed
const gamesWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('games-write'),
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
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
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
      const {
        name,
        description,
        genre,
        tags,
        maxPlayers,
        wasmUrl,
        templateSlug,
        thumbnailUrl,
        screenshots,
      } = req.body;

      const sanitized = sanitizeObject({ name, description } as Record<string, unknown>, [
        'name',
        'description',
      ]);

      const slug = slugify(name);

      let game;
      try {
        game = await prisma.game.create({
          data: {
            name: sanitized.name as string,
            slug,
            description: sanitized.description as string,
            creatorId: user.id,
            genre: genre || 'other',
            tags: tags || [],
            maxPlayers: maxPlayers || 1,
            wasmUrl: wasmUrl || null,
            templateSlug: templateSlug || null,
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
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
          res
            .status(409)
            .json({ error: 'Conflict', message: 'A game with this name already exists' });
          return;
        }
        throw err;
      }

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
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
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
        templateSlug,
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
      if (templateSlug !== undefined) data.templateSlug = templateSlug;
      if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl;
      if (screenshots !== undefined) data.screenshots = screenshots;

      let game;
      try {
        game = await prisma.game.update({
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
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
          res
            .status(409)
            .json({ error: 'Conflict', message: 'A game with this name already exists' });
          return;
        }
        throw err;
      }

      // Reward reputation when a game is published
      if (status === 'published') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            reputationCreator: { increment: 5 },
            reputationTotal: { increment: 5 },
          },
        });
      }

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
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      // Rating distribution from GameRating model (single groupBy instead of N+1)
      const ratingGroups = await prisma.gameRating.groupBy({
        by: ['rating'],
        where: { gameId: id },
        _count: { id: true },
      });
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const g of ratingGroups) {
        ratingDistribution[g.rating] = g._count.id;
      }

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
          distribution: ratingDistribution,
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
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      // Wrap rating upsert + aggregate recalculation + game update in a transaction
      // to prevent concurrent ratings from producing stale averageRating values
      const updatedGame = await prisma.$transaction(async (tx) => {
        // Upsert the rating
        await tx.gameRating.upsert({
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
        const aggregation = await tx.gameRating.aggregate({
          where: { gameId: id },
          _avg: { rating: true },
          _count: { rating: true },
        });

        return tx.game.update({
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
      });

      // Reward reputation for rating a game
      await prisma.user.update({
        where: { id: user.id },
        data: {
          reputationPlayer: { increment: 1 },
          reputationCommunity: { increment: 1 },
          reputationTotal: { increment: 2 },
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
 * POST /games/:id/play-session - Record a template game play
 * Creates a completed GameSession + GameSessionPlayer and bumps play stats.
 */
router.post(
  '/:id/play-session',
  gamesWriteLimiter,
  requireAuth,
  validate(recordPlaySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { scores } = req.body;

      // Verify game exists and is published
      const game = await prisma.game.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      if (game.status !== 'published') {
        res.status(400).json({ error: 'BadRequest', message: 'Game is not published' });
        return;
      }

      // Create session, link player, and bump stats in a transaction
      // The uniqueness check is inside the transaction to avoid race conditions
      const session = await prisma.$transaction(async (tx) => {
        const existingPlay = await tx.gameSessionPlayer.findFirst({
          where: {
            userId: user.id,
            session: { gameId: id },
          },
          select: { id: true },
        });

        const isNewPlayer = !existingPlay;

        const newSession = await tx.gameSession.create({
          data: {
            gameId: id,
            status: 'completed',
            scores: scores ?? undefined,
            endedAt: new Date(),
          },
        });

        await tx.gameSessionPlayer.create({
          data: {
            sessionId: newSession.id,
            userId: user.id,
          },
        });

        await tx.game.update({
          where: { id },
          data: {
            totalPlays: { increment: 1 },
            ...(isNewPlayer ? { uniquePlayers: { increment: 1 } } : {}),
          },
        });

        return newSession;
      });

      res.json({ sessionId: session.id, recorded: true });
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
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      if (game.creatorId !== user.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You do not own this game' });
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Daily play counts for last 30 days (aggregated at DB level)
      const playRows = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE_TRUNC('day', "startedAt")::date::text AS day, COUNT(*)::bigint AS count
        FROM "game_sessions"
        WHERE "gameId" = ${id} AND "startedAt" >= ${thirtyDaysAgo}
        GROUP BY day ORDER BY day
      `;

      const dailyPlays: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyPlays[d.toISOString().slice(0, 10)] = 0;
      }
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

      const dailyRevenue: Record<string, string> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyRevenue[d.toISOString().slice(0, 10)] = '0';
      }
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

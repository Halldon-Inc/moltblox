/**
 * Game stats and rating routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { gameIdParamSchema, rateGameSchema } from '../../schemas/games.js';
import { sanitize } from '../../lib/sanitize.js';
import { gamesWriteLimiter } from './_shared.js';

const router: Router = Router();

/**
 * GET /games/:id/ratings - Alias for /:id/stats (ratings are included in stats)
 */
router.get('/:id/ratings', validate(gameIdParamSchema), (req: Request, res: Response) => {
  const qs = Object.keys(req.query).length
    ? '?' + new URLSearchParams(req.query as Record<string, string>).toString()
    : '';
  res.redirect(301, `${req.baseUrl}/${req.params.id}/stats${qs}`);
});

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
        select: { id: true, creatorId: true },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      if (game.creatorId === user.id) {
        res.status(403).json({ error: 'Forbidden', message: 'Cannot rate your own game' });
        return;
      }

      // Wrap rating upsert + aggregate recalculation + game update in a transaction
      // to prevent concurrent ratings from producing stale averageRating values
      const { updatedGame, existing } = await prisma.$transaction(async (tx) => {
        // Check if a rating already exists (for updated/previousRating response)
        const existingRating = await tx.gameRating.findUnique({
          where: { gameId_userId: { gameId: id, userId: user.id } },
        });

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

        const game = await tx.game.update({
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

        return { updatedGame: game, existing: existingRating };
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
        updated: !!existing,
        ...(existing ? { previousRating: existing.rating } : {}),
        message: existing ? 'Rating updated successfully' : 'Rating submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

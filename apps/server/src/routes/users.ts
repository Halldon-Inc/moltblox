/**
 * User profile routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router: Router = Router();

/**
 * GET /users/:username - Public user profile
 */
router.get(
  '/:username',
  validate({ params: z.object({ username: z.string().min(1).max(50) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username } = req.params;

      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          role: true,
          botVerified: true,
          moltbookAgentName: true,
          moltbookKarma: true,
          reputationTotal: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'NotFound', message: 'User not found' });
        return;
      }

      // Aggregate stats for this user's games
      const gameStats = await prisma.game.aggregate({
        where: { creatorId: user.id, status: 'published' },
        _count: { id: true },
        _sum: { totalPlays: true },
      });

      // Count total items sold by this user
      const itemsSold = await prisma.purchase.count({
        where: { sellerId: user.id },
      });

      // Fetch their published games for the profile grid
      const games = await prisma.game.findMany({
        where: { creatorId: user.id, status: 'published' },
        orderBy: { totalPlays: 'desc' },
        take: 20,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          genre: true,
          tags: true,
          thumbnailUrl: true,
          totalPlays: true,
          averageRating: true,
          ratingCount: true,
          createdAt: true,
        },
      });

      res.json({
        user: {
          ...user,
          stats: {
            gamesCreated: gameStats._count.id,
            totalPlays: gameStats._sum.totalPlays ?? 0,
            itemsSold,
          },
        },
        games,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

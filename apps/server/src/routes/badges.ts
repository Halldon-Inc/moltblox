/**
 * Badge routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { checkAndAwardBadges } from '../lib/badgeEngine.js';

const router: Router = Router();

/**
 * GET /badges - List all badges with earned status for current user
 */
router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    const badges = await prisma.badge.findMany({
      orderBy: { category: 'asc' },
      include: {
        users: userId
          ? {
              where: { userId },
              select: { awardedAt: true },
            }
          : false,
        _count: {
          select: { users: true },
        },
      },
    });

    const result = badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl,
      category: badge.category,
      criteria: badge.criteria,
      totalEarned: badge._count.users,
      earned: userId ? (badge.users as Array<{ awardedAt: Date }>).length > 0 : false,
      earnedAt: userId ? ((badge.users as Array<{ awardedAt: Date }>)[0]?.awardedAt ?? null) : null,
    }));

    res.json({ badges: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /badges/my - List badges earned by authenticated user
 */
router.get('/my', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { awardedAt: 'desc' },
    });

    const result = userBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      description: ub.badge.description,
      imageUrl: ub.badge.imageUrl,
      category: ub.badge.category,
      awardedAt: ub.awardedAt,
    }));

    res.json({ badges: result, total: result.length });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /badges/check - Evaluate and award badges for the authenticated user
 * Returns newly awarded badges.
 */
router.post('/check', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const newBadges = await checkAndAwardBadges(userId);

    res.json({
      newBadges,
      message:
        newBadges.length > 0
          ? `Earned ${newBadges.length} new badge${newBadges.length > 1 ? 's' : ''}!`
          : 'No new badges earned.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /badges/user/:userId - List badges for a specific user (public)
 */
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { awardedAt: 'desc' },
    });

    const result = userBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      description: ub.badge.description,
      imageUrl: ub.badge.imageUrl,
      category: ub.badge.category,
      awardedAt: ub.awardedAt,
    }));

    res.json({ badges: result, total: result.length });
  } catch (error) {
    next(error);
  }
});

export default router;

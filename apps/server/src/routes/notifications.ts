/**
 * Notification routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listNotificationsSchema, notificationIdParamSchema } from '../schemas/notifications.js';

const router: Router = Router();

/**
 * GET / - List notifications for the authenticated user
 */
router.get(
  '/',
  requireAuth,
  validate(listNotificationsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const limit = Math.min(parseInt(req.query.limit as string, 10), 100);
      const offset = parseInt(req.query.offset as string, 10);
      const unreadOnly = req.query.unreadOnly === 'true';

      const where = {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      };

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' as const },
          skip: offset,
          take: limit,
          include: {
            game: { select: { id: true, name: true } },
            item: { select: { id: true, name: true } },
            tournament: { select: { id: true, name: true } },
            post: { select: { id: true, title: true } },
          },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, read: false } }),
      ]);

      const result = notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
        gameId: n.gameId,
        gameName: n.game?.name ?? null,
        itemId: n.itemId,
        itemName: n.item?.name ?? null,
        tournamentId: n.tournamentId,
        tournamentName: n.tournament?.name ?? null,
        postId: n.postId,
        postTitle: n.post?.title ?? null,
      }));

      res.json({
        notifications: result,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        unreadCount,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /read-all - Mark all notifications as read for the authenticated user
 * NOTE: Must be declared before /:id/read so Express does not match "read-all" as :id
 */
router.post('/read-all', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/read - Mark a single notification as read
 */
router.post(
  '/:id/read',
  requireAuth,
  validate(notificationIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        res.status(404).json({ error: 'NotFound', message: 'Notification not found' });
        return;
      }

      if (notification.userId !== userId) {
        res.status(403).json({ error: 'Forbidden', message: 'You do not own this notification' });
        return;
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { read: true },
      });

      res.json({ notification: { id: updated.id, read: updated.read } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

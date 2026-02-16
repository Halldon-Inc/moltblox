/**
 * Game play-session routes (single-play recording, NOT game start)
 * Game start is handled by routes/play.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { recordPlaySchema } from '../../schemas/games.js';
import { gamesWriteLimiter } from './_shared.js';

const router: Router = Router();

/**
 * POST /games/:id/play - Alias for /:id/sessions (307 preserves POST method)
 */
router.post('/:id/play', (req: Request, res: Response) => {
  res.redirect(307, `${req.baseUrl}/${req.params.id}/sessions`);
});

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

export default router;

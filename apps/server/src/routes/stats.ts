/**
 * Platform statistics route
 */

import { Router, Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../lib/prisma.js';

let platformVersion = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as {
    version: string;
  };
  platformVersion = pkg.version;
} catch (err) {
  console.warn(
    '[BOOT] Could not read package.json for version:',
    err instanceof Error ? err.message : err,
  );
}

const router: Router = Router();

/**
 * GET /stats - Get platform-wide statistics
 * Public endpoint, no auth required
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalGames, totalUsers, totalTournaments, totalItems] = await Promise.all([
      prisma.game.count({ where: { status: 'published' } }),
      prisma.user.count(),
      prisma.tournament.count(),
      prisma.item.count({ where: { active: true } }),
    ]);

    res.json({
      totalGames,
      totalUsers,
      totalTournaments,
      totalItems,
      creatorShare: 85,
      platformVersion,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

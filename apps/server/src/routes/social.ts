/**
 * Social routes for Moltblox API
 * Submolts, posts, comments, voting, and heartbeat system
 *
 * All queries use Prisma ORM against PostgreSQL.
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitize } from '../lib/sanitize.js';
import { validate } from '../middleware/validate.js';
import {
  submoltSlugParamSchema,
  submoltPostsQuerySchema,
  createPostSchema,
  getPostSchema,
  createCommentSchema,
  voteSchema,
} from '../schemas/social.js';

const router: Router = Router();

// ─── Submolts ────────────────────────────────────────────

/**
 * GET /submolts - List all active submolts ordered by memberCount desc
 */
router.get('/submolts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submolts = await prisma.submolt.findMany({
      where: { active: true },
      orderBy: { memberCount: 'desc' },
    });

    res.json({ submolts });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /submolts/:slug - Get a submolt by slug with paginated posts
 *
 * Query params:
 *   limit  - number of posts to return (default 20)
 *   offset - number of posts to skip   (default 0)
 */
router.get(
  '/submolts/:slug',
  validate(submoltPostsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

      const submolt = await prisma.submolt.findUnique({
        where: { slug },
      });

      if (!submolt) {
        res.status(404).json({ error: 'Not found', message: `Submolt "${slug}" does not exist` });
        return;
      }

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: { submoltId: submolt.id, deleted: false },
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          include: {
            author: {
              select: {
                username: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({
          where: { submoltId: submolt.id, deleted: false },
        }),
      ]);

      res.json({
        submolt,
        posts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Posts ───────────────────────────────────────────────

/**
 * POST /submolts/:slug/posts - Create a new post (auth required)
 *
 * Body: { title, content, type?, gameId?, tournamentId? }
 */
router.post(
  '/submolts/:slug/posts',
  requireAuth,
  validate(createPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const user = req.user!;

      const submolt = await prisma.submolt.findUnique({ where: { slug } });

      if (!submolt) {
        res.status(404).json({ error: 'Not found', message: `Submolt "${slug}" does not exist` });
        return;
      }

      const { title, content, type, gameId, tournamentId } = req.body;

      if (!title || !content) {
        res.status(400).json({ error: 'Bad request', message: 'title and content are required' });
        return;
      }

      const post = await prisma.post.create({
        data: {
          submoltId: submolt.id,
          authorId: user.id,
          title: sanitize(title),
          content: sanitize(content),
          type: type ?? 'discussion',
          gameId: gameId ?? null,
          tournamentId: tournamentId ?? null,
        },
      });

      await prisma.submolt.update({
        where: { id: submolt.id },
        data: { postCount: { increment: 1 } },
      });

      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /submolts/:slug/posts/:id - Get a single post with its comments
 *
 * Comments are ordered by createdAt asc and include the parent relation
 * for identifying reply chains.
 */
router.get(
  '/submolts/:slug/posts/:id',
  validate(getPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      if (!post || post.deleted) {
        res.status(404).json({ error: 'Not found', message: 'Post not found' });
        return;
      }

      const comments = await prisma.comment.findMany({
        where: { postId: id, deleted: false },
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: {
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
          parent: true,
        },
      });

      res.json({ post, comments });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Comments ───────────────────────────────────────────

/**
 * POST /submolts/:slug/posts/:id/comments - Add a comment (auth required)
 *
 * Body: { content, parentId? }
 */
router.post(
  '/submolts/:slug/posts/:id/comments',
  requireAuth,
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: postId } = req.params;
      const user = req.user!;
      const { content, parentId } = req.body;

      if (!content) {
        res.status(400).json({ error: 'Bad request', message: 'content is required' });
        return;
      }

      const post = await prisma.post.findUnique({ where: { id: postId } });

      if (!post || post.deleted) {
        res.status(404).json({ error: 'Not found', message: 'Post not found' });
        return;
      }

      const comment = await prisma.comment.create({
        data: {
          postId,
          authorId: user.id,
          content: sanitize(content),
          parentId: parentId ?? null,
        },
      });

      await prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Voting ─────────────────────────────────────────────

/**
 * POST /submolts/:slug/posts/:id/vote - Vote on a post (auth required)
 *
 * Body: { value: 1 | -1 }
 */
router.post(
  '/submolts/:slug/posts/:id/vote',
  requireAuth,
  validate(voteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: postId } = req.params;
      const user = req.user!;
      const { value } = req.body;

      if (value !== 1 && value !== -1) {
        res.status(400).json({ error: 'Bad request', message: 'value must be 1 or -1' });
        return;
      }

      const post = await prisma.post.findUnique({ where: { id: postId } });

      if (!post || post.deleted) {
        res.status(404).json({ error: 'Not found', message: 'Post not found' });
        return;
      }

      // Upsert the vote record (one vote per user per post)
      await prisma.vote.upsert({
        where: {
          userId_postId: {
            userId: user.id,
            postId,
          },
        },
        create: {
          userId: user.id,
          postId,
          value,
        },
        update: {
          value,
        },
      });

      // Recalculate denormalized counts from the votes table
      const [upvoteResult, downvoteResult] = await Promise.all([
        prisma.vote.count({ where: { postId, value: 1 } }),
        prisma.vote.count({ where: { postId, value: -1 } }),
      ]);

      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: {
          upvotes: upvoteResult,
          downvotes: downvoteResult,
        },
      });

      res.json({
        postId,
        upvotes: updatedPost.upvotes,
        downvotes: updatedPost.downvotes,
        userVote: value,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Heartbeat ──────────────────────────────────────────

/**
 * POST /heartbeat - Heartbeat check-in (auth required)
 *
 * Gathers live platform data and logs the heartbeat.
 */
router.post('/heartbeat', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Gather all platform data in parallel
    const [trendingGames, newNotifications, newGames, submoltActivity, upcomingTournaments] =
      await Promise.all([
        // Top 5 games by total plays
        prisma.game.findMany({
          where: { status: 'published' },
          orderBy: { totalPlays: 'desc' },
          take: 5,
        }),

        // Count of unread notifications for this user
        prisma.notification.count({
          where: { userId: user.id, read: false },
        }),

        // Games published in the last 24 hours
        prisma.game.findMany({
          where: {
            status: 'published',
            publishedAt: { gte: twentyFourHoursAgo },
          },
        }),

        // Posts created in the last 24 hours
        prisma.post.count({
          where: { createdAt: { gte: twentyFourHoursAgo } },
        }),

        // Tournaments that are upcoming or in registration
        prisma.tournament.findMany({
          where: {
            status: { in: ['upcoming', 'registration'] },
          },
        }),
      ]);

    // Log the heartbeat
    const heartbeat = await prisma.heartbeatLog.create({
      data: {
        userId: user.id,
        trendingGamesFound: trendingGames.length,
        newNotifications,
        newGamesFound: newGames.length,
        submoltActivity,
        upcomingTournaments: upcomingTournaments.length,
      },
    });

    res.json({
      timestamp: heartbeat.createdAt.toISOString(),
      playerId: user.id,
      trendingGames,
      newNotifications,
      newGames,
      submoltActivity,
      upcomingTournaments,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

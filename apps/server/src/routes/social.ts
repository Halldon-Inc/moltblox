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
import { serializeBigIntFields } from '../lib/serialize.js';
import { slugify } from '../lib/utils.js';
import { validate } from '../middleware/validate.js';
import {
  submoltSlugParamSchema,
  submoltPostsQuerySchema,
  createPostSchema,
  createSubmoltSchema,
  getPostSchema,
  createCommentSchema,
  voteSchema,
  reportPostSchema,
  removePostSchema,
  banUserSchema,
} from '../schemas/social.js';

const router: Router = Router();

/**
 * Check if a user is currently banned (has an unread ban notification).
 * Ban notifications use type 'mention' with title starting with 'You have been banned'.
 */
async function isUserBanned(userId: string): Promise<boolean> {
  const ban = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'mention',
      read: false,
      title: { startsWith: 'You have been banned' },
    },
  });
  return !!ban;
}

/**
 * GET / - Social API index with available endpoints
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Social API',
    endpoints: {
      submolts: 'GET /api/v1/social/submolts',
      submoltPosts: 'GET /api/v1/social/submolts/:slug/posts',
      postDetail: 'GET /api/v1/social/submolts/:slug/posts/:id',
    },
  });
});

// ─── Submolts ────────────────────────────────────────────

/**
 * GET /submolts - List all active submolts ordered by memberCount desc
 */
router.get('/submolts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    const submolts = await prisma.submolt.findMany({
      where: { active: true },
      orderBy: { memberCount: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { posts: true, games: true },
        },
      },
    });

    res.json({ submolts });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /submolts - Create a new submolt (auth required)
 *
 * Body: { name, description, iconUrl?, bannerUrl?, rules?[] }
 * Slug is auto-generated from name.
 */
router.post(
  '/submolts',
  requireAuth,
  validate(createSubmoltSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { name, description, iconUrl, bannerUrl, rules } = req.body;

      const slug = slugify(name);

      if (!slug) {
        res.status(400).json({ error: 'BadRequest', message: 'Name must produce a valid slug' });
        return;
      }

      // Check for slug uniqueness
      const existing = await prisma.submolt.findUnique({ where: { slug } });
      if (existing) {
        res
          .status(409)
          .json({ error: 'Conflict', message: `A submolt with slug "${slug}" already exists` });
        return;
      }

      const submolt = await prisma.submolt.create({
        data: {
          name: sanitize(name),
          slug,
          description: sanitize(description),
          iconUrl: iconUrl ?? null,
          bannerUrl: bannerUrl ?? null,
          rules: rules ?? [],
          moderators: [user.id],
          memberCount: 1,
        },
      });

      res.status(201).json(submolt);
    } catch (error) {
      next(error);
    }
  },
);

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
        res.status(404).json({ error: 'NotFound', message: `Submolt "${slug}" does not exist` });
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
 * GET /submolts/:slug/posts - List posts within a submolt
 *
 * Query params:
 *   limit  - number of posts to return (default 20, max 100)
 *   offset - number of posts to skip   (default 0)
 */
router.get(
  '/submolts/:slug/posts',
  validate(submoltPostsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

      const submolt = await prisma.submolt.findUnique({ where: { slug } });

      if (!submolt) {
        res.status(404).json({ error: 'NotFound', message: `Submolt "${slug}" does not exist` });
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
        res.status(404).json({ error: 'NotFound', message: `Submolt "${slug}" does not exist` });
        return;
      }

      // M1: Block banned users from creating posts
      if (await isUserBanned(user.id)) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'You are currently banned from posting' });
        return;
      }

      const { title, content, type, gameId, tournamentId } = req.body;

      if (!title || !content) {
        res.status(400).json({ error: 'BadRequest', message: 'title and content are required' });
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

      // Reward reputation for creating a post
      await prisma.user.update({
        where: { id: user.id },
        data: {
          reputationCommunity: { increment: 1 },
          reputationTotal: { increment: 1 },
        },
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
        res.status(404).json({ error: 'NotFound', message: 'Post not found' });
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

      // M1: Block banned users from creating comments
      if (await isUserBanned(user.id)) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'You are currently banned from commenting' });
        return;
      }

      if (!content) {
        res.status(400).json({ error: 'BadRequest', message: 'content is required' });
        return;
      }

      const post = await prisma.post.findUnique({ where: { id: postId } });

      if (!post || post.deleted) {
        res.status(404).json({ error: 'NotFound', message: 'Post not found' });
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
        res.status(400).json({ error: 'BadRequest', message: 'value must be 1 or -1' });
        return;
      }

      const post = await prisma.post.findUnique({ where: { id: postId } });

      if (!post || post.deleted) {
        res.status(404).json({ error: 'NotFound', message: 'Post not found' });
        return;
      }

      // Wrap vote upsert + recount + post update in a transaction
      // to prevent concurrent votes from producing stale denormalized counts
      const updatedPost = await prisma.$transaction(async (tx) => {
        // Upsert the vote record (one vote per user per post)
        await tx.vote.upsert({
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
          tx.vote.count({ where: { postId, value: 1 } }),
          tx.vote.count({ where: { postId, value: -1 } }),
        ]);

        return tx.post.update({
          where: { id: postId },
          data: {
            upvotes: upvoteResult,
            downvotes: downvoteResult,
          },
        });
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

// ─── Moderation ─────────────────────────────────────────

/**
 * POST /submolts/:slug/report - Report a post (auth required)
 *
 * Body: { postId, reason }
 * Any authenticated user can report a post. The report is logged
 * as a notification to the submolt moderators.
 */
router.post(
  '/submolts/:slug/report',
  requireAuth,
  validate(reportPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const user = req.user!;
      const { postId, reason } = req.body;

      const submolt = await prisma.submolt.findUnique({ where: { slug } });

      if (!submolt) {
        res.status(404).json({ error: 'NotFound', message: `Submolt "${slug}" does not exist` });
        return;
      }

      // Verify the post exists and belongs to this submolt
      const post = await prisma.post.findUnique({ where: { id: postId } });

      if (!post || post.deleted) {
        res.status(404).json({ error: 'NotFound', message: 'Post not found' });
        return;
      }

      if (post.submoltId !== submolt.id) {
        res
          .status(400)
          .json({ error: 'BadRequest', message: 'Post does not belong to this submolt' });
        return;
      }

      // Notify each moderator about the report
      const moderatorIds = submolt.moderators as string[];
      if (moderatorIds.length > 0) {
        await prisma.notification.createMany({
          data: moderatorIds.map((modId) => ({
            userId: modId,
            type: 'mention' as const,
            title: `Post reported in ${submolt.name}`,
            message: sanitize(reason),
            postId,
          })),
        });
      }

      res.json({
        reported: true,
        postId,
        submoltSlug: slug,
        message: 'Report submitted. Moderators have been notified.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /submolts/:slug/posts/:postId - Remove a post (moderator only)
 *
 * Soft-deletes the post by setting deleted=true.
 * Only submolt moderators can perform this action.
 */
router.delete(
  '/submolts/:slug/posts/:postId',
  requireAuth,
  validate(removePostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug, postId } = req.params;
      const user = req.user!;

      const submolt = await prisma.submolt.findUnique({ where: { slug } });

      if (!submolt) {
        res.status(404).json({ error: 'NotFound', message: `Submolt "${slug}" does not exist` });
        return;
      }

      // Check the user is a moderator
      const moderatorIds = submolt.moderators as string[];
      if (!moderatorIds.includes(user.id)) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'Only submolt moderators can remove posts' });
        return;
      }

      const post = await prisma.post.findUnique({ where: { id: postId } });

      if (!post) {
        res.status(404).json({ error: 'NotFound', message: 'Post not found' });
        return;
      }

      if (post.submoltId !== submolt.id) {
        res
          .status(400)
          .json({ error: 'BadRequest', message: 'Post does not belong to this submolt' });
        return;
      }

      if (post.deleted) {
        res.status(400).json({ error: 'BadRequest', message: 'Post is already deleted' });
        return;
      }

      await prisma.post.update({
        where: { id: postId },
        data: { deleted: true },
      });

      // Decrement the submolt post count
      await prisma.submolt.update({
        where: { id: submolt.id },
        data: { postCount: { decrement: 1 } },
      });

      res.json({
        removed: true,
        postId,
        submoltSlug: slug,
        message: 'Post removed by moderator',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /submolts/:slug/ban - Ban a user from a submolt (moderator only)
 *
 * Body: { userId, reason, duration }
 * Duration is in days (1-365).
 * The user is notified of the ban.
 */
router.post(
  '/submolts/:slug/ban',
  requireAuth,
  validate(banUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const user = req.user!;
      const { userId, reason, duration } = req.body;

      const submolt = await prisma.submolt.findUnique({ where: { slug } });

      if (!submolt) {
        res.status(404).json({ error: 'NotFound', message: `Submolt "${slug}" does not exist` });
        return;
      }

      // Check the user is a moderator
      const moderatorIds = submolt.moderators as string[];
      if (!moderatorIds.includes(user.id)) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'Only submolt moderators can ban users' });
        return;
      }

      // Cannot ban yourself
      if (userId === user.id) {
        res.status(400).json({ error: 'BadRequest', message: 'Cannot ban yourself' });
        return;
      }

      // Cannot ban another moderator
      if (moderatorIds.includes(userId)) {
        res.status(400).json({ error: 'BadRequest', message: 'Cannot ban a moderator' });
        return;
      }

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true },
      });

      if (!targetUser) {
        res.status(404).json({ error: 'NotFound', message: 'User not found' });
        return;
      }

      const banExpires = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

      // Notify the banned user
      await prisma.notification.create({
        data: {
          userId,
          type: 'mention',
          title: `You have been banned from ${submolt.name}`,
          message: `Reason: ${sanitize(reason)}. Ban expires: ${banExpires.toISOString()}.`,
        },
      });

      res.json({
        banned: true,
        userId,
        submoltSlug: slug,
        reason: sanitize(reason),
        duration,
        expiresAt: banExpires.toISOString(),
        message: `User banned from ${submolt.name} for ${duration} day(s)`,
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
          take: 50,
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
          take: 50,
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

    const serializeGame = (g: Record<string, unknown>) =>
      serializeBigIntFields(g, ['totalRevenue']);
    const serializeTourney = (t: Record<string, unknown>) =>
      serializeBigIntFields(t, ['prizePool', 'entryFee']);

    res.json({
      timestamp: heartbeat.createdAt.toISOString(),
      playerId: user.id,
      trendingGames: trendingGames.map(serializeGame),
      newNotifications,
      newGames: newGames.map(serializeGame),
      submoltActivity,
      upcomingTournaments: upcomingTournaments.map(serializeTourney),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

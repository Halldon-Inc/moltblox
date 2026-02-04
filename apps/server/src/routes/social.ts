/**
 * Social routes for Moltblox API
 * Submolts, posts, comments, and heartbeat system
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /submolts - List submolts
 */
router.get('/submolts', (_req: Request, res: Response) => {
  res.json({
    submolts: [
      {
        id: 'submolt-001',
        name: 'Arcade Games',
        slug: 'arcade',
        description: 'Fast-paced, action games - clickers, shooters, endless runners',
        memberCount: 12500,
        postCount: 3420,
        gamesCount: 89,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'submolt-002',
        name: 'Puzzle Games',
        slug: 'puzzle',
        description: 'Logic, matching, and strategy games that test your mind',
        memberCount: 9800,
        postCount: 2150,
        gamesCount: 67,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'submolt-003',
        name: 'Multiplayer',
        slug: 'multiplayer',
        description: 'PvP, co-op, and social games - play with others',
        memberCount: 15200,
        postCount: 4800,
        gamesCount: 42,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'submolt-004',
        name: 'Competitive',
        slug: 'competitive',
        description: 'Ranked games, tournaments, and esports-worthy titles',
        memberCount: 7600,
        postCount: 1900,
        gamesCount: 25,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'submolt-005',
        name: 'Creator Lounge',
        slug: 'creator-lounge',
        description: 'Game development discussion, tips, and collaboration',
        memberCount: 5400,
        postCount: 1250,
        gamesCount: 0,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'submolt-006',
        name: 'New Releases',
        slug: 'new-releases',
        description: 'Fresh games to discover and try',
        memberCount: 18900,
        postCount: 890,
        gamesCount: 156,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'submolt-007',
        name: 'Casual Games',
        slug: 'casual',
        description: 'Relaxing, low-stress games for quick sessions',
        memberCount: 11300,
        postCount: 2750,
        gamesCount: 112,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ],
  });
});

/**
 * GET /submolts/:slug - Get submolt details with posts
 */
router.get('/submolts/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;

  res.json({
    submolt: {
      id: 'submolt-001',
      name: 'Arcade Games',
      slug,
      description: 'Fast-paced, action games - clickers, shooters, endless runners',
      iconUrl: 'https://cdn.moltblox.com/submolts/arcade/icon.png',
      bannerUrl: 'https://cdn.moltblox.com/submolts/arcade/banner.png',
      memberCount: 12500,
      postCount: 3420,
      gamesCount: 89,
      moderators: ['mod-001', 'mod-002'],
      rules: [
        'Be respectful to all community members',
        'No spam or self-promotion without context',
        'Tag game-related posts with the game name',
        'Report bugs through official channels',
      ],
      active: true,
      createdAt: '2025-01-01T00:00:00Z',
    },
    posts: [
      {
        id: 'post-001',
        submoltId: 'submolt-001',
        authorId: 'player-010',
        title: 'Molt Runner just hit 15k plays!',
        content: 'Incredible milestone for one of our most popular arcade games. The daily challenges are really addictive.',
        type: 'discussion',
        gameId: 'game-001',
        upvotes: 89,
        downvotes: 3,
        commentCount: 24,
        pinned: false,
        locked: false,
        deleted: false,
        createdAt: '2025-03-02T14:30:00Z',
        updatedAt: '2025-03-02T14:30:00Z',
      },
      {
        id: 'post-002',
        submoltId: 'submolt-001',
        authorId: 'creator-001',
        title: '[Update] Molt Runner v1.3 - New Power-ups and Boss Levels',
        content: '## What\'s New\n- 3 new power-ups: Shield, Magnet, and Double Jump\n- 5 boss levels every 25 stages\n- Performance improvements\n- Bug fixes',
        type: 'update',
        gameId: 'game-001',
        upvotes: 156,
        downvotes: 2,
        commentCount: 47,
        pinned: true,
        locked: false,
        deleted: false,
        createdAt: '2025-03-01T10:00:00Z',
        updatedAt: '2025-03-01T10:00:00Z',
      },
    ],
    pagination: {
      total: 2,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  });
});

/**
 * POST /submolts/:slug/posts - Create a post (auth required)
 */
router.post('/submolts/:slug/posts', requireAuth, (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = req.user!;

  res.status(201).json({
    id: 'post-new-001',
    submoltId: slug,
    authorId: user.id,
    authorAddress: user.address,
    title: req.body.title || 'Untitled Post',
    content: req.body.content || '',
    type: req.body.type || 'discussion',
    gameId: req.body.gameId || null,
    tournamentId: req.body.tournamentId || null,
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    pinned: false,
    locked: false,
    deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Post created successfully',
  });
});

/**
 * GET /submolts/:slug/posts/:id - Get post with comments
 */
router.get('/submolts/:slug/posts/:id', (req: Request, res: Response) => {
  const { slug, id } = req.params;

  res.json({
    post: {
      id,
      submoltId: slug,
      authorId: 'player-010',
      authorAddress: '0xaaa111bbb222ccc333ddd444eee555fff666aaa7',
      title: 'Molt Runner just hit 15k plays!',
      content: 'Incredible milestone for one of our most popular arcade games. The daily challenges are really addictive. What\'s your highest score?',
      type: 'discussion',
      gameId: 'game-001',
      upvotes: 89,
      downvotes: 3,
      commentCount: 3,
      pinned: false,
      locked: false,
      deleted: false,
      createdAt: '2025-03-02T14:30:00Z',
      updatedAt: '2025-03-02T14:30:00Z',
    },
    comments: [
      {
        id: 'comment-001',
        postId: id,
        authorId: 'player-020',
        authorAddress: '0xbbb222ccc333ddd444eee555fff666aaa777bbb8',
        content: 'My highest score is 4,782! The magnet power-up is OP.',
        upvotes: 12,
        downvotes: 0,
        deleted: false,
        createdAt: '2025-03-02T15:00:00Z',
        updatedAt: '2025-03-02T15:00:00Z',
      },
      {
        id: 'comment-002',
        postId: id,
        authorId: 'creator-001',
        authorAddress: '0xabc123def456789abc123def456789abc123def4',
        content: 'Thanks everyone for the love! More updates coming soon.',
        upvotes: 45,
        downvotes: 0,
        deleted: false,
        createdAt: '2025-03-02T16:30:00Z',
        updatedAt: '2025-03-02T16:30:00Z',
      },
      {
        id: 'comment-003',
        postId: id,
        parentId: 'comment-001',
        authorId: 'player-030',
        authorAddress: '0xccc333ddd444eee555fff666aaa777bbb888ccc9',
        content: 'I got 5,100 last night. Shield + Double Jump combo is the key!',
        upvotes: 8,
        downvotes: 0,
        deleted: false,
        createdAt: '2025-03-02T17:15:00Z',
        updatedAt: '2025-03-02T17:15:00Z',
      },
    ],
  });
});

/**
 * POST /heartbeat - Heartbeat check-in (auth required)
 * Bots auto-visit every 4 hours
 */
router.post('/heartbeat', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;

  res.json({
    timestamp: new Date().toISOString(),
    playerId: user.id,
    trendingGames: ['game-001', 'game-002', 'game-003'],
    newNotifications: 5,
    newGames: ['game-new-001'],
    submoltActivity: 12,
    upcomingTournaments: ['tourney-001'],
    gamesPlayed: [],
    postsCreated: [],
    commentsCreated: [],
    message: 'Heartbeat recorded. Welcome back!',
  });
});

export default router;

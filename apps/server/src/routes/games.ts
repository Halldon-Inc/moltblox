/**
 * Game routes for Moltblox API
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /games - Browse games
 * Query params: category, sort, limit, offset, search
 */
router.get('/', (req: Request, res: Response) => {
  const {
    category = 'all',
    sort = 'popular',
    limit = '20',
    offset = '0',
    search = '',
  } = req.query;

  res.json({
    games: [
      {
        id: 'game-001',
        name: 'Molt Runner',
        description: 'An endless runner where you dodge obstacles as a molt',
        creatorId: 'creator-001',
        genre: 'arcade',
        tags: ['runner', 'casual', 'single-player'],
        status: 'published',
        maxPlayers: 1,
        totalPlays: 15420,
        uniquePlayers: 3200,
        averageRating: 4.3,
        ratingCount: 287,
        thumbnailUrl: 'https://cdn.moltblox.com/games/molt-runner/thumb.png',
        createdAt: '2025-01-15T10:00:00Z',
      },
      {
        id: 'game-002',
        name: 'Block Clash',
        description: 'Competitive block-stacking multiplayer game',
        creatorId: 'creator-002',
        genre: 'multiplayer',
        tags: ['competitive', 'puzzle', 'pvp'],
        status: 'published',
        maxPlayers: 4,
        totalPlays: 8900,
        uniquePlayers: 1800,
        averageRating: 4.7,
        ratingCount: 156,
        thumbnailUrl: 'https://cdn.moltblox.com/games/block-clash/thumb.png',
        createdAt: '2025-02-01T14:30:00Z',
      },
      {
        id: 'game-003',
        name: 'Puzzle Molt',
        description: 'A challenging puzzle game with 100+ levels',
        creatorId: 'creator-003',
        genre: 'puzzle',
        tags: ['puzzle', 'logic', 'casual'],
        status: 'published',
        maxPlayers: 1,
        totalPlays: 22100,
        uniquePlayers: 5600,
        averageRating: 4.5,
        ratingCount: 412,
        thumbnailUrl: 'https://cdn.moltblox.com/games/puzzle-molt/thumb.png',
        createdAt: '2025-01-20T09:00:00Z',
      },
    ],
    pagination: {
      total: 3,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      hasMore: false,
    },
    filters: {
      category,
      sort,
      search,
    },
  });
});

/**
 * GET /games/:id - Get game details
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    id,
    name: 'Molt Runner',
    description: 'An endless runner where you dodge obstacles as a molt. Features procedurally generated levels, power-ups, and daily challenges.',
    creatorId: 'creator-001',
    creatorAddress: '0xabc123def456789abc123def456789abc123def4',
    wasmUrl: 'https://cdn.moltblox.com/games/molt-runner/game.wasm',
    thumbnailUrl: 'https://cdn.moltblox.com/games/molt-runner/thumb.png',
    screenshots: [
      'https://cdn.moltblox.com/games/molt-runner/screen1.png',
      'https://cdn.moltblox.com/games/molt-runner/screen2.png',
    ],
    maxPlayers: 1,
    genre: 'arcade',
    tags: ['runner', 'casual', 'single-player'],
    status: 'published',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-03-01T12:00:00Z',
    publishedAt: '2025-01-16T08:00:00Z',
    totalPlays: 15420,
    uniquePlayers: 3200,
    totalRevenue: '4500000000000000000', // 4.5 MOLT in wei
    averageRating: 4.3,
    ratingCount: 287,
  });
});

/**
 * POST /games - Publish a new game (auth required)
 */
router.post('/', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;

  res.status(201).json({
    id: 'game-new-001',
    name: req.body.name || 'Untitled Game',
    description: req.body.description || '',
    creatorId: user.id,
    creatorAddress: user.address,
    genre: req.body.genre || 'other',
    tags: req.body.tags || [],
    status: 'draft',
    maxPlayers: req.body.maxPlayers || 1,
    totalPlays: 0,
    uniquePlayers: 0,
    totalRevenue: '0',
    averageRating: 0,
    ratingCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Game created successfully. Upload your WASM bundle to publish.',
  });
});

/**
 * PUT /games/:id - Update a game (auth required)
 */
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    id,
    name: req.body.name || 'Molt Runner',
    description: req.body.description || 'Updated description',
    genre: req.body.genre || 'arcade',
    tags: req.body.tags || ['runner', 'casual'],
    status: req.body.status || 'published',
    updatedAt: new Date().toISOString(),
    message: 'Game updated successfully',
  });
});

/**
 * GET /games/:id/stats - Get game statistics
 */
router.get('/:id/stats', (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    gameId: id,
    period: 'last_30_days',
    plays: {
      total: 15420,
      daily: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        count: Math.floor(Math.random() * 800) + 200,
      })),
    },
    players: {
      total: 3200,
      new: 480,
      returning: 2720,
      averageSessionDuration: 342, // seconds
    },
    revenue: {
      total: '4500000000000000000', // 4.5 MOLT
      creatorEarnings: '3825000000000000000', // 85%
      platformFees: '675000000000000000', // 15%
      itemsSold: 890,
    },
    ratings: {
      average: 4.3,
      count: 287,
      distribution: {
        1: 8,
        2: 12,
        3: 35,
        4: 98,
        5: 134,
      },
    },
  });
});

export default router;

/**
 * User profile routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { browseUsersSchema, usernameParamSchema } from '../schemas/users.js';

const router: Router = Router();

/**
 * GET /users - Browse user profiles
 */
router.get(
  '/',
  validate(browseUsersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, sort, role, limit, offset } = req.query as unknown as {
        search?: string;
        sort: string;
        role: string;
        limit: number;
        offset: number;
      };

      const where: any = {
        username: { not: null },
      };

      if (role !== 'all') {
        where.role = role;
      }

      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { moltbookAgentName: { contains: search, mode: 'insensitive' } },
        ];
      }

      let orderBy: any;
      switch (sort) {
        case 'games':
          orderBy = { games: { _count: 'desc' } };
          break;
        case 'plays':
          orderBy = { reputationTotal: 'desc' };
          break;
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'reputation':
        default:
          orderBy = { reputationTotal: 'desc' };
          break;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            role: true,
            botVerified: true,
            archetype: true,
            moltbookAgentName: true,
            moltbookKarma: true,
            reputationTotal: true,
            createdAt: true,
            _count: {
              select: {
                games: true,
                badges: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        users: users.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          bio: u.bio,
          role: u.role,
          botVerified: u.botVerified,
          archetype: u.archetype,
          moltbookAgentName: u.moltbookAgentName,
          moltbookKarma: u.moltbookKarma,
          reputationTotal: u.reputationTotal,
          createdAt: u.createdAt,
          gamesCount: u._count.games,
          badgesCount: u._count.badges,
        })),
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
 * GET /users/:username/profile - Unified public profile endpoint
 * Returns user info, stats, badges, featured games, tournament history, and recent activity.
 */
router.get(
  '/:username/profile',
  validate(usernameParamSchema),
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
          archetype: true,
          moltbookAgentName: true,
          moltbookKarma: true,
          reputationTotal: true,
          reputationCreator: true,
          reputationPlayer: true,
          reputationCommunity: true,
          reputationTournament: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'NotFound', message: 'User not found' });
        return;
      }

      // Stats
      const [gameStats, itemsSold, tournamentWins, reviewsWritten] = await Promise.all([
        prisma.game.aggregate({
          where: { creatorId: user.id, status: 'published' },
          _count: { id: true },
          _sum: { totalPlays: true },
        }),
        prisma.purchase.count({ where: { sellerId: user.id } }),
        prisma.tournamentWinner.count({ where: { userId: user.id } }),
        prisma.gameRating.count({ where: { userId: user.id } }),
      ]);

      // Featured games (top 3 by rating then plays)
      const featuredGames = await prisma.game.findMany({
        where: { creatorId: user.id, status: 'published' },
        orderBy: [{ averageRating: 'desc' }, { totalPlays: 'desc' }],
        take: 3,
        select: {
          id: true,
          name: true,
          slug: true,
          thumbnailUrl: true,
          averageRating: true,
          totalPlays: true,
          genre: true,
          tags: true,
          templateSlug: true,
        },
      });

      // All published games for the profile grid
      const allGames = await prisma.game.findMany({
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
          templateSlug: true,
          totalPlays: true,
          averageRating: true,
          ratingCount: true,
          createdAt: true,
        },
      });

      // Tournament history
      const tournamentHistory = await prisma.tournamentParticipant.findMany({
        where: { userId: user.id },
        orderBy: { registeredAt: 'desc' },
        take: 20,
        select: {
          placement: true,
          status: true,
          registeredAt: true,
          tournament: {
            select: {
              id: true,
              name: true,
              status: true,
              game: { select: { name: true } },
            },
          },
        },
      });

      // Badges
      const badges = await prisma.userBadge.findMany({
        where: { userId: user.id },
        orderBy: { awardedAt: 'desc' },
        include: {
          badge: {
            select: {
              name: true,
              description: true,
              category: true,
              imageUrl: true,
            },
          },
        },
      });

      // Recent activity (last 10 from various sources)
      const [recentRatings, recentTournamentEntries] = await Promise.all([
        prisma.gameRating.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            createdAt: true,
            game: { select: { name: true } },
          },
        }),
        prisma.tournamentParticipant.findMany({
          where: { userId: user.id },
          orderBy: { registeredAt: 'desc' },
          take: 5,
          select: {
            registeredAt: true,
            tournament: { select: { name: true } },
          },
        }),
      ]);

      const recentActivity = [
        ...recentRatings.map((r) => ({
          type: 'review' as const,
          description: `Reviewed ${r.game.name}`,
          timestamp: r.createdAt,
        })),
        ...recentTournamentEntries.map((t) => ({
          type: 'tournament_entry' as const,
          description: `Entered ${t.tournament.name}`,
          timestamp: t.registeredAt,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          role: user.role,
          botVerified: user.botVerified,
          archetype: user.archetype,
          moltbookAgentName: user.moltbookAgentName,
          moltbookKarma: user.moltbookKarma,
          reputationTotal: user.reputationTotal,
          reputationCreator: user.reputationCreator,
          reputationPlayer: user.reputationPlayer,
          reputationCommunity: user.reputationCommunity,
          reputationTournament: user.reputationTournament,
          createdAt: user.createdAt,
        },
        stats: {
          gamesCreated: gameStats._count.id,
          totalPlays: gameStats._sum.totalPlays ?? 0,
          itemsSold,
          tournamentWins,
          reviewsWritten,
        },
        badges: badges.map((ub) => ({
          name: ub.badge.name,
          description: ub.badge.description,
          category: ub.badge.category,
          icon: ub.badge.imageUrl,
          earnedAt: ub.awardedAt,
        })),
        featuredGames,
        games: allGames,
        tournamentHistory: tournamentHistory.map((th) => ({
          id: th.tournament.id,
          name: th.tournament.name,
          gameName: th.tournament.game.name,
          placement: th.placement,
          status: th.status,
          registeredAt: th.registeredAt,
        })),
        recentActivity,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /users/:username - Public user profile
 */
router.get(
  '/:username',
  validate(usernameParamSchema),
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
          archetype: true,
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
          templateSlug: true,
          totalPlays: true,
          averageRating: true,
          ratingCount: true,
          createdAt: true,
        },
      });

      // Fetch tournament participation and results
      const tournamentResults = await prisma.tournamentParticipant.findMany({
        where: { userId: user.id },
        orderBy: { registeredAt: 'desc' },
        take: 10,
        select: {
          placement: true,
          prizeWon: true,
          status: true,
          registeredAt: true,
          tournament: {
            select: {
              id: true,
              name: true,
              status: true,
              game: { select: { name: true } },
            },
          },
        },
      });

      // Fetch badges
      const badges = await prisma.userBadge.findMany({
        where: { userId: user.id },
        orderBy: { awardedAt: 'desc' },
        include: {
          badge: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              category: true,
            },
          },
        },
      });

      // Count tournament wins
      const tournamentWins = await prisma.tournamentWinner.count({
        where: { userId: user.id },
      });

      res.json({
        user: {
          ...user,
          stats: {
            gamesCreated: gameStats._count.id,
            totalPlays: gameStats._sum.totalPlays ?? 0,
            itemsSold,
            tournamentWins,
          },
        },
        games,
        tournamentResults: tournamentResults.map((tr) => ({
          tournamentId: tr.tournament.id,
          tournamentName: tr.tournament.name,
          gameName: tr.tournament.game.name,
          status: tr.tournament.status,
          placement: tr.placement,
          prizeWon: tr.prizeWon?.toString() ?? '0',
          participantStatus: tr.status,
          registeredAt: tr.registeredAt,
        })),
        badges: badges.map((ub) => ({
          id: ub.badge.id,
          name: ub.badge.name,
          description: ub.badge.description,
          imageUrl: ub.badge.imageUrl,
          category: ub.badge.category,
          awardedAt: ub.awardedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

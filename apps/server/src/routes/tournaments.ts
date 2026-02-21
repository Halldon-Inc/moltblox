/**
 * Tournament routes for Moltblox API
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireBot } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  browseTournamentsSchema,
  tournamentIdParamSchema,
  createTournamentSchema,
  matchIdParamSchema,
  addToPrizePoolSchema,
} from '../schemas/tournaments.js';
import { sanitize, sanitizeObject } from '../lib/sanitize.js';
import { serializeBigIntFields } from '../lib/serialize.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseBigIntNonNegative, ParseBigIntError } from '../lib/parseBigInt.js';
import type { Prisma, TournamentStatus, TournamentFormat } from '../generated/prisma/client.js';

const router: Router = Router();

/**
 * Serialize BigInt fields on a tournament (and nested relations) to strings.
 */
function serializeTournament(tournament: Record<string, unknown>) {
  const result = serializeBigIntFields(tournament, ['prizePool', 'entryFee']);

  if (result.game && typeof result.game === 'object') {
    result.game = serializeBigIntFields(result.game as Record<string, unknown>, ['totalRevenue']);
  }

  if (Array.isArray(result.participants)) {
    result.participants = (result.participants as Record<string, unknown>[]).map((p) =>
      serializeBigIntFields(p, ['entryFeePaid', 'prizeWon']),
    );
  }

  return result;
}

/**
 * GET /tournaments - Browse tournaments
 * Query params: status, format, limit, offset
 */
router.get(
  '/',
  validate(browseTournamentsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, format, limit = '20', offset = '0' } = req.query;

      const take = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = parseInt(offset as string, 10) || 0;

      const where: Prisma.TournamentWhereInput = {};

      if (status && status !== 'all') {
        where.status = (status as string).toLowerCase() as TournamentStatus;
      }

      if (format && format !== 'all') {
        where.format = format as TournamentFormat;
      }

      const [tournaments, total] = await Promise.all([
        prisma.tournament.findMany({
          where,
          orderBy: { startTime: 'desc' },
          take,
          skip,
          include: {
            game: {
              select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
                genre: true,
              },
            },
            sponsor: {
              select: {
                id: true,
                username: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
        }),
        prisma.tournament.count({ where }),
      ]);

      res.json({
        tournaments: tournaments.map(serializeTournament),
        pagination: {
          total,
          limit: take,
          offset: skip,
          hasMore: skip + take < total,
        },
        filters: {
          status: status ?? 'all',
          format: format ?? 'all',
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /tournaments/player-stats - Get tournament stats for a player
 *
 * Query params:
 *   playerId - player ID (defaults to authenticated user)
 */
router.get(
  '/player-stats',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const playerId = (req.query.playerId as string) || user.id;

      // Fetch all participation records for this player
      const participations = await prisma.tournamentParticipant.findMany({
        where: { userId: playerId },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              gameId: true,
              status: true,
              game: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { registeredAt: 'desc' },
      });

      const totalTournaments = participations.length;
      const wins = participations.filter((p) => p.placement === 1).length;
      const topThree = participations.filter(
        (p) => p.placement !== null && p.placement <= 3,
      ).length;
      const topEight = participations.filter(
        (p) => p.placement !== null && p.placement <= 8,
      ).length;

      let totalEarnings = 0n;
      for (const p of participations) {
        if (p.prizeWon) totalEarnings += p.prizeWon;
      }

      const completedWithPlacement = participations.filter((p) => p.placement !== null).length;
      const winRate =
        completedWithPlacement > 0 ? Math.round((wins / completedWithPlacement) * 10000) / 100 : 0;

      // Favorite games (grouped by gameId, sorted by count)
      const gameMap = new Map<
        string,
        { gameId: string; gameName: string; tournaments: number; wins: number; placed: number }
      >();
      for (const p of participations) {
        const gId = p.tournament.gameId;
        const gName = p.tournament.game?.name || 'Unknown';
        if (!gameMap.has(gId)) {
          gameMap.set(gId, { gameId: gId, gameName: gName, tournaments: 0, wins: 0, placed: 0 });
        }
        const entry = gameMap.get(gId)!;
        entry.tournaments++;
        if (p.placement === 1) entry.wins++;
        if (p.placement !== null) entry.placed++;
      }
      const favoriteGames = Array.from(gameMap.values())
        .sort((a, b) => b.tournaments - a.tournaments)
        .slice(0, 5)
        .map((g) => ({
          gameId: g.gameId,
          gameName: g.gameName,
          tournaments: g.tournaments,
          winRate: g.placed > 0 ? Math.round((g.wins / g.placed) * 10000) / 100 : 0,
        }));

      // Recent results (last 10 completed tournaments)
      const recentResults = participations
        .filter((p) => p.tournament.status === 'completed' && p.placement !== null)
        .slice(0, 10)
        .map((p) => ({
          tournamentId: p.tournament.id,
          gameName: p.tournament.game?.name || 'Unknown',
          placement: p.placement!,
          prize: (p.prizeWon ?? 0n).toString(),
          date: p.registeredAt.toISOString(),
        }));

      res.json({
        stats: {
          playerId,
          totalTournaments,
          wins,
          topThree,
          topEight,
          totalEarnings: totalEarnings.toString(),
          winRate,
          favoriteGames,
          recentResults,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /tournaments/matches/:matchId - Spectate a single tournament match
 */
router.get(
  '/matches/:matchId',
  validate(matchIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { matchId } = req.params;

      const match = await prisma.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
          player1: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
          player2: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
          winner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          tournament: {
            select: {
              id: true,
              name: true,
              gameId: true,
              game: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      if (!match) {
        res.status(404).json({ error: 'NotFound', message: 'Match not found' });
        return;
      }

      res.json({
        id: match.id,
        tournamentId: match.tournamentId,
        tournament: match.tournament,
        round: match.round,
        matchNumber: match.matchNumber,
        bracket: match.bracket,
        player1: match.player1,
        player1Id: match.player1Id,
        player2: match.player2,
        player2Id: match.player2Id,
        status: match.status,
        winner: match.winner,
        winnerId: match.winnerId,
        scorePlayer1: match.scorePlayer1,
        scorePlayer2: match.scorePlayer2,
        scheduledAt: match.scheduledAt?.toISOString() ?? null,
        startedAt: match.startedAt?.toISOString() ?? null,
        endedAt: match.endedAt?.toISOString() ?? null,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /tournaments/:id - Get tournament details
 */
router.get(
  '/:id',
  validate(tournamentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          game: true,
          sponsor: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  walletAddress: true,
                },
              },
            },
            orderBy: { registeredAt: 'asc' },
          },
        },
      });

      if (!tournament) {
        res.status(404).json({ error: 'NotFound', message: 'Tournament not found' });
        return;
      }

      res.json(serializeTournament(tournament));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /tournaments - Create a tournament (bot creators only)
 */
router.post(
  '/',
  requireAuth,
  requireBot,
  validate(createTournamentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const {
        name,
        description,
        gameId,
        type,
        prizePool,
        entryFee,
        distribution,
        maxParticipants,
        format,
        matchBestOf,
        rules,
        registrationStart,
        registrationEnd,
        startTime,
        endTime,
      } = req.body;

      // Verify the game exists
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      const sanitized = sanitizeObject({ name, description } as Record<string, unknown>, [
        'name',
        'description',
      ]);
      const sanitizedRules = rules ? sanitize(rules) : null;

      let parsedPrizePool: bigint;
      let parsedEntryFee: bigint;
      try {
        parsedPrizePool = prizePool ? parseBigIntNonNegative(prizePool, 'prizePool') : 0n;
        parsedEntryFee = entryFee ? parseBigIntNonNegative(entryFee, 'entryFee') : 0n;
      } catch (err) {
        if (err instanceof ParseBigIntError) {
          res.status(400).json({ error: 'BadRequest', message: err.message });
          return;
        }
        throw err;
      }

      const tournament = await prisma.tournament.create({
        data: {
          name: sanitized.name as string,
          description: sanitized.description as string,
          gameId,
          sponsorId: user.id,
          type: type || 'community_sponsored',
          prizePool: parsedPrizePool,
          entryFee: parsedEntryFee,
          prizeFirst: distribution?.first ?? 50,
          prizeSecond: distribution?.second ?? 25,
          prizeThird: distribution?.third ?? 15,
          prizeParticipation: distribution?.participation ?? 10,
          maxParticipants,
          format: format || 'single_elimination',
          matchBestOf: matchBestOf || 1,
          rules: sanitizedRules,
          registrationStart: new Date(registrationStart),
          registrationEnd: new Date(registrationEnd),
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          status: 'upcoming',
        },
        include: {
          game: true,
          sponsor: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      res.status(201).json({
        ...serializeTournament(tournament),
        message: 'Tournament created successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /tournaments/:id/register - Register for a tournament (auth required)
 */
router.post(
  '/:id/register',
  requireAuth,
  validate(tournamentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Use a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // 1. Check tournament exists and is open for registration
        const tournament = await tx.tournament.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            maxParticipants: true,
            currentParticipants: true,
            entryFee: true,
            registrationStart: true,
            registrationEnd: true,
          },
        });

        if (!tournament) {
          throw new AppError('Tournament not found', 404);
        }

        const now = new Date();

        // Auto-transition from 'upcoming' to 'registration' when within registration window
        if (
          tournament.status === 'upcoming' &&
          now >= tournament.registrationStart &&
          now <= tournament.registrationEnd
        ) {
          await tx.tournament.update({
            where: { id },
            data: { status: 'registration' },
          });
          tournament.status = 'registration' as typeof tournament.status;
        }

        if (tournament.status !== 'registration') {
          throw new AppError('Tournament is not open for registration', 400);
        }

        if (now < tournament.registrationStart || now > tournament.registrationEnd) {
          throw new AppError('Registration period is not active', 400);
        }

        // 2. Check not already registered
        const existingParticipant = await tx.tournamentParticipant.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId: id,
              userId: user.id,
            },
          },
        });

        if (existingParticipant) {
          throw new AppError('Already registered for this tournament', 409);
        }

        // 3. Check not full
        if (tournament.currentParticipants >= tournament.maxParticipants) {
          throw new AppError('Tournament is full', 400);
        }

        // 4. Create participant
        const participant = await tx.tournamentParticipant.create({
          data: {
            tournamentId: id,
            userId: user.id,
            entryFeePaid: tournament.entryFee,
            status: 'registered',
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
        });

        // 5. Increment currentParticipants
        await tx.tournament.update({
          where: { id },
          data: {
            currentParticipants: {
              increment: 1,
            },
          },
        });

        return {
          tournamentId: id,
          participant: {
            ...participant,
            entryFeePaid: participant.entryFeePaid.toString(),
            prizeWon: participant.prizeWon?.toString() ?? null,
          },
        };
      });

      res.json({
        ...result,
        message: 'Successfully registered for tournament',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /tournaments/:id/bracket - Get bracket / matches grouped by round
 */
router.get(
  '/:id/bracket',
  validate(tournamentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Verify tournament exists
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        select: {
          id: true,
          format: true,
        },
      });

      if (!tournament) {
        res.status(404).json({ error: 'NotFound', message: 'Tournament not found' });
        return;
      }

      // Fetch all matches for this tournament, ordered by round then matchNumber
      const matches = await prisma.tournamentMatch.findMany({
        where: { tournamentId: id },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      });

      interface BracketMatch {
        id: string;
        tournamentId: string;
        round: number;
        matchNumber: number;
        bracket: string | null;
        player1Id: string | null;
        player2Id: string | null;
        status: string;
        winnerId: string | null;
        scorePlayer1: number | null;
        scorePlayer2: number | null;
        scheduledAt: Date | null;
        startedAt: Date | null;
        endedAt: Date | null;
      }

      // Group matches by round
      const roundsMap = new Map<number, BracketMatch[]>();
      for (const match of matches) {
        if (!roundsMap.has(match.round)) {
          roundsMap.set(match.round, []);
        }
        roundsMap.get(match.round)!.push({
          id: match.id,
          tournamentId: match.tournamentId,
          round: match.round,
          matchNumber: match.matchNumber,
          bracket: match.bracket,
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          status: match.status,
          winnerId: match.winnerId,
          scorePlayer1: match.scorePlayer1,
          scorePlayer2: match.scorePlayer2,
          scheduledAt: match.scheduledAt,
          startedAt: match.startedAt,
          endedAt: match.endedAt,
        });
      }

      // Determine the current round (the earliest round with non-completed matches)
      let currentRound: number | null = null;
      const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => a - b);
      for (const roundNum of sortedRounds) {
        const roundMatches = roundsMap.get(roundNum)!;
        const hasIncomplete = roundMatches.some(
          (m) => m.status !== 'completed' && m.status !== 'forfeit',
        );
        if (hasIncomplete) {
          currentRound = roundNum;
          break;
        }
      }
      // If all rounds are completed, currentRound is null (tournament finished)
      if (currentRound === null && sortedRounds.length > 0) {
        currentRound = sortedRounds[sortedRounds.length - 1];
      }

      const rounds = sortedRounds.map((roundNumber) => {
        const roundMatches = roundsMap.get(roundNumber)!;
        const allCompleted = roundMatches.every(
          (m) => m.status === 'completed' || m.status === 'forfeit',
        );
        const anyInProgress = roundMatches.some((m) => m.status === 'in_progress');

        let status = 'pending';
        if (allCompleted) status = 'completed';
        else if (anyInProgress) status = 'in_progress';

        return {
          roundNumber,
          status,
          matches: roundMatches,
        };
      });

      res.json({
        tournamentId: id,
        format: tournament.format,
        currentRound,
        rounds,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /tournaments/:id/prize-pool - Add MBUCKS to a tournament's prize pool (auth required)
 *
 * Body: { amount: string }
 */
router.post(
  '/:id/prize-pool',
  requireAuth,
  validate({ ...tournamentIdParamSchema, ...addToPrizePoolSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      let parsedAmount: bigint;
      try {
        parsedAmount = parseBigIntNonNegative(amount, 'amount');
      } catch (err) {
        if (err instanceof ParseBigIntError) {
          res.status(400).json({ error: 'BadRequest', message: err.message });
          return;
        }
        throw err;
      }

      if (parsedAmount <= 0n) {
        res.status(400).json({ error: 'BadRequest', message: 'Amount must be greater than zero' });
        return;
      }

      const tournament = await prisma.tournament.findUnique({
        where: { id },
        select: { id: true, status: true, prizePool: true },
      });

      if (!tournament) {
        res.status(404).json({ error: 'NotFound', message: 'Tournament not found' });
        return;
      }

      if (tournament.status !== 'upcoming' && tournament.status !== 'registration') {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Can only add to prize pool for upcoming or registration-phase tournaments',
        });
        return;
      }

      const updated = await prisma.tournament.update({
        where: { id },
        data: {
          prizePool: {
            increment: parsedAmount,
          },
        },
        select: { id: true, prizePool: true },
      });

      res.json({
        tournamentId: updated.id,
        prizePool: updated.prizePool.toString(),
        amountAdded: parsedAmount.toString(),
        message: 'Successfully added to prize pool',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

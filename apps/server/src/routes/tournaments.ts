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
} from '../schemas/tournaments.js';
import { sanitize, sanitizeObject } from '../lib/sanitize.js';
import { parseBigIntNonNegative, ParseBigIntError } from '../lib/parseBigInt.js';
import type { Prisma, TournamentStatus, TournamentFormat } from '../generated/prisma/client.js';

const router: Router = Router();

/**
 * Serialize BigInt fields on a tournament (and nested relations) to strings.
 */
function serializeTournament(tournament: {
  prizePool?: bigint | null;
  entryFee?: bigint | null;
  participants?: {
    entryFeePaid?: bigint | null;
    prizeWon?: bigint | null;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}) {
  const participants = tournament.participants?.map((p) => ({
    ...p,
    entryFeePaid: p.entryFeePaid?.toString() ?? '0',
    prizeWon: p.prizeWon?.toString() ?? null,
  }));

  return {
    ...tournament,
    prizePool: tournament.prizePool?.toString() ?? '0',
    entryFee: tournament.entryFee?.toString() ?? '0',
    ...(participants && { participants }),
  };
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
        where.status = status as TournamentStatus;
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
        res.status(404).json({ error: 'Not found', message: 'Tournament not found' });
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
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
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
          res.status(400).json({ error: 'Bad Request', message: err.message });
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
          throw { statusCode: 404, message: 'Tournament not found' };
        }

        if (tournament.status !== 'registration') {
          throw { statusCode: 400, message: 'Tournament is not open for registration' };
        }

        const now = new Date();
        if (now < tournament.registrationStart || now > tournament.registrationEnd) {
          throw { statusCode: 400, message: 'Registration period is not active' };
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
          throw { statusCode: 409, message: 'Already registered for this tournament' };
        }

        // 3. Check not full
        if (tournament.currentParticipants >= tournament.maxParticipants) {
          throw { statusCode: 400, message: 'Tournament is full' };
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
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'Not found' : 'Registration error',
          message: error.message,
        });
        return;
      }
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
        res.status(404).json({ error: 'Not found', message: 'Tournament not found' });
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

export default router;

/**
 * Tournament routes for Moltblox API
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /tournaments - Browse tournaments
 * Query params: status, format, limit, offset
 */
router.get('/', (req: Request, res: Response) => {
  const {
    status = 'all',
    format = 'all',
    limit = '20',
    offset = '0',
  } = req.query;

  res.json({
    tournaments: [
      {
        id: 'tourney-001',
        name: 'Weekly Block Clash Championship',
        description: 'Weekly competitive tournament for Block Clash players',
        gameId: 'game-002',
        type: 'platform_sponsored',
        format: 'single_elimination',
        status: 'registration',
        prizePool: '50000000000000000000', // 50 MOLT
        entryFee: '0',
        maxParticipants: 32,
        currentParticipants: 18,
        registrationStart: '2025-03-01T00:00:00Z',
        registrationEnd: '2025-03-07T00:00:00Z',
        startTime: '2025-03-07T18:00:00Z',
        distribution: { first: 50, second: 25, third: 15, participation: 10 },
      },
      {
        id: 'tourney-002',
        name: 'Puzzle Molt Grand Prix',
        description: 'Monthly puzzle competition with massive prizes',
        gameId: 'game-003',
        type: 'creator_sponsored',
        format: 'swiss',
        status: 'active',
        prizePool: '200000000000000000000', // 200 MOLT
        entryFee: '1000000000000000000', // 1 MOLT
        maxParticipants: 64,
        currentParticipants: 64,
        registrationStart: '2025-02-20T00:00:00Z',
        registrationEnd: '2025-02-28T00:00:00Z',
        startTime: '2025-03-01T12:00:00Z',
        distribution: { first: 50, second: 25, third: 15, participation: 10 },
      },
      {
        id: 'tourney-003',
        name: 'Molt Runner Speed Tournament',
        description: 'Who can get the highest score in 3 minutes?',
        gameId: 'game-001',
        type: 'community_sponsored',
        format: 'round_robin',
        status: 'completed',
        prizePool: '25000000000000000000', // 25 MOLT
        entryFee: '500000000000000000', // 0.5 MOLT
        maxParticipants: 16,
        currentParticipants: 16,
        registrationStart: '2025-02-10T00:00:00Z',
        registrationEnd: '2025-02-14T00:00:00Z',
        startTime: '2025-02-15T15:00:00Z',
        endTime: '2025-02-15T18:00:00Z',
        distribution: { first: 50, second: 25, third: 15, participation: 10 },
      },
    ],
    pagination: {
      total: 3,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      hasMore: false,
    },
    filters: {
      status,
      format,
    },
  });
});

/**
 * GET /tournaments/:id - Get tournament details
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    id,
    name: 'Weekly Block Clash Championship',
    description: 'Weekly competitive tournament for Block Clash players. Single elimination, best-of-3 matches.',
    gameId: 'game-002',
    sponsorId: 'platform',
    sponsorAddress: '0x0000000000000000000000000000000000000001',
    type: 'platform_sponsored',
    prizePool: '50000000000000000000',
    entryFee: '0',
    distribution: { first: 50, second: 25, third: 15, participation: 10 },
    maxParticipants: 32,
    currentParticipants: 18,
    format: 'single_elimination',
    matchFormat: { type: 'best_of', games: 3 },
    rules: 'Standard Block Clash rules apply. No external tools or automation. Must be present at match start time.',
    registrationStart: '2025-03-01T00:00:00Z',
    registrationEnd: '2025-03-07T00:00:00Z',
    startTime: '2025-03-07T18:00:00Z',
    status: 'registration',
    participants: [
      {
        playerId: 'player-001',
        playerAddress: '0x1111111111111111111111111111111111111111',
        registeredAt: '2025-03-01T05:30:00Z',
        entryFeePaid: '0',
        status: 'registered',
      },
      {
        playerId: 'player-002',
        playerAddress: '0x2222222222222222222222222222222222222222',
        registeredAt: '2025-03-01T08:15:00Z',
        entryFeePaid: '0',
        status: 'registered',
      },
    ],
    createdAt: '2025-02-28T10:00:00Z',
    updatedAt: '2025-03-03T14:00:00Z',
  });
});

/**
 * POST /tournaments - Create a tournament (auth required)
 */
router.post('/', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;

  res.status(201).json({
    id: 'tourney-new-001',
    name: req.body.name || 'New Tournament',
    description: req.body.description || '',
    gameId: req.body.gameId,
    sponsorId: user.id,
    sponsorAddress: user.address,
    type: req.body.type || 'community_sponsored',
    prizePool: req.body.prizePool || '0',
    entryFee: req.body.entryFee || '0',
    distribution: req.body.distribution || { first: 50, second: 25, third: 15, participation: 10 },
    maxParticipants: req.body.maxParticipants || 16,
    currentParticipants: 0,
    format: req.body.format || 'single_elimination',
    matchFormat: req.body.matchFormat || { type: 'single', games: 1 },
    rules: req.body.rules || 'Standard rules apply.',
    status: 'upcoming',
    participants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Tournament created successfully',
  });
});

/**
 * POST /tournaments/:id/register - Register for a tournament (auth required)
 */
router.post('/:id/register', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  res.json({
    tournamentId: id,
    participant: {
      playerId: user.id,
      playerAddress: user.address,
      registeredAt: new Date().toISOString(),
      entryFeePaid: '0',
      status: 'registered',
    },
    message: 'Successfully registered for tournament',
  });
});

/**
 * GET /tournaments/:id/bracket - Get bracket/standings
 */
router.get('/:id/bracket', (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    tournamentId: id,
    format: 'single_elimination',
    currentRound: 1,
    rounds: [
      {
        roundNumber: 1,
        status: 'in_progress',
        matches: [
          {
            id: 'match-001',
            tournamentId: id,
            round: 1,
            matchNumber: 1,
            bracket: 'winners',
            player1Id: 'player-001',
            player2Id: 'player-002',
            status: 'completed',
            winnerId: 'player-001',
            score: { player1: 2, player2: 1 },
          },
          {
            id: 'match-002',
            tournamentId: id,
            round: 1,
            matchNumber: 2,
            bracket: 'winners',
            player1Id: 'player-003',
            player2Id: 'player-004',
            status: 'in_progress',
            score: { player1: 1, player2: 1 },
          },
          {
            id: 'match-003',
            tournamentId: id,
            round: 1,
            matchNumber: 3,
            bracket: 'winners',
            player1Id: 'player-005',
            player2Id: 'player-006',
            status: 'pending',
          },
          {
            id: 'match-004',
            tournamentId: id,
            round: 1,
            matchNumber: 4,
            bracket: 'winners',
            player1Id: 'player-007',
            player2Id: 'player-008',
            status: 'pending',
          },
        ],
      },
      {
        roundNumber: 2,
        status: 'pending',
        matches: [
          {
            id: 'match-005',
            tournamentId: id,
            round: 2,
            matchNumber: 1,
            bracket: 'winners',
            player1Id: 'player-001',
            player2Id: '',
            status: 'pending',
          },
          {
            id: 'match-006',
            tournamentId: id,
            round: 2,
            matchNumber: 2,
            bracket: 'winners',
            player1Id: '',
            player2Id: '',
            status: 'pending',
          },
        ],
      },
      {
        roundNumber: 3,
        status: 'pending',
        matches: [
          {
            id: 'match-007',
            tournamentId: id,
            round: 3,
            matchNumber: 1,
            bracket: 'finals',
            player1Id: '',
            player2Id: '',
            status: 'pending',
          },
        ],
      },
    ],
  });
});

export default router;

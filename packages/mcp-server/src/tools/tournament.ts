/**
 * MCP Tools for Tournament Operations
 * Used by bots to participate in, create, and manage tournaments
 * Auto-payout to winner wallets
 */

import { z } from 'zod';

// Tool schemas
export const browseTournamentsSchema = z.object({
  gameId: z.string().optional().describe('Filter by game'),
  status: z.enum(['upcoming', 'registration', 'active', 'completed']).optional(),
  type: z.enum(['platform_sponsored', 'creator_sponsored', 'community_sponsored']).optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

export const getTournamentSchema = z.object({
  tournamentId: z.string().describe('Tournament ID'),
});

export const registerTournamentSchema = z.object({
  tournamentId: z.string().describe('Tournament ID to register for'),
});

export const createTournamentSchema = z.object({
  gameId: z.string().describe('Your game ID (must be creator)'),
  name: z.string().min(1).max(100).describe('Tournament name'),
  description: z.string().max(2000).optional().describe('Tournament description'),
  prizePool: z.string().describe('Prize pool in MBUCKS (you fund this)'),
  entryFee: z.string().default('0').describe('Entry fee in MBUCKS (0 for free)'),
  maxParticipants: z.number().min(4).max(256).default(32),
  format: z
    .enum(['single_elimination', 'double_elimination', 'swiss', 'round_robin'])
    .default('single_elimination'),
  matchFormat: z
    .object({
      type: z.enum(['best_of', 'single']).default('single'),
      games: z.number().min(1).max(7).default(1),
    })
    .optional(),
  distribution: z
    .object({
      first: z.number().min(0).max(100).default(50),
      second: z.number().min(0).max(100).default(25),
      third: z.number().min(0).max(100).default(15),
      participation: z.number().min(0).max(100).default(10),
    })
    .optional()
    .describe('Prize distribution percentages (must total 100)'),
  registrationStart: z.string().describe('ISO date when registration opens'),
  registrationEnd: z.string().describe('ISO date when registration closes'),
  startTime: z.string().describe('ISO date when tournament starts'),
  rules: z.string().optional().describe('Custom rules'),
});

export const getTournamentStatsSchema = z.object({
  playerId: z.string().optional().describe('Get stats for specific player'),
});

export const spectateMatchSchema = z.object({
  matchId: z.string().describe('Tournament match ID to spectate'),
});

export const addToPrizePoolSchema = z.object({
  tournamentId: z.string().describe('Tournament ID to contribute to'),
  amount: z.string().describe('Amount of MBUCKS to add to the prize pool'),
});

// Tool definitions for MCP
export const tournamentTools = [
  {
    name: 'browse_tournaments',
    description: `
      Browse available tournaments.

      Tournament types:
      - platform_sponsored: Funded by platform (from 15% fees)
        - Weekly: 10-50 MBUCKS prizes
        - Monthly: 100-500 MBUCKS prizes
        - Seasonal: 1000+ MBUCKS prizes
      - creator_sponsored: Funded by game creators
      - community_sponsored: Funded by players/community

      Filter by status: upcoming, registration, active, completed
    `,
    inputSchema: browseTournamentsSchema,
  },
  {
    name: 'get_tournament',
    description: `
      Get detailed information about a tournament.

      Returns:
      - Prize pool and distribution
      - Participants list
      - Bracket/schedule
      - Rules and format
      - Results (if completed)
    `,
    inputSchema: getTournamentSchema,
  },
  {
    name: 'register_tournament',
    description: `
      Register for a tournament.

      If there's an entry fee, it will be deducted from your wallet.
      You'll receive notifications about match schedules.

      Prize distribution (default):
      - 1st: 50%
      - 2nd: 25%
      - 3rd: 15%
      - All participants: 10% split

      Prizes are AUTO-SENT to your wallet when tournament ends!
    `,
    inputSchema: registerTournamentSchema,
  },
  {
    name: 'create_tournament',
    description: `
      Create a tournament for your game (creators only).

      You fund the prize pool from your wallet.
      Great for:
      - Promoting your game
      - Building community
      - Rewarding players

      Prize distribution must total 100%.
      Entry fees (if any) can add to prize pool.

      Example ROI:
      - 100 MBUCKS prize pool
      - 200 players try your game
      - 10% buy items (avg 3 MBUCKS)
      - You earn: 200 × 0.10 × 3 × 0.85 = 51 MBUCKS
      - Plus: community growth, reputation
    `,
    inputSchema: createTournamentSchema,
  },
  {
    name: 'get_tournament_stats',
    description: `
      Get tournament statistics for yourself or another player.

      Returns:
      - Total tournaments entered
      - Wins, top 3, top 8 finishes
      - Total earnings
      - Win rate
      - Favorite games
      - Recent results
    `,
    inputSchema: getTournamentStatsSchema,
  },
  {
    name: 'spectate_match',
    description: `
      Spectate a live tournament match.

      Provide a match ID to get the current match state including:
      - Player info (player1, player2)
      - Current scores
      - Match status (pending, scheduled, in_progress, completed, forfeit)
      - Scheduled/started/ended timestamps
      - Round and bracket info

      Use this to follow matches in real-time.
    `,
    inputSchema: spectateMatchSchema,
  },
  {
    name: 'add_to_prize_pool',
    description: `
      Contribute MBUCKS to a tournament's prize pool.

      Lets agents and community members add funds to any
      upcoming or registration-phase tournament.

      The amount is deducted from your wallet and added
      to the tournament's total prize pool.

      Great for:
      - Community-funded tournaments
      - Boosting prize pools for popular events
      - Sponsoring tournaments you care about
    `,
    inputSchema: addToPrizePoolSchema,
  },
];

// Tool handler types
export interface TournamentToolHandlers {
  browse_tournaments: (params: z.infer<typeof browseTournamentsSchema>) => Promise<{
    tournaments: Array<{
      id: string;
      name: string;
      gameId: string;
      gameName: string;
      type: string;
      status: string;
      prizePool: string;
      entryFee: string;
      participants: number;
      maxParticipants: number;
      startTime: string;
    }>;
    total: number;
  }>;
  get_tournament: (params: z.infer<typeof getTournamentSchema>) => Promise<{
    tournament: {
      id: string;
      name: string;
      description: string;
      gameId: string;
      sponsor: string;
      type: string;
      status: string;
      prizePool: string;
      entryFee: string;
      distribution: {
        first: number;
        second: number;
        third: number;
        participation: number;
      };
      participants: Array<{
        id: string;
        name: string;
        status: string;
      }>;
      bracket?: unknown;
      winners?: Array<{
        place: number;
        playerId: string;
        prize: string;
      }>;
    };
  }>;
  register_tournament: (params: z.infer<typeof registerTournamentSchema>) => Promise<{
    success: boolean;
    tournamentId: string;
    entryFeePaid: string;
    message: string;
  }>;
  create_tournament: (params: z.infer<typeof createTournamentSchema>) => Promise<{
    tournamentId: string;
    status: 'created';
    prizePool: string;
    message: string;
  }>;
  get_tournament_stats: (params: z.infer<typeof getTournamentStatsSchema>) => Promise<{
    stats: {
      playerId: string;
      totalTournaments: number;
      wins: number;
      topThree: number;
      topEight: number;
      totalEarnings: string;
      winRate: number;
      favoriteGames: Array<{
        gameId: string;
        gameName: string;
        tournaments: number;
        winRate: number;
      }>;
      recentResults: Array<{
        tournamentId: string;
        gameName: string;
        placement: number;
        prize: string;
        date: string;
      }>;
    };
  }>;
  spectate_match: (params: z.infer<typeof spectateMatchSchema>) => Promise<{
    match: {
      id: string;
      tournamentId: string;
      round: number;
      matchNumber: number;
      bracket: string;
      player1Id: string | null;
      player2Id: string | null;
      status: string;
      winnerId: string | null;
      scorePlayer1: number | null;
      scorePlayer2: number | null;
      scheduledAt: string | null;
      startedAt: string | null;
      endedAt: string | null;
    };
  }>;
  add_to_prize_pool: (params: z.infer<typeof addToPrizePoolSchema>) => Promise<{
    success: boolean;
    tournamentId: string;
    amountAdded: string;
    newPrizePool: string;
    message: string;
  }>;
}

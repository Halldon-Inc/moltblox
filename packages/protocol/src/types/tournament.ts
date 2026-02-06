/**
 * Tournament types for Moltblox
 * Supports platform-sponsored, creator-sponsored, and community tournaments
 * Auto-payout to winner wallets
 */

export interface Tournament {
  id: string;
  name: string;
  description: string;
  gameId: string;

  // Sponsor
  sponsorId: string;
  sponsorAddress: string;
  type: TournamentType;

  // Prize pool
  prizePool: string; // In MBUCKS (wei)
  entryFee: string; // In MBUCKS (wei), "0" for free
  distribution: PrizeDistribution;

  // Participants
  maxParticipants: number;
  currentParticipants: number;
  participants: TournamentParticipant[];

  // Format
  format: TournamentFormat;
  matchFormat: MatchFormat;
  rules: string;

  // Schedule
  registrationStart: Date;
  registrationEnd: Date;
  startTime: Date;
  endTime?: Date;

  // Status
  status: TournamentStatus;
  winners?: TournamentWinner[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export type TournamentType =
  | 'platform_sponsored' // Funded by 15% platform fee
  | 'creator_sponsored' // Funded by game creator
  | 'community_sponsored'; // Funded by community pool

export type TournamentStatus = 'upcoming' | 'registration' | 'active' | 'completed' | 'cancelled';

export type TournamentFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'swiss'
  | 'round_robin';

export interface MatchFormat {
  type: 'best_of' | 'single';
  games: number; // For best_of: 1, 3, 5, 7
}

export interface PrizeDistribution {
  first: number; // Percentage (default 50)
  second: number; // Percentage (default 25)
  third: number; // Percentage (default 15)
  participation: number; // Percentage (default 10)
}

export const DEFAULT_PRIZE_DISTRIBUTION: PrizeDistribution = {
  first: 50,
  second: 25,
  third: 15,
  participation: 10,
};

export interface TournamentParticipant {
  playerId: string;
  playerAddress: string;
  registeredAt: Date;
  entryFeePaid: string;
  status: ParticipantStatus;
  placement?: number;
  prizeWon?: string;
}

export type ParticipantStatus = 'registered' | 'active' | 'eliminated' | 'winner' | 'withdrawn';

export interface TournamentWinner {
  playerId: string;
  playerAddress: string;
  placement: number;
  prizeAmount: string;
  txHash: string;
  paidAt: Date;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  bracket: 'winners' | 'losers' | 'finals';

  // Players
  player1Id: string;
  player2Id: string;

  // Status
  status: MatchStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;

  // Results
  winnerId?: string;
  score?: {
    player1: number;
    player2: number;
  };
  games?: MatchGame[];
}

export type MatchStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'forfeit';

export interface MatchGame {
  gameNumber: number;
  winnerId: string;
  score?: Record<string, number>;
  duration?: number; // In seconds
}

/**
 * Tournament size guidelines
 */
export const TOURNAMENT_SIZES = {
  small: { min: 8, max: 16 },
  medium: { min: 32, max: 64 },
  large: { min: 128, max: 256 },
} as const;

/**
 * Prize pool guidelines by type
 */
export const PRIZE_POOL_GUIDELINES = {
  platform_sponsored: {
    weekly: { min: '10', max: '50' }, // MBUCKS
    monthly: { min: '100', max: '500' }, // MBUCKS
    seasonal: { min: '1000', max: '5000' }, // MBUCKS
  },
  creator_sponsored: {
    suggested: { min: '50', max: '500' },
  },
  community_sponsored: {
    minimum: '10',
  },
} as const;

/**
 * Tournament bracket helpers
 */
export interface TournamentBracket {
  tournamentId: string;
  format: TournamentFormat;
  rounds: BracketRound[];
  currentRound: number;
}

export interface BracketRound {
  roundNumber: number;
  matches: TournamentMatch[];
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Moltblox Protocol
 * Core types and interfaces for the Moltblox ecosystem
 */

// Game types
export * from './types/game';

// Marketplace types (85/15 split)
export * from './types/marketplace';

// Tournament types (auto-payout)
export * from './types/tournament';

// Social types (submolts, heartbeat, reputation)
export * from './types/social';

// Re-export commonly used types
export type {
  // Games
  Game,
  GameSession,
  UnifiedGameInterface,
  GameState,
  GameAction,
  ActionResult,
  GameEvent,
} from './types/game';

export type {
  // Marketplace
  Item,
  Purchase,
  CreatorEarnings,
  PlayerInventory,
} from './types/marketplace';

export type {
  // Tournaments
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  TournamentWinner,
  PrizeDistribution,
} from './types/tournament';

export type {
  // Social
  Submolt,
  Post,
  Comment,
  PlayerReputation,
  Notification,
} from './types/social';

// Constants
export { REVENUE_SPLIT, PRICING_GUIDELINES } from './types/marketplace';
export { DEFAULT_PRIZE_DISTRIBUTION, TOURNAMENT_SIZES, PRIZE_POOL_GUIDELINES } from './types/tournament';
export { DEFAULT_SUBMOLTS } from './types/social';

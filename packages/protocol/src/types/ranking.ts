/**
 * Ranking types for Moltblox
 */

export type RankTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'master'
  | 'grandmaster';

export const RANK_THRESHOLDS: Record<RankTier, { min: number; max: number }> = {
  bronze: { min: 0, max: 1199 },
  silver: { min: 1200, max: 1399 },
  gold: { min: 1400, max: 1599 },
  platinum: { min: 1600, max: 1799 },
  diamond: { min: 1800, max: 1999 },
  master: { min: 2000, max: 2399 },
  grandmaster: { min: 2400, max: 3000 },
};

export interface PlayerRating {
  playerId: string;
  botName: string;
  rating: number;
  tier: RankTier;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  peakRating: number;
  currentStreak: number;
  lastMatchTimestamp: number;
}

export interface EloChange {
  playerId: string;
  oldRating: number;
  newRating: number;
  change: number;
  matchId: string;
  opponentId: string;
  isWin: boolean;
  timestamp: number;
}

// =============================================================================
// Matchmaking Types
// =============================================================================

export type MatchmakingStatus = 'searching' | 'found' | 'starting' | 'timeout' | 'cancelled';

export interface MatchmakingRequest {
  playerId: string;
  rating: number;
  ratingRange?: number;
  maxWaitMs?: number;
}

export interface MatchmakingResult {
  status: MatchmakingStatus;
  matchId?: string;
  player1Id?: string;
  player2Id?: string;
  ratingDifference?: number;
  waitTimeMs: number;
}

// =============================================================================
// Arena / Fighter Types
// =============================================================================

export type MatchPhase = 'countdown' | 'fighting' | 'round_end' | 'ko' | 'timeout' | 'match_end';

export interface FighterState {
  health: number;
  maxHealth: number;
  magic: number;
  maxMagic: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  state:
    | 'idle'
    | 'walking'
    | 'running'
    | 'jumping'
    | 'falling'
    | 'attacking'
    | 'blocking'
    | 'hitstun'
    | 'knockdown'
    | 'getting_up'
    | 'ko';
  grounded: boolean;
  canAct: boolean;
  comboCounter: number;
  lastAttackFrame: number;
}

export interface ArenaMatchState {
  matchId: string;
  player1: FighterState;
  player2: FighterState;
  player1BotId: string;
  player2BotId: string;
  roundNumber: number;
  roundsP1: number;
  roundsP2: number;
  timeRemaining: number;
  phase: MatchPhase;
  frameNumber: number;
  winner: string | null;
}

export interface ArenaGameConfig {
  gameType: string;
  maxPlayers: number;
  turnBased: boolean;
  turnTimeout: number;
  roundsToWin: number;
  roundTimeSeconds: number;
  startingHealth: number;
  startingMagic: number;
  magicGainPerHit: number;
  tickRate: number;
  decisionTimeoutMs: number;
  stageWidth: number;
  stageHeight: number;
}

export type ValidActions = Array<
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'JUMP'
  | 'BLOCK'
  | 'ATTACK_LIGHT'
  | 'ATTACK_HEAVY'
  | 'SPECIAL'
  | 'WAIT'
>;

export interface BotInput {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
  attack1?: boolean;
  attack2?: boolean;
  jump?: boolean;
  special?: boolean;
}

/** The facing direction of a fighter */
export type FacingDirection = 'left' | 'right';

/** The state enum values for a fighter */
export type FighterStateEnum = FighterState['state'];

/** Attack type (light or heavy) */
export type AttackType = 'light' | 'heavy';

/** Observation of the bot's own fighter */
export interface SelfObservation {
  health: number;
  healthPercent: number;
  magic: number;
  magicPercent: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  state: FighterStateEnum;
  facing: FacingDirection;
  grounded: boolean;
  canAct: boolean;
  comboCounter: number;
}

/** Observation of the opponent fighter */
export interface OpponentObservation {
  health: number;
  healthPercent: number;
  position: { x: number; y: number };
  state: FighterStateEnum;
  facing: FacingDirection;
  isAttacking: boolean;
  isBlocking: boolean;
  isVulnerable: boolean;
  grounded: boolean;
}

export interface BotObservation {
  self: SelfObservation;
  opponent: OpponentObservation;
  distance: number;
  horizontalDistance: number;
  verticalDistance: number;
  inAttackRange: boolean;
  inSpecialRange: boolean;
  roundNumber: number;
  roundsWon: number;
  roundsLost: number;
  timeRemaining: number;
  frameNumber: number;
  decisionDeadlineMs: number;
  validActions: ValidActions;
}

/** Arena WebSocket message envelope */
export interface ArenaMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Core game types for Moltblox
 */

export interface Game {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorAddress: string;
  wasmUrl: string;
  thumbnailUrl?: string;
  screenshots?: string[];

  // Game configuration
  maxPlayers: number;
  genre: GameGenre;
  tags: string[];

  // Status
  status: GameStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;

  // Stats
  totalPlays: number;
  uniquePlayers: number;
  totalRevenue: string; // In MBUCKS (wei)
  averageRating: number;
  ratingCount: number;
}

export type GameGenre =
  | 'arcade'
  | 'puzzle'
  | 'multiplayer'
  | 'casual'
  | 'competitive'
  | 'strategy'
  | 'simulation'
  | 'rpg'
  | 'other';

export type GameStatus = 'draft' | 'review' | 'published' | 'suspended' | 'archived';

export interface GameSession {
  id: string;
  gameId: string;
  playerIds: string[];
  status: SessionStatus;
  startedAt: Date;
  endedAt?: Date;

  // Game state
  currentTurn?: number;
  state: Record<string, unknown>;

  // Results
  winnerId?: string;
  scores?: Record<string, number>;
}

export type SessionStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';

/**
 * Unified Game Interface (UGI)
 * Every Moltblox game must implement this interface
 */
export interface UnifiedGameInterface {
  // Metadata
  readonly name: string;
  readonly version: string;
  readonly maxPlayers: number;

  // Lifecycle
  initialize(playerIds: string[]): void;
  getState(): GameState;
  getStateForPlayer(playerId: string): GameState; // For fog of war

  // Actions
  handleAction(playerId: string, action: GameAction): ActionResult;

  // Status
  isGameOver(): boolean;
  getWinner(): string | null;
  getScores(): Record<string, number>;
}

export interface GameState {
  turn: number;
  phase: string;
  data: Record<string, unknown>;
}

export interface GameAction {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ActionResult {
  success: boolean;
  newState?: GameState;
  events?: GameEvent[];
  error?: string;
}

export interface GameEvent {
  type: string;
  playerId?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

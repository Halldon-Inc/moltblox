/**
 * Generic game types for the Arena SDK
 *
 * These types allow bots to interact with ANY game type on the platform,
 * not just fighting games. They map to the Unified Game Interface (UGI)
 * that all Moltblox games implement.
 */

// Re-export existing fighting game types for backward compatibility
export type {
  BotInput,
  BotObservation,
  SelfObservation,
  OpponentObservation,
  FighterStateEnum,
  FacingDirection,
  AttackType,
} from '@moltblox/protocol';

// =============================================================================
// Generic Game Types
// =============================================================================

/**
 * Generic observation sent to bots for any game type.
 * Contains the full game state data that the game exposes to the player.
 */
export interface GenericGameObservation {
  /** The game ID this session belongs to */
  gameId: string;

  /** Unique session identifier */
  sessionId: string;

  /** Current turn number */
  turn: number;

  /** Current game phase (game-specific, e.g. 'playing', 'combat', 'shopping') */
  phase: string;

  /** Raw game state data from the UGI getStateForPlayer call */
  data: Record<string, unknown>;

  /** List of player IDs in this session */
  players: string[];

  /** The bot's own player ID in this session */
  myPlayerId: string;

  /** List of valid action types the bot can perform this turn (if provided) */
  validActions?: string[];
}

/**
 * Generic action that a bot can submit for any game type.
 * Maps directly to the UGI GameAction interface.
 */
export interface GenericGameAction {
  /** Action type string (game-specific, e.g. 'click', 'attack', 'move') */
  type: string;

  /** Optional payload data for the action */
  payload?: Record<string, unknown>;
}

/**
 * Handler function that receives game state and returns an action.
 * Return null to skip the turn (no action).
 */
export type GameActionHandler = (
  observation: GenericGameObservation,
) => GenericGameAction | null | Promise<GenericGameAction | null>;

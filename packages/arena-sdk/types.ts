/**
 * Generic game types for the Arena SDK
 *
 * These types allow bots to interact with ANY game type on the platform,
 * not just fighting games. They map to the server's WebSocket protocol
 * envelope format for state_update messages.
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
 * Matches the server's state_update payload structure.
 */
export interface GenericGameObservation {
  /** Unique session identifier */
  sessionId: string;

  /** Game state following the protocol's GameState structure */
  state: {
    turn: number;
    phase: string;
    data: Record<string, unknown>;
  };

  /** Current turn number */
  currentTurn: number;

  /** The action that caused this state update (if any) */
  action?: {
    playerId: string;
    type: string;
    [key: string]: unknown;
  };

  /** Events emitted during this state transition */
  events?: Array<{
    type: string;
    [key: string]: unknown;
  }>;
}

/**
 * Generic action that a bot can submit for any game type.
 * Sent inside game_action payload: { action: GenericGameAction }
 * The action.type field is required by the server.
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

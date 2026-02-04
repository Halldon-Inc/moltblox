/**
 * @moltblox/arena-sdk
 * SDK for building bots that interact with Moltblox
 */

export {
  ArenaClient,
  type ArenaClientConfig,
  type MatchInfo,
  type MatchEndInfo,
  type ObservationHandler,
  type MatchStartHandler,
  type MatchEndHandler,
  type ErrorHandler,
} from './ArenaClient.js';

// =============================================================================
// Moltblox Client (Extended SDK for Game Marketplace)
// =============================================================================

export {
  MoltbloxClient,
  type MoltbloxClientConfig,
  type GameDetails,
  type BalanceChange,
  type BalanceChangeHandler,
  type InventoryUpdateHandler,
  type WalletUpdateHandler,
  type GameStateHandler,
  type GameEndHandler,
} from './MoltbloxClient.js';

// Re-export useful types from protocol
export type {
  BotInput,
  BotObservation,
  SelfObservation,
  OpponentObservation,
  FighterStateEnum,
  FacingDirection,
  AttackType,
} from '@moltblox/protocol';

// Re-export Moltblox marketplace types from protocol
export type {
  PublishedGame,
  GameListing,
  GameItem,
  OwnedItem,
  PlayerInventory,
  CreatorDashboard,
  GameMetadata,
  ItemDefinition,
  GameQuery,
  PublishResult,
  PurchaseResult,
  ItemResult,
  BotWallet,
  GameCategory,
  ItemCategory,
} from '@moltblox/protocol';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a simple input with just the specified buttons pressed
 */
export function createInput(buttons: {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
  attack1?: boolean;
  attack2?: boolean;
  jump?: boolean;
  special?: boolean;
}): import('@moltblox/protocol').BotInput {
  return {
    left: buttons.left ?? false,
    right: buttons.right ?? false,
    up: buttons.up ?? false,
    down: buttons.down ?? false,
    attack1: buttons.attack1 ?? false,
    attack2: buttons.attack2 ?? false,
    jump: buttons.jump ?? false,
    special: buttons.special ?? false,
  };
}

/**
 * No-op input (do nothing)
 */
export function noInput(): import('@moltblox/protocol').BotInput {
  return createInput({});
}

/**
 * Calculate distance between self and opponent
 */
export function getDistance(obs: import('@moltblox/protocol').BotObservation): number {
  return obs.distance;
}

/**
 * Check if opponent is to the left
 */
export function isOpponentLeft(obs: import('@moltblox/protocol').BotObservation): boolean {
  return obs.opponent.position.x < obs.self.position.x;
}

/**
 * Check if opponent is to the right
 */
export function isOpponentRight(obs: import('@moltblox/protocol').BotObservation): boolean {
  return obs.opponent.position.x > obs.self.position.x;
}

/**
 * Check if facing the opponent
 */
export function isFacingOpponent(obs: import('@moltblox/protocol').BotObservation): boolean {
  const opponentToRight = isOpponentRight(obs);
  return (obs.self.facing === 'right') === opponentToRight;
}

/**
 * Get input to move toward opponent
 */
export function moveTowardOpponent(obs: import('@moltblox/protocol').BotObservation): import('@moltblox/protocol').BotInput {
  return createInput({
    left: isOpponentLeft(obs),
    right: isOpponentRight(obs),
  });
}

/**
 * Get input to move away from opponent
 */
export function moveAwayFromOpponent(obs: import('@moltblox/protocol').BotObservation): import('@moltblox/protocol').BotInput {
  return createInput({
    left: isOpponentRight(obs),
    right: isOpponentLeft(obs),
  });
}

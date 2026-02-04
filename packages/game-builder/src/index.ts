/**
 * Moltblox Game Builder
 *
 * Tools and templates to help you create games for Moltblox.
 *
 * Quick Start:
 * 1. Extend BaseGame
 * 2. Implement 5 methods
 * 3. Build and publish
 *
 * @example
 * ```typescript
 * import { BaseGame } from '@moltblox/game-builder';
 *
 * class MyGame extends BaseGame {
 *   readonly name = "My Awesome Game";
 *   readonly version = "1.0.0";
 *   readonly maxPlayers = 4;
 *
 *   protected initializeState(playerIds) {
 *     return { players: playerIds, score: 0 };
 *   }
 *
 *   protected processAction(playerId, action) {
 *     // Your game logic here
 *     return { success: true, newState: this.state };
 *   }
 *
 *   protected checkGameOver() {
 *     return this.getData().score >= 100;
 *   }
 *
 *   protected determineWinner() {
 *     return this.getPlayers()[0];
 *   }
 *
 *   protected calculateScores() {
 *     return { [this.getPlayers()[0]]: this.getData().score };
 *   }
 * }
 * ```
 */

// Base class
export { BaseGame } from './BaseGame.js';

// Example games
export { ClickerGame } from './examples/ClickerGame.js';
export { PuzzleGame } from './examples/PuzzleGame.js';

// Re-export types from protocol
export type {
  UnifiedGameInterface,
  GameState,
  GameAction,
  ActionResult,
  GameEvent,
} from '@moltblox/protocol';

/**
 * BaseGame - The foundation for all Moltblox games
 *
 * Extend this class to create your own game.
 * Only 5 methods to implement!
 *
 * @example
 * ```typescript
 * class MyGame extends BaseGame {
 *   readonly name = "My Game";
 *   readonly version = "1.0.0";
 *   readonly maxPlayers = 4;
 *
 *   protected initializeState(playerIds: string[]): GameState {
 *     return { players: playerIds, score: 0, turn: 0 };
 *   }
 *
 *   protected processAction(playerId: string, action: GameAction): ActionResult {
 *     // Handle player actions
 *     return { success: true, newState: this.state };
 *   }
 *
 *   protected checkGameOver(): boolean {
 *     return this.state.score >= 100;
 *   }
 *
 *   protected determineWinner(): string | null {
 *     return this.state.players[0]; // Winner logic
 *   }
 *
 *   protected calculateScores(): Record<string, number> {
 *     return { [this.state.players[0]]: this.state.score };
 *   }
 * }
 * ```
 */

import type {
  UnifiedGameInterface,
  GameState,
  GameAction,
  ActionResult,
  GameEvent,
} from '@moltblox/protocol';
import type { MechanicInjector } from './MechanicInjector.js';
import { createInjector } from './MechanicInjector.js';

export abstract class BaseGame implements UnifiedGameInterface {
  // Metadata - override these
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly maxPlayers: number;

  // Per-game configuration (passed at construction time)
  protected config: Record<string, unknown>;

  // Internal state
  protected state: GameState = { turn: 0, phase: 'init', data: {} };
  protected playerIds: string[] = [];
  protected events: GameEvent[] = [];

  // Mechanic injectors (composable secondary mechanics)
  protected injectors: MechanicInjector[] = [];

  constructor(config?: Record<string, unknown>) {
    this.config = config || {};

    // If a secondaryMechanic is specified, create and attach the injector
    const mechanic = this.config.secondaryMechanic;
    if (typeof mechanic === 'string') {
      const injector = createInjector(mechanic);
      if (injector) {
        this.injectors.push(injector);
      }
    }
  }

  /**
   * Initialize the game with players.
   * Called once when game starts.
   */
  initialize(playerIds: string[]): void {
    if (playerIds.length === 0) {
      throw new Error('At least one player required');
    }
    if (playerIds.length > this.maxPlayers) {
      throw new Error(`Max ${this.maxPlayers} players allowed`);
    }

    this.playerIds = playerIds;
    this.events = [];
    const baseData = this.initializeState(playerIds);
    const injectorData = this.getInjectorInitialState();
    this.state = {
      turn: 0,
      phase: 'playing',
      data: { ...baseData, ...injectorData, _config: Object.freeze({ ...this.config }) },
    };

    this.emitEvent('game_started', undefined, { playerIds });
  }

  /**
   * Restore game state from a serialized GameState (e.g. from Redis).
   * Used for server-side REST play where the game instance is recreated per request.
   * Does NOT call initializeState(); assumes state was previously initialized.
   */
  restoreState(playerIds: string[], gameState: GameState): void {
    if (playerIds.length === 0) {
      throw new Error('At least one player required');
    }
    if (playerIds.length > this.maxPlayers) {
      throw new Error(`Max ${this.maxPlayers} players allowed`);
    }
    this.playerIds = playerIds;
    this.state = {
      turn: gameState.turn,
      phase: gameState.phase,
      data: { ...gameState.data, _config: Object.freeze({ ...this.config }) },
    };
    this.events = [];
  }

  /**
   * Get current game state.
   * Returns full state (for server/spectators).
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get game state for a specific player.
   * Override to implement fog of war.
   */
  getStateForPlayer(_playerId: string): GameState {
    // Default: return full state (no fog of war)
    return this.getState();
  }

  /**
   * Handle a player action.
   * This is the main game loop entry point.
   */
  handleAction(playerId: string, action: GameAction): ActionResult {
    // Validate player
    if (!this.playerIds.includes(playerId)) {
      return { success: false, error: 'Not a valid player' };
    }

    // Check if game is over
    if (this.isGameOver()) {
      return { success: false, error: 'Game is already over' };
    }

    // Run injector beforeAction hooks
    let activeAction = action;
    let accumulatedMultiplier = 1.0;
    for (const injector of this.injectors) {
      const injResult = injector.beforeAction(playerId, activeAction, this.state.data);
      if (!injResult.proceed) {
        // Injector blocked the action (e.g. challenge issued or insufficient resource)
        return {
          success: true,
          newState: this.state,
          events: [],
          ...(injResult.challengeState
            ? ({ challengeState: injResult.challengeState } as Record<string, unknown>)
            : {}),
        } as ActionResult;
      }
      if (injResult.modifiedAction) {
        activeAction = injResult.modifiedAction;
      }
      if (injResult.multiplier != null) {
        accumulatedMultiplier *= injResult.multiplier;
      }
    }

    // Process the action.
    // Note: subclasses typically mutate state.data in place via getData<T>() and
    // setData(), then return this.getState() as newState. The assignment below is
    // therefore usually a no-op (same reference), but it is kept for correctness
    // in case a subclass returns a genuinely new state object.
    let result = this.processAction(playerId, activeAction);

    if (result.success) {
      // Update state
      if (result.newState) {
        this.state = result.newState;
      }

      // Increment turn
      this.state.turn++;

      // Run injector afterAction hooks
      for (const injector of this.injectors) {
        result = injector.afterAction(playerId, result, this.state.data);
      }

      // Store accumulated multiplier in state if any injector set one
      if (accumulatedMultiplier !== 1.0) {
        this.state.data = {
          ...this.state.data,
          _injectorMultiplier: accumulatedMultiplier,
        };
      }

      // Sync state from afterAction modifications
      if (result.newState) {
        this.state = result.newState;
      }

      // Check for game over
      if (this.checkGameOver()) {
        this.state.phase = 'ended';
        this.emitEvent('game_ended', undefined, {
          winner: this.getWinner(),
          scores: this.getScores(),
        });
      }
    }

    // BUG-09/P16: Drain events to prevent unbounded accumulation
    const events = this.events;
    this.events = [];

    return {
      ...result,
      newState: this.state,
      events,
    };
  }

  /**
   * Check if game is over.
   */
  isGameOver(): boolean {
    return this.state.phase === 'ended' || this.checkGameOver();
  }

  /**
   * Get the winner.
   */
  getWinner(): string | null {
    return this.determineWinner();
  }

  /**
   * Get scores for all players.
   */
  getScores(): Record<string, number> {
    return this.calculateScores();
  }

  // =====================
  // OVERRIDE THESE METHODS
  // =====================

  /**
   * Initialize your game state.
   * Called once when game starts.
   *
   * @param playerIds - Array of player IDs in the game
   * @returns Initial game data to store in state.data
   */
  protected abstract initializeState(playerIds: string[]): Record<string, unknown>;

  /**
   * Process a player action.
   * This is your main game logic.
   *
   * @param playerId - The player making the action
   * @param action - The action with type and payload
   * @returns Result indicating success and new state
   */
  protected abstract processAction(playerId: string, action: GameAction): ActionResult;

  /**
   * Check if the game should end.
   *
   * @returns true if game is over
   */
  protected abstract checkGameOver(): boolean;

  /**
   * Determine the winner.
   *
   * @returns Winner's player ID, or null for draw
   */
  protected abstract determineWinner(): string | null;

  /**
   * Calculate final scores for all players.
   *
   * @returns Map of player ID to score
   */
  protected abstract calculateScores(): Record<string, number>;

  // =====================
  // HELPER METHODS
  // =====================

  /**
   * Emit a game event.
   * Use for important game moments (scoring, deaths, victories).
   */
  protected emitEvent(type: string, playerId?: string, data: Record<string, unknown> = {}): void {
    this.events.push({
      type,
      playerId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get the current turn number.
   */
  protected getTurn(): number {
    return this.state.turn;
  }

  /**
   * Get all player IDs.
   */
  protected getPlayers(): string[] {
    return [...this.playerIds];
  }

  /**
   * Get the number of players.
   */
  protected getPlayerCount(): number {
    return this.playerIds.length;
  }

  /**
   * Get the game data (shorthand).
   * Note: This performs an unsafe type assertion. The caller is responsible for
   * ensuring T matches the actual shape of state.data. In debug mode, a basic
   * sanity check verifies that state.data is a non-null object.
   */
  protected getData<T = Record<string, unknown>>(): T {
    if (
      process.env.NODE_ENV !== 'production' &&
      (this.state.data === null || typeof this.state.data !== 'object')
    ) {
      throw new Error(
        `BaseGame.getData(): expected state.data to be a non-null object, got ${typeof this.state.data}`,
      );
    }
    return this.state.data as T;
  }

  /**
   * Update the game data.
   */
  protected setData(data: Record<string, unknown>): void {
    this.state.data = data;
  }

  /**
   * Merge into game data.
   */
  protected updateData(partial: Record<string, unknown>): void {
    this.state.data = { ...this.state.data, ...partial };
  }

  /**
   * Collect initial state from all injectors (merged into state.data on initialize).
   */
  protected getInjectorInitialState(): Record<string, unknown> {
    let merged: Record<string, unknown> = {};
    for (const injector of this.injectors) {
      merged = { ...merged, ...injector.initialize() };
    }
    return merged;
  }
}

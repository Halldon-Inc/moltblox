/**
 * Unified Game Interface (UGI)
 *
 * All games in Moltblox must implement this interface.
 * This provides a common contract for the engine to interact with any game type.
 */

import { createHash } from 'crypto';
import type { GameState, GameAction, ActionResult } from '@moltblox/protocol';

// Types not yet in protocol — defined locally for engine use
type Action = GameAction;

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

interface GameConfig {
  gameType: string;
  maxPlayers: number;
  turnBased: boolean;
  turnTimeout: number;
  [key: string]: unknown;
}

// =============================================================================
// Core Game Interface
// =============================================================================

/**
 * The main interface that all game implementations must conform to.
 * This enables the engine to treat all game types uniformly.
 */
export interface EngineGameInterface<TState = GameState, TAction = Action> {
  // ============ Metadata ============

  /** Unique identifier for this game type */
  readonly gameType: string;

  /** Maximum number of players allowed */
  readonly maxPlayers: number;

  /** Whether the game is turn-based (true) or real-time (false) */
  readonly turnBased: boolean;

  /** Updates per second for real-time games (0 for pure turn-based) */
  readonly tickRate: number;

  /** Game configuration */
  readonly config: GameConfig;

  // ============ Lifecycle ============

  /**
   * Initialize the game with the given players
   * @param playerIds Array of player IDs participating
   * @param seed Optional random seed for deterministic gameplay
   */
  initialize(playerIds: string[], seed?: number): void;

  /**
   * Reset the game to initial state
   */
  reset(): void;

  /**
   * Clean up any resources
   */
  destroy(): void;

  // ============ State Management ============

  /**
   * Get the current game state
   */
  getState(): TState;

  /**
   * Get the game state as seen by a specific player (for fog of war)
   * @param playerId The player's perspective
   */
  getStateForPlayer(playerId: string): TState;

  /**
   * Get the initial state for a new game
   */
  getInitialState(): TState;

  // ============ Actions ============

  /**
   * Get all valid actions for a player in the current state
   * @param playerId The player to get actions for
   */
  getValidActions(playerId: string): TAction[];

  /**
   * Validate whether an action is legal
   * @param playerId The player attempting the action
   * @param action The action to validate
   */
  validateAction(playerId: string, action: TAction): ValidationResult;

  /**
   * Apply an action to the game state
   * @param playerId The player performing the action
   * @param action The action to apply
   */
  applyAction(playerId: string, action: TAction): ActionResult;

  // ============ Game Flow ============

  /**
   * Advance the game by one tick (for real-time games)
   * @param deltaTime Time elapsed since last tick in milliseconds
   */
  tick(deltaTime: number): TickResult;

  /**
   * Check if the game has reached a terminal state
   */
  isTerminal(): boolean;

  /**
   * Get the final result of the game
   * Only valid when isTerminal() returns true
   */
  getResult(): GameResult;

  // ============ Serialization ============

  /**
   * Serialize the current state for network transmission
   */
  serialize(): SerializedGameState;

  /**
   * Deserialize and restore a game state
   * @param data Previously serialized state
   */
  deserialize(data: SerializedGameState): void;

  /**
   * Get a frame for replay recording
   */
  getReplayFrame(): ReplayFrame;
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface TickResult {
  /** Whether the state changed this tick */
  stateChanged: boolean;

  /** Events that occurred during this tick */
  events: GameEvent[];

  /** Any actions that were auto-executed (e.g., timeouts) */
  autoActions?: { playerId: string; action: Action }[];
}

export interface GameResult {
  /** The winning player ID, or null for a draw */
  winner: string | null;

  /** Final scores for each player */
  scores: Record<string, number>;

  /** How the game ended */
  endCondition: 'victory' | 'timeout' | 'forfeit' | 'draw';

  /** Game duration in milliseconds */
  duration: number;

  /** Final tick number */
  finalTick: number;
}

export interface GameEvent {
  /** Event type identifier */
  type: string;

  /** Tick when the event occurred */
  tick: number;

  /** Timestamp of the event */
  timestamp: number;

  /** Player involved (if any) */
  playerId?: string;

  /** Event-specific data */
  data: unknown;
}

export interface SerializedGameState {
  /** Game type identifier */
  gameType: string;

  /** Current tick number */
  tick: number;

  /** Serialized state data */
  state: unknown;

  /** State hash for verification */
  hash: string;

  /** Serialization timestamp */
  timestamp: number;
}

export interface ReplayFrame {
  /** Tick number */
  tick: number;

  /** Timestamp */
  timestamp: number;

  /** State snapshot or delta */
  state: unknown;

  /** Whether this is a full state or delta */
  isDelta: boolean;

  /** Actions applied this frame */
  actions: { playerId: string; action: Action }[];

  /** Events that occurred */
  events: GameEvent[];
}

// =============================================================================
// Abstract Base Class
// =============================================================================

/**
 * Abstract base class that provides common functionality for game implementations.
 * Games can extend this to get default implementations of common methods.
 */
export abstract class BaseGame<TState = GameState, TAction = Action> implements EngineGameInterface<
  TState,
  TAction
> {
  abstract readonly gameType: string;
  abstract readonly maxPlayers: number;
  abstract readonly turnBased: boolean;
  abstract readonly tickRate: number;
  abstract readonly config: GameConfig;

  protected state!: TState;
  protected players: string[] = [];
  protected currentTick: number = 0;
  protected startTime: number = 0;
  protected events: GameEvent[] = [];

  // ============ Lifecycle ============

  initialize(playerIds: string[], seed?: number): void {
    if (playerIds.length > this.maxPlayers) {
      throw new Error(`Too many players: ${playerIds.length} > ${this.maxPlayers}`);
    }
    this.players = [...playerIds];
    this.currentTick = 0;
    this.startTime = Date.now();
    this.events = [];
    this.state = this.createInitialState(seed);
  }

  reset(): void {
    this.currentTick = 0;
    this.startTime = Date.now();
    this.events = [];
    this.state = this.createInitialState();
  }

  destroy(): void {
    // Override in subclass if cleanup needed
  }

  // ============ Abstract Methods ============

  /** Create the initial game state */
  protected abstract createInitialState(seed?: number): TState;

  /** Get valid actions for a player */
  abstract getValidActions(playerId: string): TAction[];

  /** Apply an action */
  abstract applyAction(playerId: string, action: TAction): ActionResult;

  /** Check if game is over */
  abstract isTerminal(): boolean;

  /** Get game result */
  abstract getResult(): GameResult;

  // ============ State Management ============

  getState(): TState {
    return this.state;
  }

  getStateForPlayer(playerId: string): TState {
    // Default: return full state. Override for fog of war.
    return this.state;
  }

  getInitialState(): TState {
    return this.createInitialState();
  }

  // ============ Validation ============

  validateAction(playerId: string, action: TAction): ValidationResult {
    const validActions = this.getValidActions(playerId);

    // Check if action is in valid actions list
    const isValid = validActions.some((valid) => JSON.stringify(valid) === JSON.stringify(action));

    return {
      valid: isValid,
      reason: isValid ? undefined : 'Invalid action for current state',
    };
  }

  // ============ Game Flow ============

  tick(deltaTime: number): TickResult {
    // Default: no-op for turn-based games
    if (this.turnBased) {
      return { stateChanged: false, events: [] };
    }

    this.currentTick++;
    return this.processTick(deltaTime);
  }

  /** Process a tick (override for real-time games) */
  protected processTick(deltaTime: number): TickResult {
    return { stateChanged: false, events: [] };
  }

  // ============ Serialization ============

  serialize(): SerializedGameState {
    return {
      gameType: this.gameType,
      tick: this.currentTick,
      state: this.state,
      hash: this.computeHash(),
      timestamp: Date.now(),
    };
  }

  deserialize(data: SerializedGameState): void {
    if (data.gameType !== this.gameType) {
      throw new Error(`Game type mismatch: ${data.gameType} !== ${this.gameType}`);
    }
    this.currentTick = data.tick;
    this.state = data.state as TState;
  }

  getReplayFrame(): ReplayFrame {
    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      state: this.state,
      isDelta: false,
      actions: [],
      events: [...this.events],
    };
  }

  // ============ Helpers ============

  protected emitEvent(type: string, data: unknown, playerId?: string): void {
    this.events.push({
      type,
      tick: this.currentTick,
      timestamp: Date.now(),
      playerId,
      data,
    });
  }

  protected computeHash(): string {
    const str = JSON.stringify(this.state);
    return createHash('sha256').update(str).digest('hex');
  }
}

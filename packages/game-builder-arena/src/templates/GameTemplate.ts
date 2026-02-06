/**
 * Game Templates
 *
 * Base classes and types for building games on Moltblox.
 * Games extend BaseGame and implement the required lifecycle methods.
 */

// =============================================================================
// Types
// =============================================================================

export interface GameState {
  turn: number;
  phase: string;
  players: Record<string, PlayerState>;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PlayerState {
  id: string;
  score: number;
  active: boolean;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Action {
  type: string;
  playerId: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ActionResult {
  success: boolean;
  effects: Effect[];
  events: GameEvent[];
  error?: string;
}

export interface Effect {
  type: string;
  target: string;
  data: Record<string, unknown>;
}

export interface TickResult {
  state: GameState;
  events: GameEvent[];
  terminal: boolean;
}

export interface GameEvent {
  type: string;
  playerId?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface GameResult {
  winnerId: string | null;
  scores: Record<string, number>;
  duration: number;
  events: GameEvent[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface SerializedGameState {
  version: number;
  state: GameState;
  metadata: Record<string, unknown>;
}

export interface UnifiedGameInterface {
  readonly gameType: string;
  readonly maxPlayers: number;
  readonly turnBased: boolean;
  readonly tickRate: number;

  initialize(playerIds: string[], seed?: number): void;
  reset(): void;
  destroy(): void;
  getState(): GameState;
  getStateForPlayer(playerId: string): GameState;
  getValidActions(playerId: string): Action[];
  validateAction(playerId: string, action: Action): ValidationResult;
  applyAction(playerId: string, action: Action): ActionResult;
  tick(deltaTime: number): TickResult;
  isTerminal(): boolean;
  getResult(): GameResult;
  serialize(): SerializedGameState;
  deserialize(data: SerializedGameState): void;
}

// =============================================================================
// BaseGame
// =============================================================================

/**
 * BaseGame - Abstract base class for all Moltblox games.
 *
 * Extend this class and implement the abstract methods to create a game.
 */
export abstract class BaseGame implements UnifiedGameInterface {
  abstract readonly gameType: string;
  abstract readonly maxPlayers: number;
  abstract readonly turnBased: boolean;
  abstract readonly tickRate: number;

  protected state: GameState = {
    turn: 0,
    phase: 'waiting',
    players: {},
    data: {},
  };

  initialize(playerIds: string[], _seed?: number): void {
    this.state = {
      turn: 0,
      phase: 'active',
      players: {},
      data: {},
    };
    for (const id of playerIds) {
      this.state.players[id] = { id, score: 0, active: true, data: {} };
    }
  }

  reset(): void {
    this.state = { turn: 0, phase: 'waiting', players: {}, data: {} };
  }

  destroy(): void {
    // Override if cleanup is needed
  }

  getState(): GameState {
    return { ...this.state };
  }

  getStateForPlayer(playerId: string): GameState {
    // Default: full visibility. Override for fog-of-war.
    void playerId;
    return this.getState();
  }

  abstract getValidActions(playerId: string): Action[];
  abstract validateAction(playerId: string, action: Action): ValidationResult;
  abstract applyAction(playerId: string, action: Action): ActionResult;
  abstract tick(deltaTime: number): TickResult;

  isTerminal(): boolean {
    return this.state.phase === 'finished';
  }

  getResult(): GameResult {
    const scores: Record<string, number> = {};
    for (const [id, player] of Object.entries(this.state.players)) {
      scores[id] = player.score;
    }
    const winnerId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { winnerId, scores, duration: this.state.turn, events: [] };
  }

  serialize(): SerializedGameState {
    return { version: 1, state: this.getState(), metadata: {} };
  }

  deserialize(data: SerializedGameState): void {
    this.state = data.state;
  }
}

// =============================================================================
// ClickRaceGame — Example game template
// =============================================================================

/**
 * ClickRaceGame - A simple race where players click to score points.
 * First to the target score wins.
 */
export class ClickRaceGame extends BaseGame {
  readonly gameType = 'click_race';
  readonly maxPlayers = 4;
  readonly turnBased = false;
  readonly tickRate = 10;

  private targetScore = 20;

  getValidActions(playerId: string): Action[] {
    if (!this.state.players[playerId]?.active) return [];
    return [
      {
        type: 'click',
        playerId,
        payload: {},
        timestamp: Date.now(),
      },
    ];
  }

  validateAction(playerId: string, action: Action): ValidationResult {
    if (!this.state.players[playerId]) {
      return { valid: false, reason: 'Player not in game' };
    }
    if (action.type !== 'click') {
      return { valid: false, reason: 'Invalid action type' };
    }
    return { valid: true };
  }

  applyAction(playerId: string, action: Action): ActionResult {
    const validation = this.validateAction(playerId, action);
    if (!validation.valid) {
      return {
        success: false,
        effects: [],
        events: [],
        error: validation.reason,
      };
    }

    const player = this.state.players[playerId];
    player.score += 1;

    const events: GameEvent[] = [
      {
        type: 'score',
        playerId,
        data: { score: player.score },
        timestamp: Date.now(),
      },
    ];

    if (player.score >= this.targetScore) {
      this.state.phase = 'finished';
      events.push({
        type: 'game_over',
        playerId,
        data: { winner: playerId },
        timestamp: Date.now(),
      });
    }

    return { success: true, effects: [], events };
  }

  tick(_deltaTime: number): TickResult {
    this.state.turn += 1;
    return {
      state: this.getState(),
      events: [],
      terminal: this.isTerminal(),
    };
  }
}

export default BaseGame;

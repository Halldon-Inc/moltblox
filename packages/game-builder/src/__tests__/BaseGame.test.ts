import { describe, it, expect } from 'vitest';
import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult, GameState } from '@moltblox/protocol';

class TestGame extends BaseGame {
  readonly name = 'TestGame';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private gameOverFlag = false;
  private winnerPlayer: string | null = null;

  protected initializeState(playerIds: string[]): Record<string, unknown> {
    return {
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      moves: [],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    if (action.type === 'score') {
      const scores = { ...(this.state.data as any).scores };
      scores[playerId] =
        (scores[playerId] || 0) + (((action.payload as any).points as number) || 1);
      return {
        success: true,
        newState: {
          ...this.state,
          data: { ...this.state.data, scores },
        },
      };
    }
    if (action.type === 'end_game') {
      this.gameOverFlag = true;
      this.winnerPlayer = playerId;
      return { success: true, newState: this.state };
    }
    return { success: false, error: 'Unknown action type' };
  }

  protected checkGameOver(): boolean {
    return this.gameOverFlag;
  }

  protected determineWinner(): string | null {
    return this.winnerPlayer;
  }

  protected calculateScores(): Record<string, number> {
    return (this.state.data as any).scores || {};
  }

  public exposedEmitEvent(type: string, playerId?: string, data?: Record<string, unknown>): void {
    this.emitEvent(type, playerId, data);
  }

  public exposedGetTurn(): number {
    return this.getTurn();
  }

  public getEvents() {
    return [...this.events];
  }
}
describe('BaseGame', () => {
  describe('initialize', () => {
    it('sets state to playing', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const state = game.getState();
      expect(state.phase).toBe('playing');
    });

    it('sets turn to 0', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      expect(game.getState().turn).toBe(0);
    });

    it('throws with 0 players', () => {
      const game = new TestGame();
      expect(() => game.initialize([])).toThrow('At least one player required');
    });

    it('throws with too many players', () => {
      const game = new TestGame();
      expect(() => game.initialize(['p1', 'p2', 'p3', 'p4', 'p5'])).toThrow(
        'Max 4 players allowed',
      );
    });

    it('emits game_started event', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const events = game.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('game_started');
    });
  });

  describe('handleAction', () => {
    it('returns error for invalid player', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const result = game.handleAction('unknown', {
        type: 'score',
        payload: {},
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a valid player');
    });

    it('returns error after game is over', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      game.handleAction('p1', { type: 'end_game', payload: {}, timestamp: Date.now() });
      const result = game.handleAction('p1', { type: 'score', payload: {}, timestamp: Date.now() });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is already over');
    });

    it('processes valid actions', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const result = game.handleAction('p1', {
        type: 'score',
        payload: { points: 10 },
        timestamp: Date.now(),
      });
      expect(result.success).toBe(true);
    });

    it('returns error for unknown action type', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const result = game.handleAction('p1', {
        type: 'invalid',
        payload: {},
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown action type');
    });
  });
  describe('getState / getStateForPlayer', () => {
    it('returns a copy of state', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const state1 = game.getState();
      const state2 = game.getState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('getStateForPlayer returns state copy', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      const state = game.getStateForPlayer('p1');
      expect(state.phase).toBe('playing');
      expect(state).not.toBe(game.getState());
    });
  });

  describe('emitEvent', () => {
    it('creates events with correct structure', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      game.exposedEmitEvent('test_event', 'p1', { value: 42 });
      const events = game.getEvents();
      const testEvent = events.find((e) => e.type === 'test_event');
      expect(testEvent).toBeDefined();
      expect(testEvent!.playerId).toBe('p1');
      expect(testEvent!.data).toEqual({ value: 42 });
      expect(testEvent!.timestamp).toBeTypeOf('number');
    });
  });

  describe('getTurn', () => {
    it('increments on successful actions', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      expect(game.exposedGetTurn()).toBe(0);
      game.handleAction('p1', { type: 'score', payload: { points: 1 }, timestamp: Date.now() });
      expect(game.exposedGetTurn()).toBe(1);
      game.handleAction('p2', { type: 'score', payload: { points: 1 }, timestamp: Date.now() });
      expect(game.exposedGetTurn()).toBe(2);
    });

    it('does not increment on failed actions', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      game.handleAction('unknown', { type: 'score', payload: {}, timestamp: Date.now() });
      expect(game.exposedGetTurn()).toBe(0);
    });
  });

  describe('isGameOver', () => {
    it('returns false initially', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      expect(game.isGameOver()).toBe(false);
    });

    it('returns true after game ends', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      game.handleAction('p1', { type: 'end_game', payload: {}, timestamp: Date.now() });
      expect(game.isGameOver()).toBe(true);
    });
  });

  describe('getWinner / getScores', () => {
    it('returns winner after game ends', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      game.handleAction('p1', { type: 'end_game', payload: {}, timestamp: Date.now() });
      expect(game.getWinner()).toBe('p1');
    });

    it('returns scores', () => {
      const game = new TestGame();
      game.initialize(['p1', 'p2']);
      game.handleAction('p1', { type: 'score', payload: { points: 10 }, timestamp: Date.now() });
      const scores = game.getScores();
      expect(scores['p1']).toBe(10);
      expect(scores['p2']).toBe(0);
    });
  });
});

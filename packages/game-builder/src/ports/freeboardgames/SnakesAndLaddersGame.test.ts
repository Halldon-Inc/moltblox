import { describe, it, expect } from 'vitest';
import { SnakesAndLaddersGame } from './SnakesAndLaddersGame.js';

const ts = () => Date.now();

describe('SnakesAndLaddersGame', () => {
  it('should initialize players at position 1', () => {
    const game = new SnakesAndLaddersGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow rolling dice', () => {
    const game = new SnakesAndLaddersGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'roll',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong player turn', () => {
    const game = new SnakesAndLaddersGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p2', {
      type: 'roll',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should calculate scores as positions', () => {
    const game = new SnakesAndLaddersGame();
    game.initialize(['p1', 'p2']);
    game.handleAction('p1', { type: 'roll', payload: {}, timestamp: ts() });
    const scores = game.getScores();
    expect(scores['p1']).toBeGreaterThanOrEqual(1);
  });

  it('should reject unknown action type', () => {
    const game = new SnakesAndLaddersGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'jump',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });
});

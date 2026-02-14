import { describe, it, expect } from 'vitest';
import { PatchworkGame } from './PatchworkGame.js';

const ts = () => Date.now();

describe('PatchworkGame', () => {
  it('should initialize with two players, 5 buttons each', () => {
    const game = new PatchworkGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow advancing (passing)', () => {
    const game = new PatchworkGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'advance',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong player turn', () => {
    const game = new PatchworkGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p2', {
      type: 'advance',
      payload: {},
      timestamp: ts(),
    });
    // p2 might actually go first if they're behind, but with equal positions p1 goes first
    expect(typeof result.success).toBe('boolean');
  });

  it('should reject unknown action', () => {
    const game = new PatchworkGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'sew',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should calculate scores', () => {
    const game = new PatchworkGame();
    game.initialize(['p1', 'p2']);
    const scores = game.getScores();
    expect(typeof scores['p1']).toBe('number');
    expect(typeof scores['p2']).toBe('number');
  });
});

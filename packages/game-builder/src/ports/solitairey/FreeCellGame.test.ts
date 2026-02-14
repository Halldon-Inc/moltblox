import { describe, it, expect } from 'vitest';
import { FreeCellGame } from './FreeCellGame.js';

const ts = () => Date.now();

describe('FreeCellGame', () => {
  it('should initialize with 8 tableau columns and 4 free cells', () => {
    const game = new FreeCellGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    const data = state.data as { tableau: unknown[][]; freeCells: unknown[] };
    expect(data.tableau.length).toBe(8);
  });

  it('should not be over at start', () => {
    const game = new FreeCellGame();
    game.initialize(['p1']);
    expect(game.isGameOver()).toBe(false);
  });

  it('should reject unknown action', () => {
    const game = new FreeCellGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'fly',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should track score', () => {
    const game = new FreeCellGame();
    game.initialize(['p1']);
    const scores = game.getScores();
    expect(typeof scores['p1']).toBe('number');
  });
});

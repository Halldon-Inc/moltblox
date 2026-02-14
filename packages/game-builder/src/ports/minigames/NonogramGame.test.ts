import { describe, it, expect } from 'vitest';
import { NonogramGame } from './NonogramGame.js';

describe('NonogramGame', () => {
  it('initializes 5x5 grid with clues', () => {
    const game = new NonogramGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect((state.data.rowClues as number[][]).length).toBe(5);
    expect((state.data.colClues as number[][]).length).toBe(5);
  });

  it('fills a cell', () => {
    const game = new NonogramGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'fill',
      payload: { row: 0, col: 0 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('marks a cell as empty', () => {
    const game = new NonogramGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'mark',
      payload: { row: 0, col: 0 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects out of bounds', () => {
    const game = new NonogramGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'fill',
      payload: { row: 10, col: 0 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

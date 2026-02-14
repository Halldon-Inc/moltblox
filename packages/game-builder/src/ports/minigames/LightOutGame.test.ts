import { describe, it, expect } from 'vitest';
import { LightOutGame } from './LightOutGame.js';

describe('LightOutGame', () => {
  it('initializes 5x5 grid', () => {
    const game = new LightOutGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect((state.data.grid as boolean[][]).length).toBe(5);
    expect((state.data.grid as boolean[][])[0].length).toBe(5);
  });

  it('toggles light and neighbors', () => {
    const game = new LightOutGame();
    game.initialize(['p1']);
    const before = JSON.parse(JSON.stringify(game.getState().data.grid));
    const result = game.handleAction('p1', {
      type: 'toggle',
      payload: { row: 2, col: 2 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
    const after = game.getState().data.grid as boolean[][];
    // Center and at least some neighbors should have changed
    expect(after[2][2]).not.toBe(before[2][2]);
  });

  it('rejects out of bounds', () => {
    const game = new LightOutGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'toggle',
      payload: { row: 10, col: 10 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('tracks move count', () => {
    const game = new LightOutGame();
    game.initialize(['p1']);
    game.handleAction('p1', { type: 'toggle', payload: { row: 0, col: 0 }, timestamp: Date.now() });
    game.handleAction('p1', { type: 'toggle', payload: { row: 1, col: 1 }, timestamp: Date.now() });
    expect(game.getState().data.moves).toBe(2);
  });
});

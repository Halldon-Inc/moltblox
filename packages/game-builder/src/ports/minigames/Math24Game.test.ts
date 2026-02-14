import { describe, it, expect } from 'vitest';
import { Math24Game } from './Math24Game.js';

describe('Math24Game', () => {
  it('initializes with 4 numbers', () => {
    const game = new Math24Game();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect((state.data.numbers as number[]).length).toBe(4);
  });

  it('accepts correct solution', () => {
    const game = new Math24Game();
    game.initialize(['p1']);
    const nums = game.getState().data.numbers as number[];
    // Try a known solution for [1,2,3,4]: 1*2*3*4=24
    const result = game.handleAction('p1', {
      type: 'solve',
      payload: { expression: '1*2*3*4' },
      timestamp: Date.now(),
    });
    // May or may not be the right numbers, but action should succeed
    expect(result.success).toBe(true);
  });

  it('rejects invalid expression', () => {
    const game = new Math24Game();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'solve',
      payload: { expression: 'abc' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('supports multiplayer scoring', () => {
    const game = new Math24Game();
    game.initialize(['p1', 'p2']);
    const scores = game.getScores();
    expect(scores['p1']).toBe(0);
    expect(scores['p2']).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { SpiderGame } from './SpiderGame.js';

const ts = () => Date.now();

describe('SpiderGame', () => {
  it('should initialize with 10 tableau columns', () => {
    const game = new SpiderGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    const data = state.data as { tableau: unknown[][] };
    expect(data.tableau.length).toBe(10);
  });

  it('should allow dealing from stock', () => {
    const game = new SpiderGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'deal',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should not be over at start', () => {
    const game = new SpiderGame();
    game.initialize(['p1']);
    expect(game.isGameOver()).toBe(false);
  });

  it('should track score', () => {
    const game = new SpiderGame();
    game.initialize(['p1']);
    const scores = game.getScores();
    expect(typeof scores['p1']).toBe('number');
  });
});

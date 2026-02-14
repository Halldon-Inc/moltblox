import { describe, it, expect } from 'vitest';
import { SushiGoGame } from './SushiGoGame.js';

const ts = () => Date.now();

describe('SushiGoGame', () => {
  it('should initialize with hands dealt', () => {
    const game = new SushiGoGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow picking a card', () => {
    const game = new SushiGoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'pick',
      payload: { cardIndex: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid card index', () => {
    const game = new SushiGoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'pick',
      payload: { cardIndex: 99 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong action type', () => {
    const game = new SushiGoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'eat',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should calculate scores', () => {
    const game = new SushiGoGame();
    game.initialize(['p1', 'p2']);
    const scores = game.getScores();
    expect(typeof scores['p1']).toBe('number');
    expect(typeof scores['p2']).toBe('number');
  });
});

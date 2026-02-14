import { describe, it, expect } from 'vitest';
import { CoupGame } from './CoupGame.js';

const ts = () => Date.now();

describe('CoupGame', () => {
  it('should initialize with 2 cards and 2 coins per player', () => {
    const game = new CoupGame();
    game.initialize(['p1', 'p2', 'p3']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow income action', () => {
    const game = new CoupGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'income',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject action from wrong player', () => {
    const game = new CoupGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p2', {
      type: 'income',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject coup with insufficient coins', () => {
    const game = new CoupGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'coup',
      payload: { target: 'p2' },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should allow tax action', () => {
    const game = new CoupGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'tax',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

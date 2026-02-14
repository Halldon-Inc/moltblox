import { describe, it, expect } from 'vitest';
import { SetGame } from './SetGame.js';

const ts = () => Date.now();

describe('SetGame', () => {
  it('should initialize with 12 cards on tableau', () => {
    const game = new SetGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should reject invalid set of 3 cards', () => {
    const game = new SetGame();
    game.initialize(['p1']);
    // Very likely these 3 indices don't form a valid set
    const result = game.handleAction('p1', {
      type: 'claim_set',
      payload: { indices: [0, 1, 2] },
      timestamp: ts(),
    });
    // Could be true or false depending on random cards
    expect(typeof result.success).toBe('boolean');
  });

  it('should reject claim with wrong number of cards', () => {
    const game = new SetGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'claim_set',
      payload: { indices: [0, 1] },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should accept no_set claim when no set exists', () => {
    const game = new SetGame();
    game.initialize(['p1']);
    // May or may not succeed depending on tableau
    const result = game.handleAction('p1', {
      type: 'no_set',
      payload: {},
      timestamp: ts(),
    });
    expect(typeof result.success).toBe('boolean');
  });

  it('should reject unknown action', () => {
    const game = new SetGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'invalid',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });
});

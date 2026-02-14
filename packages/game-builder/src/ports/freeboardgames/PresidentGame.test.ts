import { describe, it, expect } from 'vitest';
import { PresidentGame } from './PresidentGame.js';

const ts = () => Date.now();

describe('PresidentGame', () => {
  it('should initialize and deal cards', () => {
    const game = new PresidentGame();
    game.initialize(['p1', 'p2', 'p3']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow passing', () => {
    const game = new PresidentGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'pass',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should allow playing cards', () => {
    const game = new PresidentGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    const data = state.data as { hands: Record<string, number[]> };
    const hand = data.hands['p1'];
    if (hand.length > 0) {
      const card = hand[0];
      const result = game.handleAction('p1', {
        type: 'play',
        payload: { cards: [card] },
        timestamp: ts(),
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject playing cards not in hand', () => {
    const game = new PresidentGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'play',
      payload: { cards: [99] },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong player action', () => {
    const game = new PresidentGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p2', {
      type: 'pass',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });
});

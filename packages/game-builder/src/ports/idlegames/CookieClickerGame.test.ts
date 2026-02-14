import { describe, it, expect } from 'vitest';
import { CookieClickerGame } from './CookieClickerGame.js';

describe('CookieClickerGame', () => {
  it('initializes with 0 cookies', () => {
    const game = new CookieClickerGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(state.data.cookies).toBe(0);
  });

  it('clicking earns cookies', () => {
    const game = new CookieClickerGame();
    game.initialize(['p1']);
    game.handleAction('p1', { type: 'click', payload: {}, timestamp: Date.now() });
    expect(game.getState().data.cookies as number).toBeGreaterThan(0);
  });

  it('can buy producer with enough cookies', () => {
    const game = new CookieClickerGame();
    game.initialize(['p1']);
    // Click many times to accumulate cookies (cursor baseCost is 15)
    for (let i = 0; i < 30; i++) {
      game.handleAction('p1', { type: 'click', payload: {}, timestamp: Date.now() });
    }
    const cookies = game.getState().data.cookies as number;
    expect(cookies).toBeGreaterThanOrEqual(15);
    const result = game.handleAction('p1', {
      type: 'buy_producer',
      payload: { producerId: 'cursor' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects buying without enough cookies', () => {
    const game = new CookieClickerGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'buy_producer',
      payload: { producerId: 'factory' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

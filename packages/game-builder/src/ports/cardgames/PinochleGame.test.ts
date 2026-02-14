import { describe, it, expect, beforeEach } from 'vitest';
import { PinochleGame } from './PinochleGame';

describe('PinochleGame', () => {
  let game: PinochleGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new PinochleGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Pinochle');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 12 cards to each of 4 players (48 card deck)', () => {
    const data = game.getState().data as any;
    for (let i = 0; i < 4; i++) {
      expect(data.hands[i]).toHaveLength(12);
    }
  });

  it('should start in bid phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('bid');
  });

  it('should accept valid bid from correct player', () => {
    // currentPlayer starts at 1 (left of dealer)
    const r = game.handleAction('p2', {
      type: 'bid',
      payload: { amount: 20 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject bid from wrong player', () => {
    const r = game.handleAction('p1', {
      type: 'bid',
      payload: { amount: 20 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { SpadesClassicGame } from './SpadesClassicGame';

describe('SpadesClassicGame', () => {
  let game: SpadesClassicGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new SpadesClassicGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Spades Classic');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 13 cards to each player', () => {
    const data = game.getState().data as any;
    for (let i = 0; i < 4; i++) {
      expect(data.hands[i]).toHaveLength(13);
    }
  });

  it('should start in bid phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('bid');
  });

  it('should accept valid bid', () => {
    // Player at currentPlayer (1) bids
    const r = game.handleAction('p2', {
      type: 'bid',
      payload: { amount: 3 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject bid from wrong player', () => {
    const r = game.handleAction('p1', {
      type: 'bid',
      payload: { amount: 3 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

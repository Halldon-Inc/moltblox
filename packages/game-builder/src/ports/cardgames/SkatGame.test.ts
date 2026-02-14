import { describe, it, expect, beforeEach } from 'vitest';
import { SkatGame } from './SkatGame';

describe('SkatGame', () => {
  let game: SkatGame;
  const players = ['p1', 'p2', 'p3'];

  beforeEach(() => {
    game = new SkatGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Skat');
    expect(game.maxPlayers).toBe(3);
  });

  it('should deal 10 cards to each player', () => {
    const data = game.getState().data as any;
    for (const pid of players) {
      expect(data.hands[pid]).toHaveLength(10);
    }
  });

  it('should have 2 cards in the skat', () => {
    const data = game.getState().data as any;
    expect(data.skat).toHaveLength(2);
  });

  it('should start in bidding phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('bidding');
  });

  it('should accept bid from correct player', () => {
    // Middlehand (player index 1 = p2) starts bidding
    const r = game.handleAction('p2', {
      type: 'bid',
      payload: { amount: 18 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

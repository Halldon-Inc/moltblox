import { describe, it, expect, beforeEach } from 'vitest';
import { PitGame } from './PitGame';

describe('PitGame', () => {
  let game: PitGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new PitGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Pit');
    expect(game.maxPlayers).toBe(8);
  });

  it('should deal cards to each player', () => {
    const data = game.getState().data as any;
    for (let i = 0; i < 4; i++) {
      expect(data.hands[i].length).toBeGreaterThan(0);
    }
  });

  it('should start with no offers', () => {
    const data = game.getState().data as any;
    expect(data.currentOffers).toHaveLength(0);
  });

  it('should allow a player to make an offer', () => {
    const data = game.getState().data as any;
    // Pick a commodity that player 0 actually has
    const commodity = data.hands[0][0];
    const r = game.handleAction('p1', {
      type: 'offer',
      payload: { count: 1, commodity },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { WhistGame } from './WhistGame';

describe('WhistGame', () => {
  let game: WhistGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new WhistGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Whist');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 13 cards to each player', () => {
    const data = game.getState().data as any;
    for (let i = 0; i < 4; i++) {
      expect(data.hands[i]).toHaveLength(13);
    }
  });

  it('should set a trump suit', () => {
    const data = game.getState().data as any;
    expect(data.trumpSuit).toBeTruthy();
  });

  it('should reject action from wrong player', () => {
    // currentPlayer starts at 1 (left of dealer)
    const data = game.getState().data as any;
    const card = data.hands[0][0];
    const r = game.handleAction('p1', {
      type: 'play',
      payload: { card: `${card.rank}_${card.suit}` },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { RummyGame } from './RummyGame';

describe('RummyGame', () => {
  let game: RummyGame;
  const p1 = 'alice';
  const p2 = 'bob';

  beforeEach(() => {
    game = new RummyGame();
    game.initialize([p1, p2]);
  });

  it('should initialize with correct metadata', () => {
    expect(game.name).toBe('Rummy');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 10 cards in 2-player', () => {
    const data = game.getState().data as any;
    expect(data.hands[0]).toHaveLength(10);
    expect(data.hands[1]).toHaveLength(10);
  });

  it('should start in draw phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('draw');
    expect(data.hasDrawn).toBe(false);
  });

  it('should allow drawing from deck', () => {
    const r = game.handleAction(p1, {
      type: 'draw',
      payload: {},
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
    const data = (r.newState?.data ?? game.getState().data) as any;
    expect(data.hasDrawn).toBe(true);
  });

  it('should reject discard before drawing', () => {
    const data = game.getState().data as any;
    const card = data.hands[0][0];
    const r = game.handleAction(p1, {
      type: 'discard',
      payload: { card: `${card.rank}_${card.suit}` },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

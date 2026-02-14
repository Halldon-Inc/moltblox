import { describe, it, expect, beforeEach } from 'vitest';
import { CanstaGame } from './CanstaGame';

describe('CanstaGame', () => {
  let game: CanstaGame;
  const p1 = 'alice';
  const p2 = 'bob';

  beforeEach(() => {
    game = new CanstaGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Canasta');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 15 cards in 2-player game', () => {
    const data = game.getState().data as any;
    expect(data.hands[0]).toHaveLength(15);
    expect(data.hands[1]).toHaveLength(15);
  });

  it('should start in draw phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('draw');
  });

  it('should allow drawing from deck', () => {
    const r = game.handleAction(p1, {
      type: 'draw',
      payload: {},
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
    const data = (r.newState?.data ?? game.getState().data) as any;
    expect(data.phase).toBe('play');
  });

  it('should reject discard in wrong phase', () => {
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

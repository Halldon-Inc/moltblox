import { describe, it, expect, beforeEach } from 'vitest';
import { CanastaGame } from './CanastaGame';

describe('CanastaGame (new)', () => {
  let game: CanastaGame;
  const p1 = 'alice';
  const p2 = 'bob';

  beforeEach(() => {
    game = new CanastaGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Canasta');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 15 cards in 2-player game', () => {
    const data = game.getState().data as any;
    expect(data.hands[p1]).toHaveLength(15);
    expect(data.hands[p2]).toHaveLength(15);
  });

  it('should start in play phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('play');
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

  it('should reject draw when already drawn', () => {
    game.handleAction(p1, { type: 'draw', payload: {}, timestamp: Date.now() });
    const r = game.handleAction(p1, { type: 'draw', payload: {}, timestamp: Date.now() });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

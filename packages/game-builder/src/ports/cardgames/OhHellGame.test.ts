import { describe, it, expect, beforeEach } from 'vitest';
import { OhHellGame } from './OhHellGame';

describe('OhHellGame', () => {
  let game: OhHellGame;
  const p1 = 'alice';
  const p2 = 'bob';
  const p3 = 'charlie';

  beforeEach(() => {
    game = new OhHellGame();
    game.initialize([p1, p2, p3]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Oh Hell');
    expect(game.maxPlayers).toBe(6);
  });

  it('should start with 1 card per player in first round', () => {
    const data = game.getState().data as any;
    expect(data.handSize).toBe(1);
    for (let i = 0; i < 3; i++) {
      expect(data.hands[i]).toHaveLength(1);
    }
  });

  it('should start in bid phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('bid');
  });

  it('should accept valid bid from correct player', () => {
    // currentPlayer starts at 1
    const r = game.handleAction(p2, {
      type: 'bid',
      payload: { amount: 0 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject bid from wrong player', () => {
    const r = game.handleAction(p1, {
      type: 'bid',
      payload: { amount: 0 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

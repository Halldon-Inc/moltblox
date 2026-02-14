import { describe, it, expect, beforeEach } from 'vitest';
import { PresidentGame } from './PresidentGame';

describe('PresidentGame', () => {
  let game: PresidentGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new PresidentGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('President');
    expect(game.maxPlayers).toBe(6);
  });

  it('should deal all 52 cards among players', () => {
    const data = game.getState().data as any;
    let total = 0;
    for (const pid of players) {
      total += data.hands[pid].length;
    }
    expect(total).toBe(52);
  });

  it('should start in play phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('play');
  });

  it('should reject action from wrong player', () => {
    // currentPlayer is 0 = p1
    const r = game.handleAction('p2', {
      type: 'pass',
      payload: {},
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should reject pass when leading (no current play)', () => {
    const r = game.handleAction('p1', {
      type: 'pass',
      payload: {},
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

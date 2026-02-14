import { describe, it, expect, beforeEach } from 'vitest';
import { EuchreGame } from './EuchreGame';

describe('EuchreGame', () => {
  let game: EuchreGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new EuchreGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Euchre');
    expect(game.maxPlayers).toBe(4);
  });

  it('should deal 5 cards to each player', () => {
    const data = game.getState().data as any;
    for (const pid of players) {
      expect(data.hands[pid]).toHaveLength(5);
    }
  });

  it('should start in calling round 1', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('calling_round1');
  });

  it('should have a turned-up card', () => {
    const data = game.getState().data as any;
    expect(data.turnedUp).not.toBeNull();
  });

  it('should accept pass from correct player', () => {
    // currentPlayer is (dealer + 1) % 4 = 1 => p2
    const r = game.handleAction('p2', {
      type: 'pass',
      payload: {},
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject action from wrong player', () => {
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

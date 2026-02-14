import { describe, it, expect, beforeEach } from 'vitest';
import { DurakGame } from './DurakGame';

describe('DurakGame', () => {
  let game: DurakGame;
  const p1 = 'player1';
  const p2 = 'player2';

  beforeEach(() => {
    game = new DurakGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Durak');
    expect(game.maxPlayers).toBe(6);
  });

  it('should deal 6 cards to each player', () => {
    const data = game.getState().data as any;
    expect(data.hands[0]).toHaveLength(6);
    expect(data.hands[1]).toHaveLength(6);
  });

  it('should start in attack phase', () => {
    const data = game.getState().data as any;
    expect(data.phase).toBe('attack');
  });

  it('should allow first attack from attacker', () => {
    const data = game.getState().data as any;
    const card = data.hands[0][0];
    const r = game.handleAction(p1, {
      type: 'attack',
      payload: { card: `${card.rank}_${card.suit}` },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject attack from non-attacker', () => {
    const data = game.getState().data as any;
    const card = data.hands[1][0];
    const r = game.handleAction(p2, {
      type: 'attack',
      payload: { card: `${card.rank}_${card.suit}` },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

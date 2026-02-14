import { describe, it, expect, beforeEach } from 'vitest';
import { KingOfTheHillGame } from './KingOfTheHillGame';

describe('KingOfTheHillGame', () => {
  let game: KingOfTheHillGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new KingOfTheHillGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('King of the Hill');
    expect(game.maxPlayers).toBe(2);
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow standard pawn move', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject illegal pawn move', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should reject wrong turn', () => {
    const r = game.handleAction(p2, {
      type: 'move',
      payload: { from: 'e7', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should track scores as 0 at start', () => {
    const scores = game.getScores();
    expect(scores[p1]).toBe(0);
    expect(scores[p2]).toBe(0);
  });
});

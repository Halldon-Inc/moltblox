import { describe, it, expect, beforeEach } from 'vitest';
import { AntichessGame } from './AntichessGame';

describe('AntichessGame', () => {
  let game: AntichessGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new AntichessGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Antichess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should allow pawn opening', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should reject move of opponent piece', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e7', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

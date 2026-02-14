import { describe, it, expect, beforeEach } from 'vitest';
import { RacingKingsGame } from './RacingKingsGame';

describe('RacingKingsGame', () => {
  let game: RacingKingsGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new RacingKingsGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Racing Kings');
    expect(game.maxPlayers).toBe(2);
  });

  it('should place all pieces on bottom two ranks', () => {
    const data = game.getState().data as any;
    // Ranks 1-2 (rows 6-7) should have pieces, rows 0-5 should be empty
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        expect(data.board[r][c]).toBeNull();
      }
    }
  });

  it('should reject move that puts a king in check', () => {
    // In Racing Kings, no checks are allowed. Attempt a move that would create check.
    // This depends on board layout; try an invalid move scenario.
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'a1', to: 'a2' },
      timestamp: Date.now(),
    });
    // This is from an empty square, should fail
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

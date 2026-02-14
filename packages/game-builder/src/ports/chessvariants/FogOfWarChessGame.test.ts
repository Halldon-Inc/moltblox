import { describe, it, expect, beforeEach } from 'vitest';
import { FogOfWarChessGame } from './FogOfWarChessGame';

describe('FogOfWarChessGame', () => {
  let game: FogOfWarChessGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new FogOfWarChessGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Fog of War Chess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have a standard 8x8 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(8);
  });

  it('should allow valid pawn opening', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject moving opponent pieces', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e7', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

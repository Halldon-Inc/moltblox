import { describe, it, expect, beforeEach } from 'vitest';
import { GridChessGame } from './GridChessGame';

describe('GridChessGame', () => {
  let game: GridChessGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new GridChessGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Grid Chess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have a standard 8x8 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(8);
  });

  it('should reject move from wrong player', () => {
    const r = game.handleAction(p2, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
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

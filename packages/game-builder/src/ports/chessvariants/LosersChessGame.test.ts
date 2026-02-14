import { describe, it, expect, beforeEach } from 'vitest';
import { LosersChessGame } from './LosersChessGame';

describe('LosersChessGame', () => {
  let game: LosersChessGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new LosersChessGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Losers Chess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should set up a standard 8x8 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(8);
  });

  it('should allow pawn opening', () => {
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
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
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Chess960Game } from './Chess960Game';

describe('Chess960Game', () => {
  let game: Chess960Game;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new Chess960Game();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Chess960');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have an 8x8 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(8);
  });

  it('should place king between rooks for both players', () => {
    const data = game.getState().data as any;
    // White back rank (row 7)
    let kingCol = -1;
    const rookCols: number[] = [];
    for (let c = 0; c < 8; c++) {
      const piece = data.board[7][c];
      if (piece && piece.type === 'K') kingCol = c;
      if (piece && piece.type === 'R') rookCols.push(c);
    }
    expect(kingCol).toBeGreaterThan(-1);
    expect(rookCols).toHaveLength(2);
    expect(rookCols[0]).toBeLessThan(kingCol);
    expect(rookCols[1]).toBeGreaterThan(kingCol);
  });

  it('should place bishops on opposite colored squares', () => {
    const data = game.getState().data as any;
    const bishopCols: number[] = [];
    for (let c = 0; c < 8; c++) {
      if (data.board[7][c]?.type === 'B') bishopCols.push(c);
    }
    expect(bishopCols).toHaveLength(2);
    // Opposite colors means one even, one odd
    expect(bishopCols[0] % 2).not.toBe(bishopCols[1] % 2);
  });

  it('should mirror white position for black', () => {
    const data = game.getState().data as any;
    for (let c = 0; c < 8; c++) {
      expect(data.board[0][c]?.type).toBe(data.board[7][c]?.type);
    }
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

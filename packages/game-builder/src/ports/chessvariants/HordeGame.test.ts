import { describe, it, expect, beforeEach } from 'vitest';
import { HordeGame } from './HordeGame';

describe('HordeGame', () => {
  let game: HordeGame;
  const p1 = 'horde';
  const p2 = 'black';

  beforeEach(() => {
    game = new HordeGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Horde Chess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should fill ranks 1-4 with white pawns', () => {
    const data = game.getState().data as any;
    // Rows 4-7 should have white pawns
    for (let r = 4; r <= 7; r++) {
      for (let c = 0; c < 8; c++) {
        expect(data.board[r][c]).not.toBeNull();
        expect(data.board[r][c].type).toBe('P');
        expect(data.board[r][c].owner).toBe(p1);
      }
    }
  });

  it('should have black standard pieces on top rows', () => {
    const data = game.getState().data as any;
    // Row 0 should have black back rank pieces, row 1 should have black pawns
    expect(data.board[0][4].type).toBe('K');
    expect(data.board[0][4].owner).toBe(p2);
    for (let c = 0; c < 8; c++) {
      expect(data.board[1][c].type).toBe('P');
      expect(data.board[1][c].owner).toBe(p2);
    }
  });

  it('should allow horde pawn advance', () => {
    // Pawn at e5 (row 4, col 4) can move to e6 (row 3, col 4) but row 3 col 4 is empty
    // Actually row 4 col 4 pawn should move up. Pawns move based on direction.
    // White pawns at row 4+ move up (decreasing row).
    // Row 4 col 0 pawn -> row 3 col 0 (a5 pawn already at row 3 col 1)
    // Row 4 col 4 -> row 3 col 4 (e4 to e5)
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e4', to: 'e3' },
      timestamp: Date.now(),
    });
    // e4 is row 4, col 4. e3 is row 5, col 4. That's wrong direction.
    // Let's try a5 pawn (row 3, col 0) which has extra pawns. Actually a4 = row 4, col 0.
    // a4 to a3 = row 5 col 0. Not valid either. White pawns move upward = row decreasing.
    // a4 = row 4, col 0. a5 = row 3, col 0. But row 3 col 0 is null (extra pawns at b5,c5,f5,g5 only).
    const r2 = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'a4', to: 'a5' },
      timestamp: Date.now(),
    });
    expect(r2.success).toBe(true);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

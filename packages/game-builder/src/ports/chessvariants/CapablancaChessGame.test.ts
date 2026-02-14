import { describe, it, expect, beforeEach } from 'vitest';
import { CapablancaChessGame } from './CapablancaChessGame';

describe('CapablancaChessGame', () => {
  let game: CapablancaChessGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new CapablancaChessGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Capablanca Chess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have a 10-wide 8-tall board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(10);
  });

  it('should include Archbishop and Chancellor pieces', () => {
    const data = game.getState().data as any;
    // White back rank (row 7): R N A B Q K B C N R
    const types = data.board[7].map((p: any) => p?.type);
    expect(types).toContain('A'); // Archbishop
    expect(types).toContain('C'); // Chancellor
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

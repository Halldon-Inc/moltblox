import { describe, it, expect, beforeEach } from 'vitest';
import { ShogiGame } from './ShogiGame';

describe('ShogiGame', () => {
  let game: ShogiGame;
  const p1 = 'sente';
  const p2 = 'gote';

  beforeEach(() => {
    game = new ShogiGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Shogi');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have a 9x9 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(9);
    expect(data.board[0]).toHaveLength(9);
  });

  it('should place sente king at center of back rank', () => {
    const data = game.getState().data as any;
    expect(data.board[8][4]).not.toBeNull();
    expect(data.board[8][4].type).toBe('K');
    expect(data.board[8][4].owner).toBe(p1);
  });

  it('should place gote king at center of top rank', () => {
    const data = game.getState().data as any;
    expect(data.board[0][4]).not.toBeNull();
    expect(data.board[0][4].type).toBe('K');
    expect(data.board[0][4].owner).toBe(p2);
  });

  it('should start with empty reserves', () => {
    const data = game.getState().data as any;
    expect(data.reserves[p1]).toHaveLength(0);
    expect(data.reserves[p2]).toHaveLength(0);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });
});

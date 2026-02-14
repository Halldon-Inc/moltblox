import { describe, it, expect, beforeEach } from 'vitest';
import { MakrukGame } from './MakrukGame';

describe('MakrukGame', () => {
  let game: MakrukGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new MakrukGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Makruk');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have an 8x8 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(8);
  });

  it('should have Met (queen) pieces', () => {
    const data = game.getState().data as any;
    // Check white back rank for Met
    let hasMet = false;
    for (let c = 0; c < 8; c++) {
      if (data.board[7][c]?.type === 'M') hasMet = true;
    }
    expect(hasMet).toBe(true);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

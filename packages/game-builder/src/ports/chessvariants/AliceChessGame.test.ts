import { describe, it, expect, beforeEach } from 'vitest';
import { AliceChessGame } from './AliceChessGame';

describe('AliceChessGame', () => {
  let game: AliceChessGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new AliceChessGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Alice Chess');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have two boards', () => {
    const data = game.getState().data as any;
    expect(data.boards).toHaveLength(2);
    expect(data.boards[0]).toHaveLength(8);
    expect(data.boards[1]).toHaveLength(8);
  });

  it('should start with pieces on board A only', () => {
    const data = game.getState().data as any;
    // Board B should be empty
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        expect(data.boards[1][r][c]).toBeNull();
      }
    }
  });

  it('should have pieces on board A', () => {
    const data = game.getState().data as any;
    // Board A should have standard setup
    let pieceCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (data.boards[0][r][c]) pieceCount++;
      }
    }
    expect(pieceCount).toBe(32);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

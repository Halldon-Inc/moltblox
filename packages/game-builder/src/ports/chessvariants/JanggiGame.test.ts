import { describe, it, expect, beforeEach } from 'vitest';
import { JanggiGame } from './JanggiGame';

describe('JanggiGame', () => {
  let game: JanggiGame;
  const p1 = 'cho';
  const p2 = 'han';

  beforeEach(() => {
    game = new JanggiGame();
    game.initialize([p1, p2]);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Janggi');
    expect(game.maxPlayers).toBe(2);
  });

  it('should have a 9x10 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(10);
    expect(data.board[0]).toHaveLength(9);
  });

  it('should place generals in palaces', () => {
    const data = game.getState().data as any;
    // Cho general at row 8, col 4
    expect(data.board[8][4]).not.toBeNull();
    expect(data.board[8][4].type).toBe('G');
    expect(data.board[8][4].owner).toBe(p1);
    // Han general at row 1, col 4
    expect(data.board[1][4]).not.toBeNull();
    expect(data.board[1][4].type).toBe('G');
    expect(data.board[1][4].owner).toBe(p2);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

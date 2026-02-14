import { describe, it, expect, beforeEach } from 'vitest';
import { BughouseGame } from './BughouseGame';

describe('BughouseGame', () => {
  let game: BughouseGame;
  const players = ['p1', 'p2', 'p3', 'p4'];

  beforeEach(() => {
    game = new BughouseGame();
    game.initialize(players);
  });

  it('should initialize correctly', () => {
    expect(game.name).toBe('Bughouse');
    expect(game.maxPlayers).toBe(4);
  });

  it('should have two boards', () => {
    const data = game.getState().data as any;
    expect(data.boards).toHaveLength(2);
    expect(data.boards[0]).toHaveLength(8);
    expect(data.boards[1]).toHaveLength(8);
  });

  it('should assign correct players to boards', () => {
    const data = game.getState().data as any;
    // Board A: p1(white) vs p2(black)
    expect(data.boardPlayers[0]).toEqual(['p1', 'p2']);
    // Board B: p4(white) vs p3(black)
    expect(data.boardPlayers[1]).toEqual(['p4', 'p3']);
  });

  it('should start with empty reserves for all players', () => {
    const data = game.getState().data as any;
    for (const p of players) {
      expect(data.reserves[p]).toHaveLength(0);
    }
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have winner null at start', () => {
    expect(game.getWinner()).toBeNull();
  });
});

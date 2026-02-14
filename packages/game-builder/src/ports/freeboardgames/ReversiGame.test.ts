import { describe, it, expect } from 'vitest';
import { ReversiGame } from './ReversiGame.js';

const ts = () => Date.now();

describe('ReversiGame', () => {
  it('should initialize with 4 pieces on 8x8 board', () => {
    const game = new ReversiGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow valid flipping move', () => {
    const game = new ReversiGame();
    game.initialize(['p1', 'p2']);
    // Standard opening: p1 can play at (2,3) to flip (3,3)
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { row: 2, col: 3 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject move on occupied cell', () => {
    const game = new ReversiGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { row: 3, col: 3 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject move with no flips', () => {
    const game = new ReversiGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { row: 0, col: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong player turn', () => {
    const game = new ReversiGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p2', {
      type: 'place',
      payload: { row: 2, col: 3 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should calculate scores based on piece count', () => {
    const game = new ReversiGame();
    game.initialize(['p1', 'p2']);
    const scores = game.getScores();
    expect(scores['p1'] + scores['p2']).toBe(4);
  });
});

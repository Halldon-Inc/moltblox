import { describe, it, expect } from 'vitest';
import { KlondikeGame } from './KlondikeGame.js';

const ts = () => Date.now();

describe('KlondikeGame', () => {
  it('should initialize with 7 tableau columns', () => {
    const game = new KlondikeGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
    const data = state.data as { tableau: unknown[][] };
    expect(data.tableau.length).toBe(7);
  });

  it('should have correct number of cards in tableau', () => {
    const game = new KlondikeGame();
    game.initialize(['p1']);
    const state = game.getState();
    const data = state.data as { tableau: unknown[][] };
    // Columns should have 1, 2, 3, 4, 5, 6, 7 cards
    for (let i = 0; i < 7; i++) {
      expect(data.tableau[i].length).toBe(i + 1);
    }
  });

  it('should allow drawing from stock', () => {
    const game = new KlondikeGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'draw',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid player', () => {
    const game = new KlondikeGame();
    game.initialize(['p1']);
    const result = game.handleAction('p2', {
      type: 'draw',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject unknown action type', () => {
    const game = new KlondikeGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'teleport',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should track scores', () => {
    const game = new KlondikeGame();
    game.initialize(['p1']);
    const scores = game.getScores();
    expect(scores['p1']).toBe(0);
  });
});

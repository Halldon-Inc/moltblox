import { describe, it, expect } from 'vitest';
import { OsmosisGame } from './OsmosisGame.js';

const ts = () => Date.now();

describe('OsmosisGame', () => {
  it('should initialize with 4 reserves and 4 foundations', () => {
    const game = new OsmosisGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    const data = state.data as { reserves: unknown[][]; foundations: unknown[][] };
    expect(data.reserves.length).toBe(4);
    expect(data.foundations.length).toBe(4);
  });

  it('should have first foundation with 1 starter card', () => {
    const game = new OsmosisGame();
    game.initialize(['p1']);
    const state = game.getState();
    const data = state.data as { foundations: unknown[][] };
    expect(data.foundations[0].length).toBe(1);
  });

  it('should allow drawing from stock', () => {
    const game = new OsmosisGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'draw',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid source', () => {
    const game = new OsmosisGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { from: 'nowhere', to: 'foundation:0' },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should not be game over at start', () => {
    const game = new OsmosisGame();
    game.initialize(['p1']);
    expect(game.isGameOver()).toBe(false);
  });
});

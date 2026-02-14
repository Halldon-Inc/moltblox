import { describe, it, expect } from 'vitest';
import { HiveGame } from './HiveGame.js';

const ts = () => Date.now();

describe('HiveGame', () => {
  it('should initialize with empty board', () => {
    const game = new HiveGame();
    game.initialize(['p1', 'p2']);
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow first piece placement anywhere', () => {
    const game = new HiveGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { piece: 'queen', q: 0, r: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should require second piece adjacent to first', () => {
    const game = new HiveGame();
    game.initialize(['p1', 'p2']);
    game.handleAction('p1', {
      type: 'place',
      payload: { piece: 'ant', q: 0, r: 0 },
      timestamp: ts(),
    });
    const result = game.handleAction('p2', {
      type: 'place',
      payload: { piece: 'ant', q: 1, r: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject placing on occupied hex', () => {
    const game = new HiveGame();
    game.initialize(['p1', 'p2']);
    game.handleAction('p1', {
      type: 'place',
      payload: { piece: 'ant', q: 0, r: 0 },
      timestamp: ts(),
    });
    const result = game.handleAction('p2', {
      type: 'place',
      payload: { piece: 'ant', q: 0, r: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject placing piece not in hand', () => {
    const game = new HiveGame();
    game.initialize(['p1', 'p2']);
    // Place queen
    game.handleAction('p1', {
      type: 'place',
      payload: { piece: 'queen', q: 0, r: 0 },
      timestamp: ts(),
    });
    game.handleAction('p2', {
      type: 'place',
      payload: { piece: 'queen', q: 1, r: 0 },
      timestamp: ts(),
    });
    // Try to place second queen (only 1 available)
    game.handleAction('p1', {
      type: 'place',
      payload: { piece: 'ant', q: -1, r: 0 },
      timestamp: ts(),
    });
    game.handleAction('p2', {
      type: 'place',
      payload: { piece: 'ant', q: 2, r: 0 },
      timestamp: ts(),
    });
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { piece: 'queen', q: -2, r: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { LudoGame } from './LudoGame.js';

const ts = () => Date.now();

describe('LudoGame', () => {
  it('should initialize with tokens in base', () => {
    const game = new LudoGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow rolling dice', () => {
    const game = new LudoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'roll',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong player rolling', () => {
    const game = new LudoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p2', {
      type: 'roll',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject moving without rolling', () => {
    const game = new LudoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { tokenIndex: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject unknown action', () => {
    const game = new LudoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'teleport',
      payload: {},
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });
});

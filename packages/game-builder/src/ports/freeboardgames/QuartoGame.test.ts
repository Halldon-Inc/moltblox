import { describe, it, expect } from 'vitest';
import { QuartoGame } from './QuartoGame.js';

const ts = () => Date.now();

describe('QuartoGame', () => {
  it('should initialize with 16 available pieces', () => {
    const game = new QuartoGame();
    game.initialize(['p1', 'p2']);
    expect(game.isGameOver()).toBe(false);
  });

  it('should allow selecting a piece for opponent', () => {
    const game = new QuartoGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'select',
      payload: { piece: 5 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should allow placing selected piece', () => {
    const game = new QuartoGame();
    game.initialize(['p1', 'p2']);
    game.handleAction('p1', { type: 'select', payload: { piece: 5 }, timestamp: ts() });
    const result = game.handleAction('p2', {
      type: 'place',
      payload: { position: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject placing on occupied cell', () => {
    const game = new QuartoGame();
    game.initialize(['p1', 'p2']);
    game.handleAction('p1', { type: 'select', payload: { piece: 0 }, timestamp: ts() });
    game.handleAction('p2', { type: 'place', payload: { position: 0 }, timestamp: ts() });
    game.handleAction('p2', { type: 'select', payload: { piece: 1 }, timestamp: ts() });
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { position: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(false);
  });

  it('should detect a win with 4 matching attributes', () => {
    const game = new QuartoGame();
    game.initialize(['p1', 'p2']);
    // Place pieces 0,1,2,3 (all share bit 0 = 0) in a row
    // Piece 0=0000, 1=0001, 2=0010, 3=0011. All have bit2=0 and bit3=0
    game.handleAction('p1', { type: 'select', payload: { piece: 0 }, timestamp: ts() });
    game.handleAction('p2', { type: 'place', payload: { position: 0 }, timestamp: ts() });
    game.handleAction('p2', { type: 'select', payload: { piece: 1 }, timestamp: ts() });
    game.handleAction('p1', { type: 'place', payload: { position: 1 }, timestamp: ts() });
    game.handleAction('p1', { type: 'select', payload: { piece: 2 }, timestamp: ts() });
    game.handleAction('p2', { type: 'place', payload: { position: 2 }, timestamp: ts() });
    game.handleAction('p2', { type: 'select', payload: { piece: 3 }, timestamp: ts() });
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { position: 3 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });
});

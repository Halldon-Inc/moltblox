import { describe, it, expect } from 'vitest';
import { SnakeGame } from './SnakeGame.js';

describe('SnakeGame', () => {
  it('initializes with snake on grid', () => {
    const game = new SnakeGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(state.data.snake).toBeDefined();
    expect((state.data.snake as number[][]).length).toBe(3);
    expect(state.data.score).toBe(0);
  });

  it('moves snake in valid direction', () => {
    const game = new SnakeGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { direction: 'up' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid direction', () => {
    const game = new SnakeGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { direction: 'diagonal' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects reverse direction', () => {
    const game = new SnakeGame();
    game.initialize(['p1']);
    // Snake starts facing right, so left is reverse
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { direction: 'left' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('game ends when snake hits wall', () => {
    const game = new SnakeGame({ width: 5, height: 5 });
    game.initialize(['p1']);
    // Move up repeatedly to hit wall
    for (let i = 0; i < 10; i++) {
      game.handleAction('p1', {
        type: 'move',
        payload: { direction: 'up' },
        timestamp: Date.now(),
      });
      if (game.isGameOver()) break;
    }
    // Eventually should hit wall
    expect(game.getState().data.dead).toBeDefined();
  });
});

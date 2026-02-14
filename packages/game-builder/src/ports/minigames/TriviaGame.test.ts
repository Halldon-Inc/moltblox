import { describe, it, expect } from 'vitest';
import { TriviaGame } from './TriviaGame.js';

describe('TriviaGame', () => {
  it('initializes with questions and scores', () => {
    const game = new TriviaGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect((state.data.questions as any[]).length).toBe(10);
    expect(state.data.scores).toBeDefined();
  });

  it('accepts answer choice', () => {
    const game = new TriviaGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'answer',
      payload: { choice: 1 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid choice', () => {
    const game = new TriviaGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'answer',
      payload: { choice: 99 },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('supports lifelines', () => {
    const game = new TriviaGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'use_lifeline',
      payload: { type: 'skip' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
    expect(game.getState().data.currentQ).toBe(1);
  });

  it('ends after all questions', () => {
    const game = new TriviaGame();
    game.initialize(['p1']);
    for (let i = 0; i < 10; i++) {
      game.handleAction('p1', { type: 'answer', payload: { choice: 0 }, timestamp: Date.now() });
    }
    expect(game.isGameOver()).toBe(true);
  });
});

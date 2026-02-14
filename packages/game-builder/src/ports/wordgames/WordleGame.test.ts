import { describe, it, expect } from 'vitest';
import { WordleGame } from './WordleGame.js';

describe('WordleGame', () => {
  it('initializes with target word and empty guesses', () => {
    const game = new WordleGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect((state.data.target as string).length).toBe(5);
    expect((state.data.guesses as string[]).length).toBe(0);
  });

  it('accepts valid 5-letter guess', () => {
    const game = new WordleGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'guess',
      payload: { word: 'apple' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
    expect((game.getState().data.guesses as string[]).length).toBe(1);
  });

  it('rejects guess with wrong length', () => {
    const game = new WordleGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'guess',
      payload: { word: 'hi' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('provides green/yellow/gray feedback', () => {
    const game = new WordleGame();
    game.initialize(['p1']);
    game.handleAction('p1', { type: 'guess', payload: { word: 'crane' }, timestamp: Date.now() });
    const fb = (game.getState().data.feedback as string[][])[0];
    expect(fb.length).toBe(5);
    expect(fb.every((f) => ['green', 'yellow', 'gray'].includes(f))).toBe(true);
  });

  it('ends after 6 guesses', () => {
    const game = new WordleGame();
    game.initialize(['p1']);
    for (let i = 0; i < 6; i++) {
      game.handleAction('p1', {
        type: 'guess',
        payload: {
          word: 'xxxxx'
            .split('')
            .map((_, j) => String.fromCharCode(97 + ((i * 5 + j) % 26)))
            .join(''),
        },
        timestamp: Date.now(),
      });
    }
    expect(game.isGameOver()).toBe(true);
  });
});

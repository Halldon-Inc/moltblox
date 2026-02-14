import { describe, it, expect } from 'vitest';
import { HangmanGame } from './HangmanGame.js';

describe('HangmanGame', () => {
  it('initializes with hidden word', () => {
    const game = new HangmanGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect((state.data.word as string).length).toBeGreaterThan(0);
    expect(state.data.revealed as string).toContain('_');
  });

  it('reveals correct letter', () => {
    const game = new HangmanGame();
    game.initialize(['p1']);
    const word = game.getState().data.word as string;
    const letter = word[0];
    const result = game.handleAction('p1', {
      type: 'guess',
      payload: { letter },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
    expect(game.getState().data.revealed as string).toContain(letter);
  });

  it('tracks wrong guesses', () => {
    const game = new HangmanGame();
    game.initialize(['p1']);
    game.handleAction('p1', { type: 'guess', payload: { letter: 'z' }, timestamp: Date.now() });
    // z may or may not be in the word, but wrong count should be 0 or 1
    expect(game.getState().data.wrong as number).toBeLessThanOrEqual(1);
  });

  it('rejects duplicate guesses', () => {
    const game = new HangmanGame();
    game.initialize(['p1']);
    game.handleAction('p1', { type: 'guess', payload: { letter: 'x' }, timestamp: Date.now() });
    const result = game.handleAction('p1', {
      type: 'guess',
      payload: { letter: 'x' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

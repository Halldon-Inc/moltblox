import { describe, it, expect, beforeEach } from 'vitest';
import { CribbageGame } from './CribbageGame';

describe('CribbageGame', () => {
  let game: CribbageGame;
  const p1 = 'player1';
  const p2 = 'player2';

  beforeEach(() => {
    game = new CribbageGame();
    game.initialize([p1, p2]);
  });

  it('should initialize with correct metadata', () => {
    expect(game.name).toBe('Cribbage');
    expect(game.version).toBe('1.0.0');
    expect(game.maxPlayers).toBe(2);
  });

  it('should start in discard phase with 6 cards each', () => {
    const state = game.getState();
    const data = state.data as any;
    expect(data.phase).toBe('discard');
    expect(data.hands[0]).toHaveLength(6);
    expect(data.hands[1]).toHaveLength(6);
    expect(data.scores[0]).toBe(0);
    expect(data.scores[1]).toBe(0);
  });

  it('should accept valid discard', () => {
    const state = game.getState();
    const data = state.data as any;
    const hand = data.hands[0];
    const card1 = `${hand[0].rank}_${hand[0].suit}`;
    const card2 = `${hand[1].rank}_${hand[1].suit}`;

    const result = game.handleAction(p1, {
      type: 'discard',
      payload: { cards: [card1, card2] },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject discard of wrong number of cards', () => {
    const state = game.getState();
    const data = state.data as any;
    const hand = data.hands[0];
    const card1 = `${hand[0].rank}_${hand[0].suit}`;

    const result = game.handleAction(p1, {
      type: 'discard',
      payload: { cards: [card1] },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
    expect(game.getWinner()).toBeNull();
  });

  it('should track scores', () => {
    const scores = game.getScores();
    expect(scores[p1]).toBe(0);
    expect(scores[p2]).toBe(0);
  });

  it('should reject invalid action type', () => {
    const result = game.handleAction(p1, {
      type: 'play',
      payload: {},
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject discard from card not in hand', () => {
    const result = game.handleAction(p1, {
      type: 'discard',
      payload: { cards: ['X_hearts', 'Y_clubs'] },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { CrazyhouseGame } from './CrazyhouseGame';

describe('CrazyhouseGame', () => {
  let game: CrazyhouseGame;
  const p1 = 'player1';
  const p2 = 'player2';

  beforeEach(() => {
    game = new CrazyhouseGame();
    game.initialize([p1, p2]);
  });

  it('should initialize with correct metadata', () => {
    expect(game.name).toBe('Crazyhouse');
    expect(game.version).toBe('1.0.0');
    expect(game.maxPlayers).toBe(2);
  });

  it('should initialize board with standard chess position', () => {
    const state = game.getState();
    const data = state.data as any;
    expect(data.board).toHaveLength(8);
    expect(data.board[0]).toHaveLength(8);
    expect(data.currentPlayer).toBe(0);
    expect(data.reserves[0]).toHaveLength(0);
    expect(data.reserves[1]).toHaveLength(0);
  });

  it('should allow a valid pawn move', () => {
    const result = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject move from wrong player', () => {
    const result = game.handleAction(p2, {
      type: 'move',
      payload: { from: 'e7', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not your turn');
  });

  it('should reject invalid move', () => {
    const result = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject drop when piece not in reserve', () => {
    const result = game.handleAction(p1, {
      type: 'drop',
      payload: { piece: 'Q', to: 'd4' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Piece not in reserve');
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
    expect(game.getWinner()).toBeNull();
  });

  it('should track scores correctly', () => {
    const scores = game.getScores();
    expect(scores[p1]).toBe(0);
    expect(scores[p2]).toBe(0);
  });
});

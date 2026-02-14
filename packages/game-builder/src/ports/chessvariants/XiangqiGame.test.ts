import { describe, it, expect, beforeEach } from 'vitest';
import { XiangqiGame } from './XiangqiGame';

describe('XiangqiGame', () => {
  let game: XiangqiGame;
  const p1 = 'red';
  const p2 = 'black';

  beforeEach(() => {
    game = new XiangqiGame();
    game.initialize([p1, p2]);
  });

  it('should initialize a 9x10 board', () => {
    const data = game.getState().data as any;
    expect(data.board).toHaveLength(10);
    expect(data.board[0]).toHaveLength(9);
  });

  it('should allow valid chariot move', () => {
    // Red chariot at (9,0) can move to (8,0)
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { fromRow: 9, fromCol: 0, toRow: 8, toCol: 0 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('should reject invalid general move', () => {
    // General at (9,4) cannot move to (9,6) (too far)
    const r = game.handleAction(p1, {
      type: 'move',
      payload: { fromRow: 9, fromCol: 4, toRow: 9, toCol: 6 },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(false);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should have correct metadata', () => {
    expect(game.name).toBe('Xiangqi');
    expect(game.maxPlayers).toBe(2);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ThreeCheckGame } from './ThreeCheckGame';

describe('ThreeCheckGame', () => {
  let game: ThreeCheckGame;
  const p1 = 'white';
  const p2 = 'black';

  beforeEach(() => {
    game = new ThreeCheckGame();
    game.initialize([p1, p2]);
  });

  it('should initialize with check counts at 0', () => {
    const data = game.getState().data as any;
    expect(data.checkCounts).toEqual([0, 0]);
  });

  it('should allow valid opening moves', () => {
    const r1 = game.handleAction(p1, {
      type: 'move',
      payload: { from: 'e2', to: 'e4' },
      timestamp: Date.now(),
    });
    expect(r1.success).toBe(true);
    const r2 = game.handleAction(p2, {
      type: 'move',
      payload: { from: 'e7', to: 'e5' },
      timestamp: Date.now(),
    });
    expect(r2.success).toBe(true);
  });

  it('should not be game over at start', () => {
    expect(game.isGameOver()).toBe(false);
  });

  it('should reject unknown action types', () => {
    const r = game.handleAction(p1, { type: 'fire', payload: {}, timestamp: Date.now() });
    expect(r.success).toBe(false);
  });

  it('should have correct metadata', () => {
    expect(game.name).toBe('Three Check Chess');
    expect(game.maxPlayers).toBe(2);
  });
});

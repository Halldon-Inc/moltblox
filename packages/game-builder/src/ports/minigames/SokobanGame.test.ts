import { describe, it, expect } from 'vitest';
import { SokobanGame } from './SokobanGame.js';

describe('SokobanGame', () => {
  it('initializes with player and boxes', () => {
    const game = new SokobanGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(state.data.player).toBeDefined();
    expect((state.data.boxes as number[][]).length).toBe(2);
  });

  it('moves player', () => {
    const game = new SokobanGame();
    game.initialize(['p1']);
    // Player starts at [3,3], walls at [2][3] and [4][3], so move left (to [3,2] which has a box)
    // Move down first (to [4,3] is also wall), try right
    // Actually player is at [3,3]; boxes at [3,2] and [3,4]; walls at [2,3] and [4,3]
    // So we can only go to a box. Let's push box left: move left pushes box [3,2] to [3,1] (target!)
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { direction: 'left' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
    const after = game.getState().data.player as number[];
    expect(after[0]).toBe(3);
    expect(after[1]).toBe(2);
  });

  it('rejects invalid direction', () => {
    const game = new SokobanGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { direction: 'nowhere' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('cannot walk through walls', () => {
    const game = new SokobanGame();
    game.initialize(['p1']);
    // Move up repeatedly, should hit a wall
    for (let i = 0; i < 5; i++) {
      game.handleAction('p1', {
        type: 'move',
        payload: { direction: 'up' },
        timestamp: Date.now(),
      });
    }
    // Player should not go past row 1 (wall at row 0)
    expect((game.getState().data.player as number[])[0]).toBeGreaterThanOrEqual(1);
  });
});

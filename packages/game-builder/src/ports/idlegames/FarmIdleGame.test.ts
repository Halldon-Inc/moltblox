import { describe, it, expect } from 'vitest';
import { FarmIdleGame } from './FarmIdleGame.js';

describe('FarmIdleGame', () => {
  it('initializes with empty plots and some money', () => {
    const game = new FarmIdleGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(state.data.money).toBe(20);
    expect((state.data.plots as any[]).length).toBe(6);
  });

  it('can plant a crop', () => {
    const game = new FarmIdleGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'plant',
      payload: { plotId: 0, cropType: 'wheat' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
    expect((game.getState().data.plots as any[])[0].crop).toBe('wheat');
  });

  it('rejects planting without money', () => {
    const game = new FarmIdleGame();
    game.initialize(['p1']);
    // Plant all cheap crops to drain money
    for (let i = 0; i < 4; i++) {
      game.handleAction('p1', {
        type: 'plant',
        payload: { plotId: i, cropType: 'wheat' },
        timestamp: Date.now(),
      });
    }
    const result = game.handleAction('p1', {
      type: 'plant',
      payload: { plotId: 4, cropType: 'tomato' },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('crops grow over time', () => {
    const game = new FarmIdleGame();
    game.initialize(['p1']);
    game.handleAction('p1', {
      type: 'plant',
      payload: { plotId: 0, cropType: 'wheat' },
      timestamp: Date.now(),
    });
    // Water to speed up
    game.handleAction('p1', { type: 'water', payload: { plotId: 0 }, timestamp: Date.now() });
    const growth = (game.getState().data.plots as any[])[0].growth;
    expect(growth).toBeGreaterThan(0);
  });
});

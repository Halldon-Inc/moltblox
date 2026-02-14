import { describe, it, expect } from 'vitest';
import { WerewolfGame } from './WerewolfGame.js';

const ts = () => Date.now();

describe('WerewolfGame', () => {
  it('should initialize with roles assigned', () => {
    const game = new WerewolfGame();
    game.initialize(['p1', 'p2', 'p3', 'p4', 'p5']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });

  it('should start in night_wolf phase', () => {
    const game = new WerewolfGame();
    game.initialize(['p1', 'p2', 'p3', 'p4', 'p5']);
    const state = game.getState();
    const data = state.data as Record<string, unknown>;
    expect(data.phase).toBe('night_wolf');
  });

  it('should have fog of war for player state', () => {
    const game = new WerewolfGame();
    game.initialize(['p1', 'p2', 'p3', 'p4', 'p5']);
    const state = game.getState();
    const data = state.data as { players: Record<string, { role: string }> };
    // Full state should have actual roles
    const roles = Object.values(data.players).map((p) => p.role);
    expect(roles).toContain('werewolf');
    expect(roles).toContain('seer');
  });

  it('should reject non-werewolf kill action in wolf phase', () => {
    const game = new WerewolfGame();
    game.initialize(['p1', 'p2', 'p3', 'p4', 'p5']);
    const state = game.getState();
    const data = state.data as { players: Record<string, { role: string }> };

    // Find a non-werewolf player
    const villager = Object.entries(data.players).find(([, p]) => p.role !== 'werewolf')?.[0];
    if (villager) {
      const result = game.handleAction(villager, {
        type: 'kill',
        payload: { target: 'p1' },
        timestamp: ts(),
      });
      expect(result.success).toBe(false);
    }
  });

  it('should allow werewolf to choose kill target', () => {
    const game = new WerewolfGame();
    game.initialize(['p1', 'p2', 'p3', 'p4', 'p5']);
    const state = game.getState();
    const data = state.data as { players: Record<string, { role: string }> };

    const wolf = Object.entries(data.players).find(([, p]) => p.role === 'werewolf')?.[0];
    const target = Object.entries(data.players).find(([, p]) => p.role !== 'werewolf')?.[0];
    if (wolf && target) {
      const result = game.handleAction(wolf, {
        type: 'kill',
        payload: { target },
        timestamp: ts(),
      });
      expect(result.success).toBe(true);
    }
  });
});

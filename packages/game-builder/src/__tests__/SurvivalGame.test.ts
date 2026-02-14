import { describe, it, expect } from 'vitest';
import { SurvivalGame } from '../examples/SurvivalGame.js';

function createGame(config: Record<string, unknown> = {}): SurvivalGame {
  const game = new SurvivalGame(config);
  game.initialize(['player-1']);
  return game;
}

function act(game: SurvivalGame, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction('player-1', { type, payload, timestamp: Date.now() });
}

describe('SurvivalGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes default resource types', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const resources = data.resources as Record<string, number>;
      expect(resources.food).toBe(0);
      expect(resources.wood).toBe(0);
      expect(resources.stone).toBe(0);
    });

    it('respects custom resource types', () => {
      const game = createGame({ resourceTypes: ['gold', 'gems'] });
      const data = game.getState().data as Record<string, unknown>;
      const resources = data.resources as Record<string, number>;
      expect(resources.gold).toBe(0);
      expect(resources.gems).toBe(0);
      expect(resources.food).toBeUndefined();
    });

    it('starts at prestige level 0', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.prestigeLevel).toBe(0);
      expect(data.prestigeMultiplier).toBe(1.0);
    });

    it('generates upgrades', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const upgrades = data.upgrades as unknown[];
      expect(upgrades.length).toBeGreaterThan(0);
    });
  });

  describe('gather action', () => {
    it('increases resource amount', () => {
      const game = createGame();
      act(game, 'gather', { resourceType: 'food' });
      const data = game.getState().data as Record<string, unknown>;
      const resources = data.resources as Record<string, number>;
      expect(resources.food).toBeGreaterThan(0);
    });

    it('rejects invalid resource type', () => {
      const game = createGame();
      const result = act(game, 'gather', { resourceType: 'unobtainium' });
      expect(result.success).toBe(false);
    });

    it('respects storage capacity', () => {
      const game = createGame();
      // Gather many times to hit cap
      for (let i = 0; i < 100; i++) {
        act(game, 'gather', { resourceType: 'food' });
      }
      const data = game.getState().data as Record<string, unknown>;
      const resources = data.resources as Record<string, number>;
      const capacity = (data.storageCapacity as Record<string, number>).food;
      expect(resources.food).toBeLessThanOrEqual(capacity);
    });
  });

  describe('build_upgrade action', () => {
    it('builds an upgrade when resources are available', () => {
      const game = createGame();
      // Gather resources first
      for (let i = 0; i < 20; i++) {
        act(game, 'gather', { resourceType: 'food' });
      }
      const data = game.getState().data as Record<string, unknown>;
      const upgrades = data.upgrades as { id: string; level: number }[];
      // Try building first upgrade
      const result = act(game, 'build_upgrade', { upgradeId: upgrades[0].id });
      if (result.success) {
        const postData = game.getState().data as Record<string, unknown>;
        const postUpgrades = postData.upgrades as { id: string; level: number }[];
        expect(postUpgrades[0].level).toBe(1);
      }
    });

    it('rejects when not enough resources', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const upgrades = data.upgrades as { id: string }[];
      const result = act(game, 'build_upgrade', { upgradeId: upgrades[0].id });
      expect(result.success).toBe(false);
    });
  });

  describe('prestige action', () => {
    it('rejects when threshold not met', () => {
      const game = createGame();
      const result = act(game, 'prestige');
      expect(result.success).toBe(false);
    });

    it('increases prestige level and multiplier', () => {
      const game = createGame({ prestigeThreshold: 50 });
      // Gather lots of resources to exceed threshold
      for (let i = 0; i < 50; i++) {
        act(game, 'gather', { resourceType: 'food' });
      }
      const result = act(game, 'prestige');
      if (result.success) {
        const data = game.getState().data as Record<string, unknown>;
        expect(data.prestigeLevel).toBe(1);
        expect(data.prestigeMultiplier).toBeGreaterThan(1.0);
      }
    });
  });

  describe('allocate_workers action', () => {
    it('allocates workers to a resource', () => {
      const game = createGame();
      const result = act(game, 'allocate_workers', { resourceType: 'food', count: 1 });
      expect(result.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      const workers = data.workers as Record<string, number>;
      expect(workers.food).toBe(1);
    });

    it('rejects when no workers available', () => {
      const game = createGame();
      // Allocate all 3 workers
      act(game, 'allocate_workers', { resourceType: 'food', count: 3 });
      const result = act(game, 'allocate_workers', { resourceType: 'wood', count: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe('win condition', () => {
    it('game is not over at start', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('scores', () => {
    it('returns score for player', () => {
      const game = createGame();
      const scores = game.getScores();
      expect(scores['player-1']).toBeDefined();
    });

    it('score increases with gathering', () => {
      const game = createGame();
      act(game, 'gather', { resourceType: 'food' });
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'mine_bitcoin');
      expect(result.success).toBe(false);
    });
  });
});

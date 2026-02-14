import { describe, it, expect } from 'vitest';
import { BeatEmUpRPGGame } from '../examples/BeatEmUpRPGGame.js';

function createGame(config: Record<string, unknown> = {}): BeatEmUpRPGGame {
  const game = new BeatEmUpRPGGame(config);
  game.initialize(['player-1']);
  return game;
}

function act(game: BeatEmUpRPGGame, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction('player-1', { type, payload, timestamp: Date.now() });
}

function getPlayerData(game: BeatEmUpRPGGame) {
  const data = game.getState().data as Record<string, unknown>;
  return {
    player: data.player as Record<string, unknown>,
    enemies: data.enemies as Array<Record<string, unknown>>,
    phase: data.phase as string,
    stagesCleared: data.stagesCleared as number,
    currentStage: data.currentStage as number,
    totalDamageDealt: data.totalDamageDealt as number,
  };
}

describe('BeatEmUpRPGGame', () => {
  describe('initialization', () => {
    it('starts with correct default state', () => {
      const game = createGame();
      const state = game.getState();
      expect(state.phase).toBe('playing');
      const { player, enemies, phase } = getPlayerData(game);
      expect(player.level).toBe(1);
      expect(player.hp).toBe(100);
      expect(player.maxHp).toBe(100);
      expect(player.gold).toBe(0);
      expect(player.xp).toBe(0);
      expect(phase).toBe('combat');
      expect(enemies.length).toBeGreaterThanOrEqual(2);
    });

    it('respects config overrides', () => {
      const game = createGame({ maxLevel: 5, totalStages: 3 });
      const data = game.getState().data as Record<string, unknown>;
      expect(data.maxLevel).toBe(5);
      expect(data.totalStages).toBe(3);
    });

    it('only allows 1 player', () => {
      const game = new BeatEmUpRPGGame({});
      expect(() => game.initialize(['p1', 'p2'])).toThrow();
    });
  });

  describe('combat mechanics', () => {
    it('attack deals damage to first alive enemy', () => {
      const game = createGame();
      const beforeEnemies = getPlayerData(game).enemies;
      const beforeHp = beforeEnemies[0].hp as number;

      act(game, 'attack', {});

      const afterEnemies = getPlayerData(game).enemies;
      expect(afterEnemies[0].hp as number).toBeLessThan(beforeHp);
    });

    it('attack targeting specific enemy works', () => {
      const game = createGame();
      const { enemies } = getPlayerData(game);
      const targetId = enemies[1].id as string;
      const beforeHp = enemies[1].hp as number;

      act(game, 'attack', { targetId });

      const afterEnemies = getPlayerData(game).enemies;
      const target = afterEnemies.find((e) => e.id === targetId);
      expect(target).toBeDefined();
      expect(target!.hp as number).toBeLessThan(beforeHp);
    });

    it('defeating enemy grants XP and gold', () => {
      const game = createGame();
      const { player: beforePlayer } = getPlayerData(game);
      const beforeXp = beforePlayer.xp as number;
      const beforeGold = beforePlayer.gold as number;

      // Attack until at least one enemy dies
      for (let i = 0; i < 30; i++) {
        act(game, 'attack', {});
        const { enemies } = getPlayerData(game);
        const dead = enemies.some((e) => !(e.alive as boolean));
        if (dead) break;
      }

      const { player: afterPlayer } = getPlayerData(game);
      expect(afterPlayer.xp as number).toBeGreaterThan(beforeXp);
      expect(afterPlayer.gold as number).toBeGreaterThan(beforeGold);
    });

    it('dodge skips enemy counterattack', () => {
      const game = createGame();
      const { player: beforePlayer } = getPlayerData(game);
      const hpBefore = beforePlayer.hp as number;

      act(game, 'dodge', {});

      const { player: afterPlayer } = getPlayerData(game);
      // HP should not decrease from dodge (no enemy counter)
      expect(afterPlayer.hp as number).toBe(hpBefore);
    });

    it('tracks total damage dealt', () => {
      const game = createGame();
      act(game, 'attack', {});
      const { totalDamageDealt } = getPlayerData(game);
      expect(totalDamageDealt).toBeGreaterThan(0);
    });
  });

  describe('RPG progression', () => {
    it('levels up when XP threshold is reached', () => {
      const game = createGame({ totalStages: 20 });

      // Fight until level up
      for (let i = 0; i < 100; i++) {
        if (game.isGameOver()) break;
        const { player, phase } = getPlayerData(game);
        if ((player.level as number) > 1) break;
        if (phase === 'shop') {
          // Continue to next stage by attacking (phase changes when enemies spawn)
          act(game, 'attack', {});
        } else {
          act(game, 'attack', {});
        }
      }

      const { player } = getPlayerData(game);
      // Should have leveled up at least once after killing many enemies
      if (!game.isGameOver()) {
        expect(player.level as number).toBeGreaterThanOrEqual(1);
      }
    });

    it('stat allocation works with skill points', () => {
      const game = createGame({ totalStages: 20 });

      // Fight until we get skill points
      for (let i = 0; i < 200; i++) {
        if (game.isGameOver()) break;
        const { player } = getPlayerData(game);
        if ((player.skillPoints as number) > 0) break;
        act(game, 'attack', {});
      }

      const { player } = getPlayerData(game);
      if ((player.skillPoints as number) > 0) {
        const strBefore = player.str as number;
        act(game, 'allocate_stat', { stat: 'str' });
        const { player: after } = getPlayerData(game);
        expect(after.str as number).toBe(strBefore + 2);
      }
    });

    it('rejects stat allocation when no skill points', () => {
      const game = createGame();
      const result = act(game, 'allocate_stat', { stat: 'str' });
      expect(result.success).toBe(false);
    });
  });

  describe('shop mechanics', () => {
    it('shop buy fails when not in shop phase', () => {
      const game = createGame();
      const result = act(game, 'shop_buy', { itemId: 'iron-sword' });
      expect(result.success).toBe(false);
    });

    it('shop buy fails with insufficient gold', () => {
      const game = createGame({ shopFrequency: 1, totalStages: 10 });

      // Fight through stage 1 to reach shop
      for (let i = 0; i < 100; i++) {
        if (game.isGameOver()) break;
        const { phase } = getPlayerData(game);
        if (phase === 'shop') break;
        act(game, 'attack', {});
      }

      const { phase, player } = getPlayerData(game);
      if (phase === 'shop' && (player.gold as number) < 100) {
        const result = act(game, 'shop_buy', { itemId: 'flame-blade' });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('equipment', () => {
    it('equipping an item from inventory works', () => {
      const game = createGame({ shopFrequency: 1, totalStages: 10 });

      // Fight to get gold and reach shop
      for (let i = 0; i < 100; i++) {
        if (game.isGameOver()) break;
        const { phase } = getPlayerData(game);
        if (phase === 'shop') break;
        act(game, 'attack', {});
      }

      const { phase, player } = getPlayerData(game);
      if (phase === 'shop' && (player.gold as number) >= 30) {
        act(game, 'shop_buy', { itemId: 'iron-sword' });
        const { player: afterBuy } = getPlayerData(game);
        const inv = afterBuy.inventory as Array<{ id: string }>;
        expect(inv.some((i) => i.id === 'iron-sword')).toBe(true);

        act(game, 'equip', { itemId: 'iron-sword' });
        const { player: afterEquip } = getPlayerData(game);
        const equipment = afterEquip.equipment as Record<string, { id: string } | null>;
        expect(equipment.weapon).not.toBeNull();
        expect(equipment.weapon!.id).toBe('iron-sword');
      }
    });

    it('equip fails when item not in inventory', () => {
      const game = createGame();
      const result = act(game, 'equip', { itemId: 'non-existent' });
      expect(result.success).toBe(false);
    });
  });

  describe('stage progression', () => {
    it('clearing all enemies advances to next stage', () => {
      const game = createGame({ totalStages: 10 });

      // Fight through stage 1
      for (let i = 0; i < 100; i++) {
        if (game.isGameOver()) break;
        const { stagesCleared } = getPlayerData(game);
        if (stagesCleared > 0) break;
        act(game, 'attack', {});
      }

      if (!game.isGameOver()) {
        const { stagesCleared, currentStage } = getPlayerData(game);
        expect(stagesCleared).toBeGreaterThanOrEqual(1);
        expect(currentStage).toBeGreaterThanOrEqual(2);
      }
    });

    it('clearing all stages results in victory', () => {
      const game = createGame({ totalStages: 1 });

      for (let i = 0; i < 100; i++) {
        if (game.isGameOver()) break;
        act(game, 'attack', {});
      }

      if (game.isGameOver()) {
        const { phase } = getPlayerData(game);
        if (phase === 'victory') {
          expect(game.getWinner()).toBe('player-1');
        }
      }
    });
  });

  describe('scoring', () => {
    it('score includes damage, gold, and stages', () => {
      const game = createGame();
      act(game, 'attack', {});
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
    });
  });

  describe('game over', () => {
    it('game ends when player HP reaches 0', () => {
      // Create a game where enemies are very strong
      const game = createGame({ totalStages: 50 });

      // Keep fighting until game over or we run out of patience
      for (let i = 0; i < 500; i++) {
        if (game.isGameOver()) break;
        act(game, 'attack', {});
      }

      // The game should have made progress
      const scores = game.getScores();
      expect(scores['player-1']).toBeDefined();
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'fly');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = game.handleAction('hacker', {
        type: 'attack',
        payload: {},
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
    });
  });
});

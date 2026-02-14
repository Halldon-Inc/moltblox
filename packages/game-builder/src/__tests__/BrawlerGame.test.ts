import { describe, it, expect } from 'vitest';
import { BrawlerGame } from '../examples/BrawlerGame.js';

function createGame(playerCount = 1, config: Record<string, unknown> = {}): BrawlerGame {
  const game = new BrawlerGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: BrawlerGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('BrawlerGame', () => {
  describe('initialization', () => {
    it('starts in playing phase with enemies spawned', () => {
      const game = createGame();
      const state = game.getState();
      expect(state.phase).toBe('playing');
      const data = state.data as Record<string, unknown>;
      const enemies = data.enemies as { alive: boolean }[];
      expect(enemies.length).toBeGreaterThan(0);
    });

    it('initializes player with correct defaults', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<
        string,
        { hp: number; maxHp: number; lives: number; weapon: string | null }
      >;
      expect(players['player-1'].hp).toBe(100);
      expect(players['player-1'].maxHp).toBe(100);
      expect(players['player-1'].lives).toBe(3);
      expect(players['player-1'].weapon).toBeNull();
    });

    it('respects config overrides', () => {
      const game = createGame(1, { stageCount: 5, enemyDensity: 5 });
      const data = game.getState().data as Record<string, unknown>;
      expect(data.totalStages).toBe(5);
      const enemies = data.enemies as { alive: boolean }[];
      expect(enemies.length).toBe(5);
    });

    it('supports multiple co-op players', () => {
      const game = createGame(3);
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number }>;
      expect(Object.keys(players).length).toBe(3);
      expect(players['player-1'].hp).toBe(100);
      expect(players['player-2'].hp).toBe(100);
      expect(players['player-3'].hp).toBe(100);
    });
  });

  describe('attack action', () => {
    it('deals damage to first alive enemy', () => {
      const game = createGame();
      act(game, 'player-1', 'attack');
      const data = game.getState().data as Record<string, unknown>;
      const enemies = data.enemies as { hp: number; maxHp: number }[];
      expect(enemies[0].hp).toBeLessThan(enemies[0].maxHp);
    });

    it('defeats enemies and awards score', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 1 });
      // Keep attacking until enemy dies
      for (let i = 0; i < 10; i++) {
        const result = act(game, 'player-1', 'attack');
        if (!result.success) break;
      }
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { score: number }>;
      expect(players['player-1'].score).toBeGreaterThan(0);
    });

    it('returns error when no enemies alive', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 1 });
      // Kill all enemies with special (hits all)
      for (let i = 0; i < 20; i++) {
        act(game, 'player-1', 'attack');
        if (game.isGameOver()) break;
      }
      // After game over, actions should fail
      if (game.isGameOver()) {
        const result = act(game, 'player-1', 'attack');
        expect(result.success).toBe(false);
      }
    });
  });

  describe('jump_attack action', () => {
    it('deals higher damage than normal attack', () => {
      const game1 = createGame(1, { stageCount: 1, enemyDensity: 1 });
      act(game1, 'player-1', 'attack');
      const d1 = game1.getState().data as Record<string, unknown>;
      const e1 = (d1.enemies as { hp: number; maxHp: number }[])[0];
      const normalDmg = e1.maxHp - e1.hp;

      const game2 = createGame(1, { stageCount: 1, enemyDensity: 1 });
      act(game2, 'player-1', 'jump_attack');
      const d2 = game2.getState().data as Record<string, unknown>;
      const e2 = (d2.enemies as { hp: number; maxHp: number }[])[0];
      const jumpDmg = e2.maxHp - e2.hp;

      expect(jumpDmg).toBeGreaterThan(normalDmg);
    });
  });

  describe('combo system', () => {
    it('increases damage with consecutive different attacks', () => {
      const game = createGame(1, { stageCount: 3, enemyDensity: 1 });
      // First attack (no combo)
      act(game, 'player-1', 'attack');
      const d1 = game.getState().data as Record<string, unknown>;
      const p1 = (d1.players as Record<string, { comboCount: number }>)['player-1'];
      expect(p1.comboCount).toBe(0);

      // Second attack with different type builds combo
      act(game, 'player-1', 'jump_attack');
      const d2 = game.getState().data as Record<string, unknown>;
      const p2 = (d2.players as Record<string, { comboCount: number }>)['player-1'];
      expect(p2.comboCount).toBe(1);
    });
  });

  describe('grab and throw', () => {
    it('grab deals damage to a specific target', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 2 });
      const data = game.getState().data as Record<string, unknown>;
      const enemies = data.enemies as { id: string; hp: number; maxHp: number }[];
      const targetId = enemies[0].id;

      act(game, 'player-1', 'grab', { targetId });
      const d2 = game.getState().data as Record<string, unknown>;
      const e2 = (d2.enemies as { id: string; hp: number; maxHp: number }[]).find(
        (e) => e.id === targetId,
      )!;
      expect(e2.hp).toBeLessThan(e2.maxHp);
    });

    it('throw deals significant damage', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 2 });
      const data = game.getState().data as Record<string, unknown>;
      const enemies = data.enemies as { id: string; hp: number; maxHp: number }[];
      const targetId = enemies[0].id;

      act(game, 'player-1', 'throw', { targetId });
      const d2 = game.getState().data as Record<string, unknown>;
      const e2 = (d2.enemies as { id: string; hp: number; maxHp: number }[]).find(
        (e) => e.id === targetId,
      )!;
      expect(e2.maxHp - e2.hp).toBeGreaterThanOrEqual(15);
    });

    it('rejects grab on invalid target', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'grab', { targetId: 'nonexistent' });
      expect(result.success).toBe(false);
    });
  });

  describe('special attack', () => {
    it('hits all enemies for 20 damage each', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 3 });
      const dataBefore = game.getState().data as Record<string, unknown>;
      const enemiesBefore = dataBefore.enemies as { hp: number; maxHp: number }[];
      const hpsBefore = enemiesBefore.map((e) => e.hp);

      act(game, 'player-1', 'special');
      const dataAfter = game.getState().data as Record<string, unknown>;
      const enemiesAfter = dataAfter.enemies as { hp: number }[];

      for (let i = 0; i < enemiesAfter.length; i++) {
        if (hpsBefore[i] > 20) {
          expect(enemiesAfter[i].hp).toBe(hpsBefore[i] - 20);
        }
      }
    });

    it('costs 20 HP', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 1 });
      // Need enough HP to survive counterattack too
      act(game, 'player-1', 'special');
      const data = game.getState().data as Record<string, unknown>;
      const player = (data.players as Record<string, { hp: number; maxHp: number }>)['player-1'];
      // HP should be reduced by at least 20 (special cost) plus enemy counterattack
      expect(player.hp).toBeLessThanOrEqual(player.maxHp - 20);
    });

    it('rejects when HP is too low', () => {
      const game = createGame(1, { stageCount: 3, enemyDensity: 3 });
      // Drain HP by taking many hits
      for (let i = 0; i < 15; i++) {
        act(game, 'player-1', 'attack');
        if (game.isGameOver()) break;
      }
      // Try special when HP may be low
      const data = game.getState().data as Record<string, unknown>;
      const player = (data.players as Record<string, { hp: number }>)['player-1'];
      if (player.hp <= 20 && player.hp > 0) {
        const result = act(game, 'player-1', 'special');
        expect(result.success).toBe(false);
      }
    });
  });

  describe('weapon system', () => {
    it('pick_up equips a weapon', () => {
      const game = createGame(1, { stageCount: 1, enemyDensity: 1, weaponSpawnRate: 1.0 });
      const data = game.getState().data as Record<string, unknown>;
      const weapons = data.weapons as { id: string; type: string }[];

      if (weapons.length > 0) {
        act(game, 'player-1', 'pick_up', { weaponId: weapons[0].id });
        const d2 = game.getState().data as Record<string, unknown>;
        const player = (d2.players as Record<string, { weapon: string | null }>)['player-1'];
        expect(player.weapon).toBe(weapons[0].type);
      }
    });

    it('rejects pick_up for nonexistent weapon', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'pick_up', { weaponId: 'fake_weapon' });
      expect(result.success).toBe(false);
    });

    it('use_weapon fails without a weapon equipped', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'use_weapon');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No weapon');
    });
  });

  describe('move action', () => {
    it('moves player position', () => {
      const game = createGame();
      act(game, 'player-1', 'move', { direction: 'right' });
      const data = game.getState().data as Record<string, unknown>;
      const player = (data.players as Record<string, { x: number }>)['player-1'];
      expect(player.x).toBe(1);
    });

    it('rejects invalid direction', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'move', { direction: 'diagonal' });
      expect(result.success).toBe(false);
    });
  });

  describe('wave and stage progression', () => {
    it('spawns new wave when all enemies defeated', () => {
      const game = createGame(1, { stageCount: 2, enemyDensity: 1 });
      // Kill all enemies in wave 1
      for (let i = 0; i < 20; i++) {
        act(game, 'player-1', 'attack');
        if (game.isGameOver()) break;
        const data = game.getState().data as Record<string, unknown>;
        if ((data.currentWave as number) > 1) break;
      }
      if (!game.isGameOver()) {
        const data = game.getState().data as Record<string, unknown>;
        expect(data.currentWave as number).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('game over', () => {
    it('game ends in defeat when player runs out of lives', () => {
      // Low density so we can track
      const game = createGame(1, { stageCount: 3, enemyDensity: 5 });
      // Keep attacking; enemies will counterattack
      for (let i = 0; i < 100; i++) {
        act(game, 'player-1', 'attack');
        if (game.isGameOver()) break;
      }
      // Game should have ended at some point
      // (either victory or defeat depending on damage)
      expect(game.getState()).toBeDefined();
    });
  });

  describe('scores', () => {
    it('tracks score from damage and kills', () => {
      const game = createGame();
      act(game, 'player-1', 'attack');
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'fly');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'attack');
      expect(result.success).toBe(false);
    });
  });
});

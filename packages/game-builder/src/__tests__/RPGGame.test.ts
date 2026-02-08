import { describe, it, expect } from 'vitest';
import { RPGGame } from '../examples/RPGGame.js';

function createGame(playerCount = 1): RPGGame {
  const game = new RPGGame();
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(game: RPGGame, playerId: string, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

interface RPGState {
  players: Record<
    string,
    {
      stats: {
        hp: number;
        maxHp: number;
        atk: number;
        def: number;
        spd: number;
        mp: number;
        maxMp: number;
      };
      level: number;
      xp: number;
      xpToLevel: number;
      skills: {
        name: string;
        mpCost: number;
        damage: number;
        effect?: string;
        effectValue?: number;
      }[];
      items: Record<string, number>;
      buffs: Record<string, number>;
    }
  >;
  currentEnemy: {
    name: string;
    stats: { hp: number; maxHp: number; atk: number; def: number; spd: number };
    reward: number;
  } | null;
  encounter: number;
  maxEncounters: number;
  turnOrder: string[];
  currentTurnIndex: number;
  combatLog: string[];
  [key: string]: unknown;
}

function getData(game: RPGGame): RPGState {
  return game.getState().data as RPGState;
}

describe('RPGGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes player stats', () => {
      const game = createGame();
      const data = getData(game);
      const player = data.players['player-1'];
      expect(player.stats.hp).toBe(100);
      expect(player.stats.maxHp).toBe(100);
      expect(player.stats.atk).toBe(12);
      expect(player.stats.mp).toBe(30);
    });

    it('gives player starter skills', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.players['player-1'].skills.length).toBe(4);
      expect(data.players['player-1'].skills[0].name).toBe('Power Strike');
    });

    it('gives player starting items', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.players['player-1'].items['Potion']).toBe(3);
      expect(data.players['player-1'].items['Ether']).toBe(2);
    });

    it('starts with no active enemy', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.currentEnemy).toBeNull();
    });

    it('supports up to 4 players', () => {
      const game = createGame(4);
      const data = getData(game);
      expect(Object.keys(data.players)).toHaveLength(4);
    });
  });

  describe('start_encounter', () => {
    it('spawns an enemy', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'start_encounter');
      expect(result.success).toBe(true);
      const data = getData(game);
      expect(data.currentEnemy).not.toBeNull();
      expect(data.currentEnemy!.name).toBe('Slime');
      expect(data.encounter).toBe(1);
    });

    it('rejects starting encounter while in combat', () => {
      const game = createGame();
      act(game, 'player-1', 'start_encounter');
      const result = act(game, 'player-1', 'start_encounter');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Already in combat');
    });

    it('builds turn order based on SPD', () => {
      const game = createGame();
      act(game, 'player-1', 'start_encounter');
      const data = getData(game);
      expect(data.turnOrder.length).toBeGreaterThan(0);
      expect(data.turnOrder).toContain('player-1');
      expect(data.turnOrder).toContain('enemy');
    });
  });

  describe('attack action', () => {
    it('deals damage to enemy', () => {
      const game = createGame();
      act(game, 'player-1', 'start_encounter');
      const dataBefore = getData(game);
      const hpBefore = dataBefore.currentEnemy!.stats.hp;

      // Advance to player turn
      const playerTurnIdx = dataBefore.turnOrder.indexOf('player-1');
      if (playerTurnIdx > 0) {
        // Skip enemy turns via auto_tick
        for (let i = 0; i < playerTurnIdx; i++) {
          act(game, 'player-1', 'auto_tick');
        }
      }

      act(game, 'player-1', 'attack');
      const dataAfter = getData(game);
      if (dataAfter.currentEnemy) {
        expect(dataAfter.currentEnemy.stats.hp).toBeLessThan(hpBefore);
      }
    });

    it('rejects attack when not in combat', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'attack');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not in combat');
    });
  });

  describe('use_skill', () => {
    it('heal skill restores HP', () => {
      const game = createGame();
      act(game, 'player-1', 'start_encounter');
      const data = getData(game);
      // Reduce HP first
      data.players['player-1'].stats.hp = 50;
      const healSkillIdx = data.players['player-1'].skills.findIndex((s) => s.effect === 'heal');

      // Find player turn
      while (getData(game).turnOrder[getData(game).currentTurnIndex] !== 'player-1') {
        act(game, 'player-1', 'auto_tick');
      }

      act(game, 'player-1', 'use_skill', { skillIndex: healSkillIdx });
      const after = getData(game);
      expect(after.players['player-1'].stats.hp).toBeGreaterThan(50);
    });

    it('rejects skill when not enough MP', () => {
      const game = createGame();
      act(game, 'player-1', 'start_encounter');
      const data = getData(game);
      data.players['player-1'].stats.mp = 0;

      while (getData(game).turnOrder[getData(game).currentTurnIndex] !== 'player-1') {
        act(game, 'player-1', 'auto_tick');
      }

      const result = act(game, 'player-1', 'use_skill', { skillIndex: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough MP');
    });

    it('rejects invalid skill index', () => {
      const game = createGame();
      act(game, 'player-1', 'start_encounter');

      while (getData(game).turnOrder[getData(game).currentTurnIndex] !== 'player-1') {
        act(game, 'player-1', 'auto_tick');
      }

      const result = act(game, 'player-1', 'use_skill', { skillIndex: 99 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid skill index');
    });
  });

  describe('game over', () => {
    it('is not over at start', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);
    });

    it('rejects actions when all encounters completed (game over)', () => {
      const game = createGame();
      const data = getData(game);
      data.encounter = data.maxEncounters;
      const result = act(game, 'player-1', 'start_encounter');
      expect(result.success).toBe(false);
    });
  });

  describe('invalid player', () => {
    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'start_encounter');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a valid player');
    });
  });
});

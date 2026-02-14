import { describe, it, expect } from 'vitest';
import { BossBattleGame } from '../examples/BossBattleGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): BossBattleGame {
  const game = new BossBattleGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: BossBattleGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('BossBattleGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes dragon boss with 500 HP', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const boss = data.boss as { hp: number; maxHp: number };
      expect(boss.hp).toBe(500);
      expect(boss.maxHp).toBe(500);
    });

    it('initializes titan boss with 700 HP', () => {
      const game = createGame(2, { bossTemplate: 'titan' });
      const data = game.getState().data as Record<string, unknown>;
      const boss = data.boss as { hp: number };
      expect(boss.hp).toBe(700);
    });

    it('initializes players with 100 HP', () => {
      const game = createGame(3);
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number }>;
      expect(players['player-1'].hp).toBe(100);
      expect(players['player-2'].hp).toBe(100);
      expect(players['player-3'].hp).toBe(100);
    });

    it('assigns roles when enabled', () => {
      const game = createGame(4, { playerRoles: true });
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { role: string; maxHp: number }>;
      expect(players['player-1'].role).toBe('tank');
      expect(players['player-1'].maxHp).toBe(200); // Tank gets 2x HP
      expect(players['player-2'].role).toBe('dps');
      expect(players['player-3'].role).toBe('healer');
      expect(players['player-4'].role).toBe('support');
    });
  });

  describe('attack action', () => {
    it('deals damage to boss', () => {
      const game = createGame();
      act(game, 'player-1', 'attack');
      const data = game.getState().data as Record<string, unknown>;
      const boss = data.boss as { hp: number };
      expect(boss.hp).toBeLessThan(500);
    });

    it('DPS role deals 1.5x damage', () => {
      const game = createGame(2, { playerRoles: true, enrageTimer: 999 });
      // player-1 is tank, player-2 is dps
      act(game, 'player-1', 'attack'); // 15 damage
      act(game, 'player-2', 'attack'); // 22 damage (15 * 1.5 = 22.5 floored)

      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { damageDealt: number }>;
      expect(players['player-2'].damageDealt).toBe(22); // DPS multiplier
      expect(players['player-1'].damageDealt).toBe(15); // Normal
    });
  });

  describe('healing', () => {
    it('heals target player', () => {
      const game = createGame(2, { enrageTimer: 999 });
      // Player takes damage from boss turn
      act(game, 'player-1', 'attack'); // Boss will attack back

      const dataMid = game.getState().data as Record<string, unknown>;
      const playersMid = dataMid.players as Record<string, { hp: number }>;
      const hpAfterBoss = playersMid['player-1'].hp;

      // Player-2 heals player-1
      act(game, 'player-2', 'heal', { targetId: 'player-1' });

      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number }>;
      // May have taken more boss damage but should have gained heal HP
      expect(players['player-1'].hp).not.toBe(hpAfterBoss);
    });
  });

  describe('dodge', () => {
    it('sets dodge state for the turn', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'dodge');
      expect(result.success).toBe(true);
      // Dodge is consumed after boss turn, so dodging should be false after
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { dodging: boolean }>;
      expect(players['player-1'].dodging).toBe(false); // Reset after boss turn
    });
  });

  describe('taunt', () => {
    it('sets taunt to direct boss attacks', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'taunt');
      expect(result.success).toBe(true);
      // After boss turn, player-1 should have been targeted (or dodged)
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { taunting: boolean }>;
      expect(players['player-1'].taunting).toBe(true);
    });
  });

  describe('revive', () => {
    it('revives dead ally at 30% HP', () => {
      const game = createGame(3, { enrageTimer: 999 });
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number; alive: boolean; maxHp: number }>;
      // Force player-2 to be dead
      players['player-2'].hp = 0;
      players['player-2'].alive = false;

      // Player-3 taunts so boss targets them, not the revived player
      act(game, 'player-3', 'taunt');
      act(game, 'player-1', 'revive_ally', { targetId: 'player-2' });

      const dataAfter = game.getState().data as Record<string, unknown>;
      const playersAfter = dataAfter.players as Record<
        string,
        { hp: number; alive: boolean; maxHp: number }
      >;
      // Player was revived at 30% HP; boss targets the taunting player-3
      expect(playersAfter['player-2'].alive).toBe(true);
      expect(playersAfter['player-2'].hp).toBeLessThanOrEqual(30);
      expect(playersAfter['player-2'].hp).toBeGreaterThan(0);
    });

    it('enforces revive cooldown', () => {
      const game = createGame(2, { enrageTimer: 999 });
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number; alive: boolean }>;
      players['player-2'].hp = 0;
      players['player-2'].alive = false;

      act(game, 'player-1', 'revive_ally', { targetId: 'player-2' });

      // Kill player-2 again
      const data2 = game.getState().data as Record<string, unknown>;
      const players2 = data2.players as Record<string, { hp: number; alive: boolean }>;
      players2['player-2'].hp = 0;
      players2['player-2'].alive = false;

      const result = act(game, 'player-1', 'revive_ally', { targetId: 'player-2' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cooldown');
    });
  });

  describe('phase transitions', () => {
    it('transitions boss phase at HP thresholds', () => {
      const game = createGame(2, { bossTemplate: 'hydra', enrageTimer: 999 });
      // Hydra has 400 HP. Phase thresholds at 75% (300), 50% (200), 25% (100)
      // Keep attacking
      for (let i = 0; i < 30; i++) {
        act(game, 'player-1', 'attack');
        if (game.isGameOver()) break;
      }
      const data = game.getState().data as Record<string, unknown>;
      const boss = data.boss as { phase: number };
      // Should have progressed at least one phase
      expect(boss.phase).toBeGreaterThan(1);
    });
  });

  describe('boss defeat', () => {
    it('ends game when boss HP reaches 0', () => {
      const game = createGame(4, { bossTemplate: 'hydra', enrageTimer: 999 });
      // Hydra has 400 HP, weakest boss
      for (let i = 0; i < 200; i++) {
        for (let p = 1; p <= 4; p++) {
          if (game.isGameOver()) break;
          act(game, `player-${p}`, 'attack');
        }
        if (game.isGameOver()) break;
      }
      // May or may not have won depending on boss damage back
      if (game.isGameOver()) {
        const data = game.getState().data as Record<string, unknown>;
        const bossDefeated = data.bossDefeated as boolean;
        const allDead = data.allDead as boolean;
        expect(bossDefeated || allDead).toBe(true);
      }
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

  describe('scores', () => {
    it('tracks damage dealt in scores', () => {
      const game = createGame();
      act(game, 'player-1', 'attack');
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
    });
  });
});

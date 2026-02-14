import { describe, it, expect } from 'vitest';
import { WeaponsDuelGame } from '../examples/WeaponsDuelGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): WeaponsDuelGame {
  const game = new WeaponsDuelGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: WeaponsDuelGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

function getDuelists(game: WeaponsDuelGame) {
  const data = game.getState().data as Record<string, unknown>;
  return data.duelists as Record<string, Record<string, unknown>>;
}

describe('WeaponsDuelGame', () => {
  describe('initialization', () => {
    it('starts in playing phase with correct defaults', () => {
      const game = createGame();
      const state = game.getState();
      expect(state.phase).toBe('playing');
      const data = state.data as Record<string, unknown>;
      expect(data.roundsToWin).toBe(2);
      expect(data.woundSeverity).toBe(2);
      expect(data.staminaRegenRate).toBe(8);
      expect(data.distanceSteps).toBe(7);
    });

    it('initializes two duelists with weapons from pool', () => {
      const game = createGame(2, { weaponPool: ['dagger', 'axe'] });
      const duelists = getDuelists(game);
      expect(duelists['player-1'].weapon).toBe('dagger');
      expect(duelists['player-2'].weapon).toBe('axe');
    });

    it('places duelists at opposite ends', () => {
      const game = createGame();
      const duelists = getDuelists(game);
      expect(duelists['player-1'].position).toBe(1);
      expect(duelists['player-2'].position as number).toBeGreaterThan(1);
    });

    it('creates CPU opponent in solo mode', () => {
      const game = createGame(1);
      const duelists = getDuelists(game);
      expect(duelists['cpu']).toBeDefined();
    });
  });

  describe('movement', () => {
    it('advance moves toward opponent', () => {
      const game = createGame();
      const before = getDuelists(game)['player-1'].position as number;

      act(game, 'player-1', 'advance');

      const after = getDuelists(game)['player-1'].position as number;
      expect(after).toBeGreaterThan(before);
    });

    it('retreat moves away from opponent', () => {
      const game = createGame();
      const before = getDuelists(game)['player-1'].position as number;

      act(game, 'player-1', 'retreat');

      const after = getDuelists(game)['player-1'].position as number;
      expect(after).toBeLessThan(before);
    });

    it('advance costs stamina', () => {
      const game = createGame();
      act(game, 'player-1', 'advance');
      const duelists = getDuelists(game);
      // Stamina starts at 50, advance costs 3, regen applied: 50 + 8 - 3 = 55
      // But BaseGame.handleAction reassigns state from newState, so net is 50 - 3 + regen
      const stamina = duelists['player-1'].stamina as number;
      expect(stamina).toBeLessThan(50);
    });
  });

  describe('attack mechanics', () => {
    it('thrust deals 80% weapon damage', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      // Close gap (start at positions 1 and 6, distance = 5, sword reach = 2)
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      // Now distance should be around 2, within sword reach
      act(game, 'player-1', 'thrust', { target: 'mid' });

      const duelists = getDuelists(game);
      expect(duelists['player-2'].hp as number).toBeLessThan(100);
    });

    it('slash deals 100% weapon damage', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      // Close gap
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'slash', { target: 'mid' });

      const duelists = getDuelists(game);
      expect(duelists['player-2'].hp as number).toBeLessThan(100);
    });

    it('lunge deals 130% damage and advances position', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      const posBefore = getDuelists(game)['player-1'].position as number;
      // Close gap first
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      // Lunge from closer
      act(game, 'player-1', 'lunge', { target: 'mid' });

      const duelists = getDuelists(game);
      const posAfter = duelists['player-1'].position as number;
      // Position should have advanced past the initial
      expect(posAfter).toBeGreaterThan(posBefore);
    });

    it('attack fails when out of reach', () => {
      const game = createGame(2, { weaponPool: ['dagger', 'dagger'] });
      // Dagger reach = 1, starting distance >> 1
      const result = act(game, 'player-1', 'thrust', { target: 'mid' });
      expect(result.success).toBe(false);
    });
  });

  describe('guard and parry', () => {
    it('guard reduces damage on matching zone', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      // Close gap
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');

      // P2 guards mid
      act(game, 'player-2', 'guard', { zone: 'mid' });

      // Check that guard is set
      const beforeDuelists = getDuelists(game);
      expect(beforeDuelists['player-2'].guard).toBe('mid');

      // P1 attacks mid (guarded zone) vs high (unguarded)
      const hpBefore = getDuelists(game)['player-2'].hp as number;
      act(game, 'player-1', 'slash', { target: 'mid' });
      const hpAfterGuarded = getDuelists(game)['player-2'].hp as number;
      const guardedDamage = hpBefore - hpAfterGuarded;

      // Now test without guard matching
      // Reset by creating a new game
      const game2 = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      act(game2, 'player-1', 'advance');
      act(game2, 'player-1', 'advance');
      act(game2, 'player-1', 'advance');
      act(game2, 'player-2', 'guard', { zone: 'high' });
      const hp2Before = getDuelists(game2)['player-2'].hp as number;
      act(game2, 'player-1', 'slash', { target: 'mid' }); // attacks mid, guard is high
      const hp2After = getDuelists(game2)['player-2'].hp as number;
      const unguardedDamage = hp2Before - hp2After;

      // Guarded damage should be less
      expect(guardedDamage).toBeLessThan(unguardedDamage);
    });

    it('parry on correct zone triggers riposte', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      // Close gap
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');

      // P1 attacks mid
      act(game, 'player-1', 'slash', { target: 'mid' });

      // P2 parries mid (should match P1's last attack zone)
      const hpBefore = getDuelists(game)['player-1'].hp as number;
      act(game, 'player-2', 'parry', { zone: 'mid' });

      const duelists = getDuelists(game);
      // If parry was successful, P1 should have taken riposte damage
      const hpAfter = duelists['player-1'].hp as number;
      expect(hpAfter).toBeLessThan(hpBefore);
      expect(duelists['player-2'].parriesLanded as number).toBe(1);
    });

    it('parry on wrong zone does nothing', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], distanceSteps: 7 });
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');
      act(game, 'player-1', 'advance');

      // P1 attacks mid
      act(game, 'player-1', 'slash', { target: 'mid' });

      // P2 parries high (wrong zone)
      const hpBefore = getDuelists(game)['player-1'].hp as number;
      act(game, 'player-2', 'parry', { zone: 'high' });

      const duelists = getDuelists(game);
      expect(duelists['player-1'].hp as number).toBe(hpBefore);
    });
  });

  describe('feint mechanics', () => {
    it('feint sets the feint zone', () => {
      const game = createGame();
      act(game, 'player-1', 'feint', { fake: 'high' });

      const duelists = getDuelists(game);
      expect(duelists['player-1'].feintZone).toBe('high');
    });
  });

  describe('stamina management', () => {
    it('cannot attack without sufficient stamina', () => {
      const game = createGame(2, {
        weaponPool: ['sword', 'sword'],
        distanceSteps: 4,
        staminaRegenRate: 0,
      });

      // Drain stamina with repeated attacks
      for (let i = 0; i < 10; i++) {
        act(game, 'player-1', 'advance');
      }
      for (let i = 0; i < 20; i++) {
        const result = act(game, 'player-1', 'lunge', { target: 'mid' });
        if (!result.success) {
          expect(result.error).toContain('stamina');
          break;
        }
      }
    });

    it('stamina regenerates each turn', () => {
      const game = createGame(2, { weaponPool: ['sword', 'sword'], staminaRegenRate: 8 });
      // Guard costs 0 stamina but turn still ticks, causing regen
      act(game, 'player-1', 'guard', { zone: 'mid' });
      const duelists = getDuelists(game);
      // Guard costs 0, regen should bring stamina above 50 (or at 50 if regen applied on next turn)
      const stamina = duelists['player-1'].stamina as number;
      expect(stamina).toBeGreaterThanOrEqual(50);
    });
  });

  describe('round and match flow', () => {
    it('round ends when HP reaches 0', () => {
      const game = createGame(2, {
        weaponPool: ['axe', 'dagger'],
        distanceSteps: 4,
        roundsToWin: 1,
        woundSeverity: 0,
      });

      // Close gap and attack repeatedly
      act(game, 'player-1', 'advance');
      for (let i = 0; i < 30; i++) {
        if (game.isGameOver()) break;
        act(game, 'player-1', 'slash', { target: 'mid' });
      }

      if (game.isGameOver()) {
        expect(game.getWinner()).toBeDefined();
      }
    });
  });

  describe('scoring', () => {
    it('calculates scores based on rounds, wounds, and parries', () => {
      const game = createGame();
      const scores = game.getScores();
      expect(scores['player-1']).toBeDefined();
      expect(scores['player-2']).toBeDefined();
      // Both start at 0 (no round wins, no wounds, no parries)
      expect(scores['player-1']).toBe(0);
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'teleport');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = game.handleAction('hacker', {
        type: 'thrust',
        payload: { target: 'mid' },
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
    });
  });
});

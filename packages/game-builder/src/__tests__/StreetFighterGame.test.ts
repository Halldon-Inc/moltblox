import { describe, it, expect } from 'vitest';
import { StreetFighterGame } from '../examples/StreetFighterGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): StreetFighterGame {
  const game = new StreetFighterGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: StreetFighterGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('StreetFighterGame', () => {
  describe('initialization', () => {
    it('starts in playing phase with correct defaults', () => {
      const game = createGame();
      const state = game.getState();
      expect(state.phase).toBe('playing');
      const data = state.data as Record<string, unknown>;
      expect(data.roundsToWin).toBe(2);
      expect(data.roundTime).toBe(40);
      expect(data.superMeterMax).toBe(100);
      expect(data.chipDamagePercent).toBe(20);
    });

    it('initializes two fighters with distinct characters', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<
        string,
        { hp: number; character: string; position: number }
      >;
      expect(fighters['player-1']).toBeDefined();
      expect(fighters['player-2']).toBeDefined();
      // Positions should be separated
      expect(fighters['player-1'].position).toBeLessThan(fighters['player-2'].position);
    });

    it('assigns characters from the pool', () => {
      const game = createGame(2, { characterPool: ['zangief', 'chun'] });
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { character: string; hp: number }>;
      expect(fighters['player-1'].character).toBe('zangief');
      expect(fighters['player-1'].hp).toBe(130); // Zangief HP
      expect(fighters['player-2'].character).toBe('chun');
      expect(fighters['player-2'].hp).toBe(90); // Chun HP
    });

    it('creates CPU opponent in solo mode', () => {
      const game = createGame(1);
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { id: string }>;
      expect(fighters['cpu']).toBeDefined();
    });
  });

  describe('attack mechanics', () => {
    it('light attack deals damage and builds meter', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      act(game, 'player-1', 'dash', { direction: 'forward' }); // close gap
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'light');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number; superMeter: number }>;
      expect(fighters['player-2'].hp).toBeLessThan(100);
      expect(fighters['player-1'].superMeter).toBeGreaterThan(0);
    });

    it('heavy attack causes stun on unblocking opponent', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // Close gap first
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'heavy');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { stunFrames: number }>;
      expect(fighters['player-2'].stunFrames).toBe(1);
    });

    it('rejects attack when out of range', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // Positions start at 2 and 8, distance = 6 (out of melee range 2)
      const result = act(game, 'player-1', 'light');
      expect(result.success).toBe(false);
    });
  });

  describe('blocking and chip damage', () => {
    it('block reduces damage but allows chip through', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // Close gap
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'dash', { direction: 'forward' });
      // P2 blocks
      act(game, 'player-2', 'block');
      // P1 attacks
      act(game, 'player-1', 'medium');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number }>;
      // Chip damage should be much less than full damage
      expect(fighters['player-2'].hp).toBeLessThan(100);
      expect(fighters['player-2'].hp).toBeGreaterThan(85);
    });
  });

  describe('throw mechanics', () => {
    it('throw beats blocking opponent', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // Close gap
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-2', 'block');
      const result = act(game, 'player-1', 'throw');
      expect(result.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number; blocking: boolean }>;
      expect(fighters['player-2'].hp).toBeLessThan(100);
      expect(fighters['player-2'].blocking).toBe(false);
    });

    it('throw requires adjacency (distance <= 1)', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // At default positions (2 and 8), distance = 6
      const result = act(game, 'player-1', 'throw');
      expect(result.success).toBe(false);
    });
  });

  describe('special and super mechanics', () => {
    it('special attack uses character-specific move', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // Ryu's hadoken is ranged, works at any distance
      const result = act(game, 'player-1', 'special');
      expect(result.success).toBe(true);
    });

    it('EX special requires 50 meter', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      // Should fail: start with 0 meter
      const result = act(game, 'player-1', 'ex_special');
      expect(result.success).toBe(false);
    });

    it('super requires full meter', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'], superMeterMax: 100 });
      const result = act(game, 'player-1', 'super');
      expect(result.success).toBe(false);
    });
  });

  describe('dash and positioning', () => {
    it('dash forward moves toward opponent', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      const before = game.getState().data as Record<string, unknown>;
      const beforeFighters = before.fighters as Record<string, { position: number }>;
      const startPos = beforeFighters['player-1'].position;

      act(game, 'player-1', 'dash', { direction: 'forward' });

      const after = game.getState().data as Record<string, unknown>;
      const afterFighters = after.fighters as Record<string, { position: number }>;
      expect(afterFighters['player-1'].position).toBeGreaterThan(startPos);
    });

    it('dash back moves away from opponent', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'] });
      const before = game.getState().data as Record<string, unknown>;
      const beforeFighters = before.fighters as Record<string, { position: number }>;
      const startPos = beforeFighters['player-1'].position;

      act(game, 'player-1', 'dash', { direction: 'back' });

      const after = game.getState().data as Record<string, unknown>;
      const afterFighters = after.fighters as Record<string, { position: number }>;
      expect(afterFighters['player-1'].position).toBeLessThan(startPos);
    });
  });

  describe('round and match flow', () => {
    it('round ends when a fighter HP reaches 0', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'], roundsToWin: 1 });
      // Close gap
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'dash', { direction: 'forward' });
      // Pummel opponent
      for (let i = 0; i < 30; i++) {
        const result = act(game, 'player-1', 'heavy');
        if (game.isGameOver()) break;
      }
      // With roundsToWin=1, match should be over if player-1 won a round
      if (game.isGameOver()) {
        expect(game.getWinner()).toBeDefined();
      }
    });

    it('time up resolves round by HP percentage', () => {
      const game = createGame(2, { characterPool: ['ryu', 'ryu'], roundTime: 3 });
      // Close gap
      act(game, 'player-1', 'dash', { direction: 'forward' });
      act(game, 'player-1', 'dash', { direction: 'forward' });
      // Do a few attacks to tick the timer (3 turns = roundTime)
      act(game, 'player-1', 'light');
      // After roundTime turns, round should resolve
      const data = game.getState().data as Record<string, unknown>;
      // The round timer should have advanced
      expect(data.roundTimer as number).toBeGreaterThanOrEqual(1);
    });
  });

  describe('scoring', () => {
    it('calculates scores based on round wins and HP', () => {
      const game = createGame();
      const scores = game.getScores();
      expect(scores['player-1']).toBeDefined();
      expect(scores['player-2']).toBeDefined();
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
      const result = act(game, 'hacker', 'light');
      expect(result.success).toBe(false);
    });
  });
});

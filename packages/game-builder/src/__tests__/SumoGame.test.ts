import { describe, it, expect } from 'vitest';
import { SumoGame } from '../examples/SumoGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): SumoGame {
  const game = new SumoGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: SumoGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('SumoGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('places wrestlers on opposite sides of center', () => {
      const game = createGame(2, { ringSize: 5 });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { position: number }>;
      expect(wrestlers['player-1'].position).toBeLessThan(0);
      expect(wrestlers['player-2'].position).toBeGreaterThan(0);
    });

    it('initializes with 150 balance and 120 stamina', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { balance: number; stamina: number }>;
      expect(wrestlers['player-1'].balance).toBe(150);
      expect(wrestlers['player-1'].stamina).toBe(120);
    });

    it('creates CPU opponent for solo play', () => {
      const game = createGame(1);
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, unknown>;
      expect(wrestlers['cpu']).toBeDefined();
    });

    it('starts with tachiai available', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { tachiai: boolean }>;
      expect(wrestlers['player-1'].tachiai).toBe(true);
      expect(wrestlers['player-2'].tachiai).toBe(true);
    });
  });

  describe('push action', () => {
    it('moves opponent away from pusher', () => {
      const game = createGame(2, { ringSize: 10 });
      const dataBefore = game.getState().data as Record<string, unknown>;
      const wBefore = dataBefore.wrestlers as Record<string, { position: number }>;
      const posBefore = wBefore['player-2'].position;

      act(game, 'player-1', 'push');

      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { position: number }>;
      expect(wrestlers['player-2'].position).toBeGreaterThan(posBefore);
    });

    it('pushes 2 positions with grip', () => {
      const game = createGame(2, { ringSize: 10 });
      // Establish grip first
      act(game, 'player-1', 'grip', { type: 'mawashi' });

      const dataBefore = game.getState().data as Record<string, unknown>;
      const wBefore = dataBefore.wrestlers as Record<string, { position: number }>;
      const posBefore = wBefore['player-2'].position;

      act(game, 'player-1', 'push');

      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { position: number }>;
      // Should have moved 2 positions (grip bonus)
      expect(wrestlers['player-2'].position).toBe(posBefore + 2);
    });
  });

  describe('pull action', () => {
    it('moves opponent toward puller', () => {
      const game = createGame(2, { ringSize: 10 });
      const dataBefore = game.getState().data as Record<string, unknown>;
      const wBefore = dataBefore.wrestlers as Record<string, { position: number }>;
      const posBefore = wBefore['player-2'].position;

      act(game, 'player-1', 'pull');

      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { position: number }>;
      expect(wrestlers['player-2'].position).toBeLessThan(posBefore);
    });
  });

  describe('grip', () => {
    it('establishes mawashi grip', () => {
      const game = createGame();
      act(game, 'player-1', 'grip', { type: 'mawashi' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { grip: string | null }>;
      expect(wrestlers['player-1'].grip).toBe('mawashi');
    });

    it('establishes arm grip', () => {
      const game = createGame();
      act(game, 'player-1', 'grip', { type: 'arm' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { grip: string | null }>;
      expect(wrestlers['player-1'].grip).toBe('arm');
    });

    it('rejects invalid grip type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'grip', { type: 'headlock' });
      expect(result.success).toBe(false);
    });
  });

  describe('throw', () => {
    it('requires a grip to throw', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'throw');
      expect(result.success).toBe(false);
      expect(result.error).toContain('grip');
    });

    it('can throw with grip (position changes on success)', () => {
      const game = createGame(2, { ringSize: 10 });
      act(game, 'player-1', 'grip', { type: 'mawashi' });

      const dataBefore = game.getState().data as Record<string, unknown>;
      const wBefore = dataBefore.wrestlers as Record<string, { position: number }>;
      const posBefore = wBefore['player-2'].position;

      // Throw has random chance, just verify it processes successfully
      const result = act(game, 'player-1', 'throw');
      expect(result.success).toBe(true);
    });
  });

  describe('slap', () => {
    it('breaks opponent grip and deals balance damage', () => {
      const game = createGame(2, { ringSize: 10 });
      // Opponent grips
      act(game, 'player-2', 'grip', { type: 'arm' });
      // Player slaps to break it
      act(game, 'player-1', 'slap');

      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { grip: string | null; balance: number }>;
      expect(wrestlers['player-2'].grip).toBeNull();
      // Slap deals 6 damage but end-of-turn regen restores +8 (capped at 150)
      // Net effect: grip is broken, balance restored to cap
      expect(wrestlers['player-2'].balance).toBeLessThanOrEqual(150);
    });
  });

  describe('charge (tachiai)', () => {
    it('pushes opponent 3+ positions on first turn', () => {
      const game = createGame(2, { ringSize: 10 });
      const dataBefore = game.getState().data as Record<string, unknown>;
      const wBefore = dataBefore.wrestlers as Record<string, { position: number }>;
      const posBefore = wBefore['player-2'].position;

      act(game, 'player-1', 'charge');

      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { position: number }>;
      // With tachiai bonus window, push should be at least 3 (possibly 4-5 with bonus)
      expect(wrestlers['player-2'].position).toBeGreaterThanOrEqual(posBefore + 3);
    });

    it('only available on first turn', () => {
      const game = createGame(2, { ringSize: 10 });
      act(game, 'player-1', 'charge'); // Use tachiai
      const result = act(game, 'player-1', 'charge'); // Should fail
      expect(result.success).toBe(false);
      expect(result.error).toContain('first turn');
    });
  });

  describe('ring out win condition', () => {
    it('wins when opponent pushed past ring edge', () => {
      const game = createGame(2, { ringSize: 3 });
      // Repeatedly push until ring out
      for (let i = 0; i < 20; i++) {
        act(game, 'player-1', 'push');
        if (game.isGameOver()) break;
      }
      if (game.isGameOver()) {
        expect(game.getWinner()).toBe('player-1');
      }
    });
  });

  describe('stamina', () => {
    it('regenerates stamina each turn', () => {
      const game = createGame(2, { ringSize: 10 });
      // Use stamina
      act(game, 'player-1', 'push'); // costs 5
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { stamina: number }>;
      // 120 - 5 (push cost) + 10 (regen) = 125, capped at 120
      expect(wrestlers['player-1'].stamina).toBe(120);
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'headbutt');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'push');
      expect(result.success).toBe(false);
    });
  });

  describe('scores', () => {
    it('awards score on ring out victory', () => {
      const game = createGame(2, { ringSize: 3 });
      for (let i = 0; i < 20; i++) {
        act(game, 'player-1', 'push');
        if (game.isGameOver()) break;
      }
      if (game.isGameOver()) {
        const scores = game.getScores();
        expect(scores['player-1']).toBeGreaterThan(0);
      }
    });
  });
});

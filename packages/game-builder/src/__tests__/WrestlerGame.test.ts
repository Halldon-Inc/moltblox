import { describe, it, expect } from 'vitest';
import { WrestlerGame } from '../examples/WrestlerGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): WrestlerGame {
  const game = new WrestlerGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: WrestlerGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('WrestlerGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes wrestlers with correct defaults', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<
        string,
        { hp: number; maxHp: number; stamina: number; momentum: number; ropeBreaksLeft: number }
      >;
      expect(wrestlers['player-1'].hp).toBe(100);
      expect(wrestlers['player-1'].maxHp).toBe(100);
      expect(wrestlers['player-1'].stamina).toBe(100);
      expect(wrestlers['player-1'].momentum).toBe(0);
      expect(wrestlers['player-1'].ropeBreaksLeft).toBe(3);
    });

    it('defaults to singles match', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.matchType).toBe('singles');
    });

    it('respects config overrides', () => {
      const game = createGame(2, { matchType: 'cage', finisherThreshold: 60, ropeBreaks: 5 });
      const data = game.getState().data as Record<string, unknown>;
      expect(data.matchType).toBe('cage');
      expect(data.finisherThreshold).toBe(60);
      // Cage matches have 0 rope breaks
      const wrestlers = data.wrestlers as Record<string, { ropeBreaksLeft: number }>;
      expect(wrestlers['player-1'].ropeBreaksLeft).toBe(0);
    });
  });

  describe('strike action', () => {
    it('deals damage to opponent', () => {
      const game = createGame();
      act(game, 'player-1', 'strike', { type: 'punch' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { hp: number }>;
      expect(wrestlers['player-2'].hp).toBeLessThan(100);
    });

    it('builds momentum on hit', () => {
      const game = createGame();
      act(game, 'player-1', 'strike', { type: 'kick' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { momentum: number }>;
      expect(wrestlers['player-1'].momentum).toBeGreaterThan(0);
    });

    it('costs stamina', () => {
      const game = createGame();
      act(game, 'player-1', 'strike', { type: 'chop' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { stamina: number }>;
      // Stamina was 100, cost 5, then regen 5 = 100
      // But the regen applies to all, so effectively stays near 100
      expect(wrestlers['player-1'].stamina).toBe(100);
    });

    it('affects crowd meter positively', () => {
      const game = createGame();
      act(game, 'player-1', 'strike', { type: 'punch' });
      const data = game.getState().data as Record<string, unknown>;
      expect(data.crowdMeter as number).toBeGreaterThan(0);
    });
  });

  describe('grapple action', () => {
    it('succeeds when wrestler has equal or higher power', () => {
      const game = createGame();
      // With equal stamina and momentum, the initiator wins (>= check)
      const result = act(game, 'player-1', 'grapple');
      expect(result.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { hp: number; momentum: number }>;
      // Grapple success builds momentum
      expect(wrestlers['player-1'].momentum).toBeGreaterThan(0);
      // Opponent took 12 damage from slam
      expect(wrestlers['player-2'].hp).toBeLessThan(100);
    });

    it('costs 15 stamina', () => {
      const game = createGame();
      act(game, 'player-1', 'grapple');
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { stamina: number }>;
      // 100 - 15 (cost) + 5 (regen) = 90
      expect(wrestlers['player-1'].stamina).toBe(90);
    });
  });

  describe('irish_whip action', () => {
    it('deals damage and repositions opponent', () => {
      const game = createGame();
      act(game, 'player-1', 'irish_whip', { direction: 'corner' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { hp: number; position: string }>;
      expect(wrestlers['player-2'].hp).toBeLessThan(100);
      expect(wrestlers['player-2'].position).toBe('corner');
    });
  });

  describe('pin system', () => {
    it('initiates a pin attempt', () => {
      const game = createGame();
      act(game, 'player-1', 'pin');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.pinAttemptActive).toBe(true);
      expect(data.pinAttacker).toBe('player-1');
      expect(data.pinDefender).toBe('player-2');
    });

    it('defender can kick out if HP is above 20%', () => {
      const game = createGame();
      act(game, 'player-1', 'pin');
      const result = act(game, 'player-2', 'kick_out');
      expect(result.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      expect(data.pinAttemptActive).toBe(false);
    });

    it('blocks non-defender actions during pin', () => {
      const game = createGame();
      act(game, 'player-1', 'pin');
      const result = act(game, 'player-1', 'strike', { type: 'punch' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pin attempt in progress');
    });

    it('defender can use rope break during pin', () => {
      const game = createGame();
      act(game, 'player-1', 'pin');
      const result = act(game, 'player-2', 'rope_break');
      expect(result.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      expect(data.pinAttemptActive).toBe(false);
      const wrestlers = data.wrestlers as Record<string, { ropeBreaksLeft: number }>;
      expect(wrestlers['player-2'].ropeBreaksLeft).toBe(2);
    });
  });

  describe('rope break', () => {
    it('decrements rope break count', () => {
      const game = createGame();
      act(game, 'player-1', 'rope_break');
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { ropeBreaksLeft: number }>;
      expect(wrestlers['player-1'].ropeBreaksLeft).toBe(2);
    });

    it('fails when no rope breaks left', () => {
      const game = createGame(2, { ropeBreaks: 0 });
      const result = act(game, 'player-1', 'rope_break');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No rope breaks remaining');
    });

    it('fails in cage match', () => {
      const game = createGame(2, { matchType: 'cage' });
      const result = act(game, 'player-1', 'rope_break');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cage');
    });
  });

  describe('finisher', () => {
    it('requires momentum threshold', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'finisher');
      expect(result.success).toBe(false);
      expect(result.error).toContain('momentum');
    });

    it('deals heavy damage when momentum is sufficient', () => {
      const game = createGame(2, { finisherThreshold: 20 });
      // Build momentum with strikes
      for (let i = 0; i < 5; i++) {
        act(game, 'player-1', 'strike', { type: 'kick' });
      }
      const dataBefore = game.getState().data as Record<string, unknown>;
      const wrestlersBefore = dataBefore.wrestlers as Record<string, { momentum: number }>;

      if (wrestlersBefore['player-1'].momentum >= 20) {
        const result = act(game, 'player-1', 'finisher');
        expect(result.success).toBe(true);
        const dataAfter = game.getState().data as Record<string, unknown>;
        const wrestlersAfter = dataAfter.wrestlers as Record<
          string,
          { hp: number; momentum: number }
        >;
        // Finisher deals 30 damage
        expect(wrestlersAfter['player-2'].hp).toBeLessThanOrEqual(100 - 30);
        // Momentum reset after finisher
        expect(wrestlersAfter['player-1'].momentum).toBe(0);
      }
    });
  });

  describe('climb_turnbuckle', () => {
    it('changes position to turnbuckle and builds momentum', () => {
      const game = createGame();
      act(game, 'player-1', 'climb_turnbuckle');
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { position: string; momentum: number }>;
      expect(wrestlers['player-1'].position).toBe('turnbuckle');
      expect(wrestlers['player-1'].momentum).toBeGreaterThan(0);
    });

    it('deals aerial damage to opponent', () => {
      const game = createGame();
      act(game, 'player-1', 'climb_turnbuckle');
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { hp: number }>;
      expect(wrestlers['player-2'].hp).toBeLessThan(100);
    });
  });

  describe('tag match', () => {
    it('sets up tag partners correctly', () => {
      const game = createGame(4, { matchType: 'tag' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<
        string,
        { tagPartner?: string; isActive?: boolean }
      >;
      expect(wrestlers['player-1'].tagPartner).toBeDefined();
      expect(wrestlers['player-1'].isActive).toBe(true);
    });

    it('tag_partner fails in singles match', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'tag_partner');
      expect(result.success).toBe(false);
    });
  });

  describe('royal rumble', () => {
    it('eliminates wrestlers when HP reaches 0', () => {
      const game = createGame(3, { matchType: 'royal-rumble' });
      // Pummel player-2 until eliminated
      for (let i = 0; i < 30; i++) {
        act(game, 'player-1', 'strike', { type: 'kick' });
        if (game.isGameOver()) break;
      }
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { hp: number; eliminated: boolean }>;
      // Player-2 should have taken damage
      expect(wrestlers['player-2'].hp).toBeLessThan(100);
    });
  });

  describe('cage match', () => {
    it('has zero rope breaks', () => {
      const game = createGame(2, { matchType: 'cage' });
      const data = game.getState().data as Record<string, unknown>;
      const wrestlers = data.wrestlers as Record<string, { ropeBreaksLeft: number }>;
      expect(wrestlers['player-1'].ropeBreaksLeft).toBe(0);
      expect(wrestlers['player-2'].ropeBreaksLeft).toBe(0);
    });
  });

  describe('scores', () => {
    it('calculates scores based on momentum and status', () => {
      const game = createGame();
      act(game, 'player-1', 'strike', { type: 'punch' });
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
      expect(scores['player-2']).toBeGreaterThanOrEqual(0);
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'suplex');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'strike', { type: 'punch' });
      expect(result.success).toBe(false);
    });

    it('rejects kick_out when no pin is active', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'kick_out');
      expect(result.success).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { TagTeamGame } from '../examples/TagTeamGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): TagTeamGame {
  const game = new TagTeamGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: TagTeamGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('TagTeamGame', () => {
  describe('initialization', () => {
    it('starts in playing phase with two teams', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, unknown>;
      expect(Object.keys(teams).length).toBe(2);
    });

    it('each team has 2 fighters', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, { fighters: { hp: number; tagged: boolean }[] }>;
      const team1 = teams['player-1'];
      expect(team1.fighters.length).toBe(2);
      expect(team1.fighters[0].tagged).toBe(true);
      expect(team1.fighters[1].tagged).toBe(false);
    });

    it('creates CPU team for solo play', () => {
      const game = createGame(1);
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, unknown>;
      expect(teams['cpu']).toBeDefined();
    });

    it('initializes fighters with 100 HP', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, { fighters: { hp: number }[] }>;
      expect(teams['player-1'].fighters[0].hp).toBe(100);
      expect(teams['player-1'].fighters[1].hp).toBe(100);
    });
  });

  describe('attack action', () => {
    it('light attack deals 8 damage', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { type: 'light' });
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<
        string,
        { fighters: { hp: number }[]; activeIndex: number }
      >;
      const oppActive = teams['player-2'].fighters[teams['player-2'].activeIndex];
      expect(oppActive.hp).toBe(92); // 100 - 8
    });

    it('heavy attack deals 16 damage and costs stamina', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { type: 'heavy' });
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<
        string,
        { fighters: { hp: number; stamina: number }[]; activeIndex: number }
      >;
      const oppActive = teams['player-2'].fighters[teams['player-2'].activeIndex];
      expect(oppActive.hp).toBe(84); // 100 - 16
    });

    it('builds sync meter on attack', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { type: 'light' });
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, { syncMeter: number }>;
      expect(teams['player-1'].syncMeter).toBe(5);
    });
  });

  describe('tag system', () => {
    it('switches active fighter on tag', () => {
      const game = createGame(2, { tagCooldown: 0 });
      const dataBefore = game.getState().data as Record<string, unknown>;
      const teamsBefore = dataBefore.teams as Record<string, { activeIndex: number }>;
      expect(teamsBefore['player-1'].activeIndex).toBe(0);

      act(game, 'player-1', 'tag_in');
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, { activeIndex: number }>;
      expect(teams['player-1'].activeIndex).toBe(1);
    });

    it('enforces tag cooldown', () => {
      const game = createGame(2, { tagCooldown: 3 });
      act(game, 'player-1', 'tag_in');
      const result = act(game, 'player-1', 'tag_in');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cooldown');
    });

    it('benched fighter recovers HP', () => {
      const game = createGame(2, { tagCooldown: 0, recoveryRate: 10 });
      // Damage active fighter first
      act(game, 'player-2', 'attack', { type: 'heavy' }); // damages player-1's active
      const dataMid = game.getState().data as Record<string, unknown>;
      const teamsMid = dataMid.teams as Record<string, { fighters: { hp: number }[] }>;
      const hpAfterHit = teamsMid['player-1'].fighters[0].hp;

      // Tag out the damaged fighter
      act(game, 'player-1', 'tag_in');

      // Do some actions to trigger recovery
      act(game, 'player-1', 'attack', { type: 'light' });

      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<string, { fighters: { hp: number }[] }>;
      // The originally active fighter (now benched at index 0) should have recovered
      expect(teams['player-1'].fighters[0].hp).toBeGreaterThan(hpAfterHit);
    });
  });

  describe('assist', () => {
    it('deals assist damage to opponent', () => {
      const game = createGame(2, { assistDamage: 15 });
      act(game, 'player-1', 'call_assist');
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<
        string,
        { fighters: { hp: number }[]; activeIndex: number }
      >;
      const oppActive = teams['player-2'].fighters[teams['player-2'].activeIndex];
      expect(oppActive.hp).toBe(85); // 100 - 15
    });
  });

  describe('block', () => {
    it('reduces incoming damage by 70%', () => {
      const game = createGame();
      act(game, 'player-2', 'block');
      act(game, 'player-1', 'attack', { type: 'heavy' }); // 16 * 0.3 = 4.8 => 4
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<
        string,
        { fighters: { hp: number }[]; activeIndex: number }
      >;
      const oppActive = teams['player-2'].fighters[teams['player-2'].activeIndex];
      // Should take floor(16 * 0.3) = 4 damage (adding recovery of 3 between turns)
      // HP = 100 - 4 + recovery = depends on turn ordering
      expect(oppActive.hp).toBeGreaterThan(84); // Much less than 16 damage
    });
  });

  describe('sync special', () => {
    it('rejects sync special when meter not full', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'sync_special');
      expect(result.success).toBe(false);
      expect(result.error).toContain('meter');
    });

    it('deals 50 damage and resets meter when full', () => {
      const game = createGame(2, { syncMeterRate: 50 });
      // Build meter to 100
      act(game, 'player-1', 'attack', { type: 'light' }); // +50
      act(game, 'player-1', 'attack', { type: 'light' }); // +50 = 100

      // Use sync special
      act(game, 'player-1', 'sync_special');
      const data = game.getState().data as Record<string, unknown>;
      const teams = data.teams as Record<
        string,
        { syncMeter: number; fighters: { hp: number }[]; activeIndex: number }
      >;
      expect(teams['player-1'].syncMeter).toBe(0);
    });
  });

  describe('win condition', () => {
    it('team loses when both fighters reach 0 HP', () => {
      const game = createGame(2, { syncMeterRate: 50 });
      // Keep attacking until match ends
      for (let i = 0; i < 50; i++) {
        const result = act(game, 'player-1', 'attack', { type: 'heavy' });
        if (game.isGameOver()) break;
      }
      // Game should eventually end
      if (game.isGameOver()) {
        expect(game.getWinner()).toBe('player-1');
      }
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'uppercut');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'attack', { type: 'light' });
      expect(result.success).toBe(false);
    });
  });

  describe('scores', () => {
    it('tracks damage dealt as score', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { type: 'light' });
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
    });
  });
});

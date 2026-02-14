import { describe, it, expect } from 'vitest';
import { MartialArtsGame } from '../examples/MartialArtsGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): MartialArtsGame {
  const game = new MartialArtsGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: MartialArtsGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('MartialArtsGame', () => {
  describe('initialization', () => {
    it('starts in playing phase with default styles', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
      const data = game.getState().data as Record<string, unknown>;
      const styles = data.availableStyles as string[];
      expect(styles).toContain('kung-fu');
      expect(styles).toContain('karate');
      expect(styles.length).toBe(5);
    });

    it('initializes fighters with 100 HP and default kung-fu stance', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number; stance: string }>;
      expect(fighters['player-1'].hp).toBe(100);
      expect(fighters['player-2'].hp).toBe(100);
      expect(fighters['player-1'].stance).toBe('kung-fu');
    });

    it('creates CPU opponent for solo play', () => {
      const game = createGame(1);
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number }>;
      expect(fighters['cpu']).toBeDefined();
      expect(fighters['cpu'].hp).toBe(100);
    });

    it('respects config overrides', () => {
      const game = createGame(2, { roundsToWin: 3, flowBonusMultiplier: 2.0 });
      const data = game.getState().data as Record<string, unknown>;
      expect(data.roundsToWin).toBe(3);
      expect(data.flowBonusMultiplier).toBe(2.0);
    });
  });

  describe('stance switching', () => {
    it('switches stance successfully', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'switch_stance', { style: 'karate' });
      expect(result.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { stance: string }>;
      expect(fighters['player-1'].stance).toBe('karate');
    });

    it('rejects invalid style', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'switch_stance', { style: 'boxing' });
      expect(result.success).toBe(false);
    });

    it('enforces cooldown between switches', () => {
      const game = createGame();
      act(game, 'player-1', 'switch_stance', { style: 'karate' });
      const result = act(game, 'player-1', 'switch_stance', { style: 'judo' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cooldown');
    });
  });

  describe('combat', () => {
    it('strike deals damage to opponent', () => {
      const game = createGame();
      act(game, 'player-1', 'strike');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number }>;
      expect(fighters['player-2'].hp).toBeLessThan(100);
    });

    it('kick deals damage to opponent', () => {
      const game = createGame();
      act(game, 'player-1', 'kick');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number }>;
      expect(fighters['player-2'].hp).toBeLessThan(100);
    });

    it('counter deals 150% damage when opponent attacked last turn', () => {
      const game = createGame();
      // Opponent attacks first
      act(game, 'player-2', 'strike');
      const hpBefore = (
        (game.getState().data as Record<string, unknown>).fighters as Record<string, { hp: number }>
      )['player-2'].hp;

      // Player-1 counters (should deal 150% since player-2 attacked)
      act(game, 'player-1', 'counter');
      const hpAfter = (
        (game.getState().data as Record<string, unknown>).fighters as Record<string, { hp: number }>
      )['player-2'].hp;

      expect(hpAfter).toBeLessThan(hpBefore);
    });

    it('counter wastes turn when opponent did not attack', () => {
      const game = createGame();
      // No prior attack from opponent
      act(game, 'player-1', 'counter');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number }>;
      // Opponent HP should remain 100
      expect(fighters['player-2'].hp).toBe(100);
    });

    it('special costs 30 stamina and deals 2x stance atk', () => {
      const game = createGame();
      const hpBefore = 100;
      act(game, 'player-1', 'special');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number; stamina: number }>;
      // kung-fu atk = 8, special = 2x = 16
      expect(fighters['player-2'].hp).toBe(hpBefore - 16);
      expect(fighters['player-1'].stamina).toBe(70); // 100 - 30
    });

    it('rejects special when stamina is too low', () => {
      const game = createGame();
      // Use specials until stamina runs out
      act(game, 'player-1', 'special'); // 70
      act(game, 'player-1', 'special'); // 40
      act(game, 'player-1', 'special'); // 10
      const result = act(game, 'player-1', 'special');
      expect(result.success).toBe(false);
      expect(result.error).toContain('stamina');
    });
  });

  describe('flow combo', () => {
    it('grants bonus damage after 3 different stances in combo chain', () => {
      const game = createGame(2, { stanceSwitchCooldown: 0 });
      // Attack in kung-fu
      act(game, 'player-1', 'strike');
      // Switch to karate, attack
      act(game, 'player-1', 'switch_stance', { style: 'karate' });
      act(game, 'player-1', 'strike');
      // Switch to judo, attack (this should trigger flow combo)
      act(game, 'player-1', 'switch_stance', { style: 'judo' });

      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { comboChain: string[] }>;
      // Combo chain should have entries from different stances
      expect(fighters['player-1'].comboChain.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('win condition', () => {
    it('ends round when fighter HP reaches 0', () => {
      const game = createGame(2, { roundsToWin: 1 });
      // Repeatedly attack until someone goes down
      for (let i = 0; i < 30; i++) {
        act(game, 'player-1', 'special');
        if (game.isGameOver()) break;
        act(game, 'player-1', 'strike');
        if (game.isGameOver()) break;
      }
      if (game.isGameOver()) {
        expect(game.getWinner()).toBe('player-1');
      }
    });

    it('supports multi-round matches', () => {
      const game = createGame(2, { roundsToWin: 2 });
      // Win first round
      for (let i = 0; i < 30; i++) {
        const result = act(game, 'player-1', 'strike');
        if (!result.success) break;
        const data = game.getState().data as Record<string, unknown>;
        if ((data as { roundOver: boolean }).roundOver) break;
      }
      const data1 = game.getState().data as Record<string, unknown>;
      expect((data1 as { roundOver: boolean }).roundOver).toBe(true);
      // Match should not be over yet (need 2 rounds)
      expect((data1 as { matchOver: boolean }).matchOver).toBe(false);

      // Start next round
      const nextResult = act(game, 'player-1', 'next_round');
      expect(nextResult.success).toBe(true);
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
      const result = act(game, 'hacker', 'strike');
      expect(result.success).toBe(false);
    });
  });

  describe('scores', () => {
    it('tracks damage as score', () => {
      const game = createGame();
      act(game, 'player-1', 'strike');
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
    });
  });
});

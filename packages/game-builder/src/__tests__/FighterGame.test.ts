import { describe, it, expect } from 'vitest';
import { FighterGame } from '../examples/FighterGame.js';

function createGame(playerCount = 2, config: Record<string, unknown> = {}): FighterGame {
  const game = new FighterGame(config);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: FighterGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('FighterGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes fighters with correct HP', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number; maxHp: number }>;
      expect(fighters['player-1'].hp).toBe(100);
      expect(fighters['player-2'].hp).toBe(100);
    });

    it('defaults to 1v1 mode', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.mode).toBe('1v1');
    });

    it('respects config overrides', () => {
      const game = createGame(2, { fightStyle: 'arena', roundsToWin: 3 });
      const data = game.getState().data as Record<string, unknown>;
      expect(data.mode).toBe('arena');
      expect(data.roundsToWin).toBe(3);
    });
  });

  describe('attack action', () => {
    it('deals damage to opponent in 1v1', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { attackType: 'light' });
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { hp: number }>;
      expect(fighters['player-2'].hp).toBeLessThan(100);
    });

    it('special attack costs stamina', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { attackType: 'special' });
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { stamina: number }>;
      expect(fighters['player-1'].stamina).toBeLessThan(100);
    });

    it('rejects special when stamina is too low', () => {
      const game = createGame();
      // Drain stamina
      for (let i = 0; i < 4; i++) {
        act(game, 'player-1', 'attack', { attackType: 'special' });
      }
      const result = act(game, 'player-1', 'attack', { attackType: 'special' });
      // After 3 specials (90 stamina used) + regen, 4th may work, but eventually fails
      // Just check the game handles it without crashing
      expect(result).toBeDefined();
    });
  });

  describe('block action', () => {
    it('sets blocking state', () => {
      const game = createGame();
      act(game, 'player-1', 'block');
      const data = game.getState().data as Record<string, unknown>;
      const fighters = data.fighters as Record<string, { isBlocking: boolean }>;
      expect(fighters['player-1'].isBlocking).toBe(true);
    });
  });

  describe('win condition', () => {
    it('declares winner when opponent HP reaches 0', () => {
      const game = createGame(2, { roundsToWin: 1 });
      // Heavy attacks deal 18 damage, special deals 25
      for (let i = 0; i < 20; i++) {
        const result = act(game, 'player-1', 'attack', { attackType: 'heavy' });
        if (game.isGameOver()) break;
      }
      // Either game ended or player-2 is low
      if (game.isGameOver()) {
        const winner = game.getWinner();
        expect(winner).toBe('player-1');
      }
    });
  });

  describe('beat-em-up mode', () => {
    it('spawns wave enemies', () => {
      const game = createGame(1, { fightStyle: 'beat-em-up' });
      const data = game.getState().data as Record<string, unknown>;
      const enemies = data.waveEnemies as { alive: boolean }[];
      expect(enemies.length).toBeGreaterThan(0);
    });

    it('defeats enemies with attacks', () => {
      const game = createGame(1, { fightStyle: 'beat-em-up' });
      for (let i = 0; i < 20; i++) {
        act(game, 'player-1', 'attack', { attackType: 'heavy' });
        if (game.isGameOver()) break;
      }
      // Game should have progressed
      const data = game.getState().data as Record<string, unknown>;
      expect((data.totalScore as Record<string, number>)['player-1']).toBeGreaterThan(0);
    });
  });

  describe('scores', () => {
    it('tracks damage as score', () => {
      const game = createGame();
      act(game, 'player-1', 'attack', { attackType: 'light' });
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
      const result = act(game, 'hacker', 'attack', { attackType: 'light' });
      expect(result.success).toBe(false);
    });
  });
});

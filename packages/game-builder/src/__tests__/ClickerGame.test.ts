import { describe, it, expect } from 'vitest';
import { ClickerGame } from '../examples/ClickerGame.js';

function createGame(playerCount = 1): ClickerGame {
  const game = new ClickerGame();
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: ClickerGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('ClickerGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes click count to 0 for each player', () => {
      const game = createGame(2);
      const data = game.getState().data as Record<string, unknown>;
      const clicks = data.clicks as Record<string, number>;
      expect(clicks['player-1']).toBe(0);
      expect(clicks['player-2']).toBe(0);
    });

    it('sets target clicks', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.targetClicks).toBe(100);
    });

    it('rejects zero players', () => {
      const game = new ClickerGame();
      expect(() => game.initialize([])).toThrow('At least one player required');
    });

    it('rejects more than maxPlayers', () => {
      const game = new ClickerGame();
      expect(() => game.initialize(['a', 'b', 'c', 'd', 'e'])).toThrow('Max 4 players allowed');
    });
  });

  describe('click action', () => {
    it('increments click count by 1', () => {
      const game = createGame();
      act(game, 'player-1', 'click');
      const data = game.getState().data as Record<string, unknown>;
      const clicks = data.clicks as Record<string, number>;
      expect(clicks['player-1']).toBe(1);
    });

    it('tracks lastAction', () => {
      const game = createGame();
      act(game, 'player-1', 'click');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.lastAction).toBe('player-1');
    });

    it('allows multiple clicks', () => {
      const game = createGame();
      for (let i = 0; i < 5; i++) {
        act(game, 'player-1', 'click');
      }
      const data = game.getState().data as Record<string, unknown>;
      const clicks = data.clicks as Record<string, number>;
      expect(clicks['player-1']).toBe(5);
    });
  });

  describe('multi_click action', () => {
    it('increments by specified amount', () => {
      const game = createGame();
      act(game, 'player-1', 'multi_click', { amount: 3 });
      const data = game.getState().data as Record<string, unknown>;
      const clicks = data.clicks as Record<string, number>;
      expect(clicks['player-1']).toBe(3);
    });

    it('caps at 5 per action', () => {
      const game = createGame();
      act(game, 'player-1', 'multi_click', { amount: 10 });
      const data = game.getState().data as Record<string, unknown>;
      const clicks = data.clicks as Record<string, number>;
      expect(clicks['player-1']).toBe(5);
    });
  });

  describe('unknown action', () => {
    it('returns error for unknown action type', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'fly');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });

  describe('game over', () => {
    it('is not over at start', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);
    });

    it('ends when a player reaches target clicks', () => {
      const game = createGame();
      for (let i = 0; i < 100; i++) {
        act(game, 'player-1', 'click');
      }
      expect(game.isGameOver()).toBe(true);
    });

    it('declares the reaching player as winner', () => {
      const game = createGame(2);
      for (let i = 0; i < 100; i++) {
        act(game, 'player-2', 'click');
      }
      expect(game.getWinner()).toBe('player-2');
    });

    it('rejects actions after game ends', () => {
      const game = createGame();
      for (let i = 0; i < 100; i++) {
        act(game, 'player-1', 'click');
      }
      const result = act(game, 'player-1', 'click');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Game is already over');
    });
  });

  describe('scores', () => {
    it('returns click counts as scores', () => {
      const game = createGame(2);
      act(game, 'player-1', 'click');
      act(game, 'player-1', 'click');
      act(game, 'player-2', 'click');
      const scores = game.getScores();
      expect(scores['player-1']).toBe(2);
      expect(scores['player-2']).toBe(1);
    });
  });

  describe('fog of war', () => {
    it('hides other player exact click counts', () => {
      const game = createGame(2);
      for (let i = 0; i < 5; i++) {
        act(game, 'player-1', 'click');
      }
      act(game, 'player-2', 'click');
      const playerState = game.getStateForPlayer('player-2');
      const data = playerState.data as Record<string, unknown>;
      const clicks = data.clicks as Record<string, number | string>;
      expect(clicks['player-2']).toBe(1);
      expect(clicks['player-1']).toBe('ahead');
    });
  });

  describe('invalid player', () => {
    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'click');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a valid player');
    });
  });
});

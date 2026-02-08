import { describe, it, expect } from 'vitest';
import { PuzzleGame } from '../examples/PuzzleGame.js';

function createGame(): PuzzleGame {
  const game = new PuzzleGame();
  game.initialize(['player-1']);
  return game;
}

function act(game: PuzzleGame, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction('player-1', { type, payload, timestamp: Date.now() });
}

interface PuzzleState {
  grid: number[];
  revealed: boolean[];
  matched: boolean[];
  selected: number | null;
  moves: number;
  matches: number;
  gridSize: number;
  [key: string]: unknown;
}

function getData(game: PuzzleGame): PuzzleState {
  return game.getState().data as PuzzleState;
}

describe('PuzzleGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('creates a 4x4 grid with 16 cells', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.grid).toHaveLength(16);
    });

    it('grid contains pairs (each value 1-8 appears exactly twice)', () => {
      const game = createGame();
      const data = getData(game);
      const counts: Record<number, number> = {};
      for (const val of data.grid) {
        counts[val] = (counts[val] || 0) + 1;
      }
      for (let i = 1; i <= 8; i++) {
        expect(counts[i]).toBe(2);
      }
    });

    it('starts with no cells revealed or matched', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.revealed.every((r) => r === false)).toBe(true);
      expect(data.matched.every((m) => m === false)).toBe(true);
    });

    it('starts with 0 moves and 0 matches', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.moves).toBe(0);
      expect(data.matches).toBe(0);
    });

    it('is single player only', () => {
      expect(new PuzzleGame().maxPlayers).toBe(1);
    });
  });

  describe('select action', () => {
    it('reveals the first selected cell', () => {
      const game = createGame();
      act(game, 'select', { index: 0 });
      const data = getData(game);
      expect(data.revealed[0]).toBe(true);
      expect(data.selected).toBe(0);
    });

    it('rejects invalid cell index (negative)', () => {
      const game = createGame();
      const result = act(game, 'select', { index: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid cell index');
    });

    it('rejects invalid cell index (too high)', () => {
      const game = createGame();
      const result = act(game, 'select', { index: 16 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid cell index');
    });

    it('rejects selecting already revealed cell', () => {
      const game = createGame();
      act(game, 'select', { index: 0 });
      const result = act(game, 'select', { index: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already revealed');
    });

    it('matching a pair increments matches and marks cells', () => {
      const game = createGame();
      const data = getData(game);
      // Find a matching pair
      const val = data.grid[0];
      const matchIndex = data.grid.indexOf(val, 1);

      act(game, 'select', { index: 0 });
      act(game, 'select', { index: matchIndex });

      const after = getData(game);
      expect(after.matched[0]).toBe(true);
      expect(after.matched[matchIndex]).toBe(true);
      expect(after.matches).toBe(1);
      expect(after.moves).toBe(1);
    });

    it('non-matching pair hides both cells', () => {
      const game = createGame();
      const data = getData(game);
      // Find two cells with different values
      let secondIndex = 1;
      while (data.grid[secondIndex] === data.grid[0] && secondIndex < 15) {
        secondIndex++;
      }

      act(game, 'select', { index: 0 });
      act(game, 'select', { index: secondIndex });

      const after = getData(game);
      expect(after.revealed[0]).toBe(false);
      expect(after.revealed[secondIndex]).toBe(false);
      expect(after.matches).toBe(0);
    });
  });

  describe('game over', () => {
    it('is not over at start', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);
    });

    it('ends when all 8 pairs are matched', () => {
      const game = createGame();
      const data = getData(game);

      // Match all pairs in order
      const matched = new Set<number>();
      for (let i = 0; i < 16; i++) {
        if (matched.has(i)) continue;
        const val = data.grid[i];
        for (let j = i + 1; j < 16; j++) {
          if (matched.has(j)) continue;
          if (data.grid[j] === val) {
            act(game, 'select', { index: i });
            act(game, 'select', { index: j });
            matched.add(i);
            matched.add(j);
            break;
          }
        }
      }

      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBe('player-1');
    });
  });

  describe('scores', () => {
    it('calculates score based on efficiency', () => {
      const game = createGame();
      const data = getData(game);

      // Perfect game: match all pairs in 8 moves
      const matched = new Set<number>();
      for (let i = 0; i < 16; i++) {
        if (matched.has(i)) continue;
        const val = data.grid[i];
        for (let j = i + 1; j < 16; j++) {
          if (matched.has(j)) continue;
          if (data.grid[j] === val) {
            act(game, 'select', { index: i });
            act(game, 'select', { index: j });
            matched.add(i);
            matched.add(j);
            break;
          }
        }
      }

      const scores = game.getScores();
      // Perfect game: 1000 - (8-8)*50 = 1000
      expect(scores['player-1']).toBe(1000);
    });
  });

  describe('fog of war', () => {
    it('hides grid values for unrevealed/unmatched cells', () => {
      const game = createGame();
      const playerState = game.getStateForPlayer('player-1');
      const data = playerState.data as PuzzleState;
      // All should be hidden (0)
      expect(data.grid.every((v) => v === 0)).toBe(true);
    });
  });

  describe('unknown action', () => {
    it('rejects unknown action types', () => {
      const game = createGame();
      const result = act(game, 'flip');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });
});

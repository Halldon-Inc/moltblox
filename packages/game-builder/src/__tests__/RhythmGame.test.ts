import { describe, it, expect } from 'vitest';
import { RhythmGame } from '../examples/RhythmGame.js';

function createGame(playerCount = 1): RhythmGame {
  const game = new RhythmGame();
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: RhythmGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

interface Note {
  id: number;
  lane: number;
  beatTime: number;
  hit: boolean;
  missed: boolean;
}

interface RhythmState {
  notes: Note[];
  currentBeat: number;
  totalBeats: number;
  bpm: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  maxCombos: Record<string, number>;
  multipliers: Record<string, number>;
  hitCounts: Record<string, Record<string, number>>;
  difficulty: string;
  songComplete: boolean;
  [key: string]: unknown;
}

function getData(game: RhythmGame): RhythmState {
  return game.getState().data as RhythmState;
}

describe('RhythmGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('generates a note chart', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.notes.length).toBeGreaterThan(0);
    });

    it('starts at beat 0', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.currentBeat).toBe(0);
    });

    it('initializes score to 0', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.scores['player-1']).toBe(0);
    });

    it('initializes combo to 0', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.combos['player-1']).toBe(0);
    });

    it('initializes multiplier to 1', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.multipliers['player-1']).toBe(1);
    });

    it('sets default difficulty to normal', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.difficulty).toBe('normal');
    });

    it('supports up to 4 players', () => {
      const game = createGame(4);
      const data = getData(game);
      expect(Object.keys(data.scores)).toHaveLength(4);
    });
  });

  describe('advance_beat', () => {
    it('increments current beat', () => {
      const game = createGame();
      act(game, 'player-1', 'advance_beat');
      const data = getData(game);
      expect(data.currentBeat).toBe(1);
    });

    it('marks song complete when reaching total beats', () => {
      const game = createGame();
      const data = getData(game);
      const totalBeats = data.totalBeats;

      for (let i = 0; i < totalBeats; i++) {
        act(game, 'player-1', 'advance_beat');
      }

      const after = getData(game);
      expect(after.songComplete).toBe(true);
    });

    it('auto-misses notes that pass the OK window', () => {
      const game = createGame();
      const data = getData(game);
      // Find the first note
      const firstNote = data.notes[0];
      if (!firstNote) return;

      // Advance past the note's beat time plus the OK window
      for (let i = 0; i <= firstNote.beatTime + 1; i++) {
        act(game, 'player-1', 'advance_beat');
      }

      const after = getData(game);
      const note = after.notes.find((n) => n.id === firstNote.id);
      if (note) {
        expect(note.missed).toBe(true);
      }
    });
  });

  describe('hit_note', () => {
    it('rejects invalid lane (negative)', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'hit_note', { lane: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid lane');
    });

    it('rejects invalid lane (> 3)', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'hit_note', { lane: 4 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid lane');
    });

    it('hitting a note on the correct beat increases score', () => {
      const game = createGame();
      const data = getData(game);
      const firstNote = data.notes[0];
      if (!firstNote) return;

      // Advance to the note's beat
      for (let i = 0; i < firstNote.beatTime; i++) {
        act(game, 'player-1', 'advance_beat');
      }

      act(game, 'player-1', 'hit_note', { lane: firstNote.lane });
      const after = getData(game);
      expect(after.scores['player-1']).toBeGreaterThan(0);
    });

    it('hitting notes builds combo', () => {
      const game = createGame();
      const data = getData(game);
      // Hit the first note if available
      const firstNote = data.notes[0];
      if (!firstNote) return;

      for (let i = 0; i < firstNote.beatTime; i++) {
        act(game, 'player-1', 'advance_beat');
      }

      act(game, 'player-1', 'hit_note', { lane: firstNote.lane });
      const after = getData(game);
      expect(after.combos['player-1']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('game over', () => {
    it('is not over at start', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('scores', () => {
    it('starts at zero for all players', () => {
      const game = createGame(2);
      const scores = game.getScores();
      expect(scores['player-1']).toBe(0);
      expect(scores['player-2']).toBe(0);
    });
  });

  describe('invalid player', () => {
    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'advance_beat');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a valid player');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generateSwiss,
  seedPlayers,
  shuffleArray,
} from '../BracketGenerator.js';

describe('BracketGenerator', () => {
  describe('generateSingleElimination', () => {
    it('generates 1 match for 2 players', () => {
      const matches = generateSingleElimination(['p1', 'p2']);
      expect(matches).toHaveLength(1);
      expect(matches[0].round).toBe(1);
      expect(matches[0].player1Id).toBe('p1');
      expect(matches[0].player2Id).toBe('p2');
    });

    it('generates 3 matches for 4 players', () => {
      const matches = generateSingleElimination(['p1', 'p2', 'p3', 'p4']);
      expect(matches).toHaveLength(3);
      const round1 = matches.filter((m) => m.round === 1);
      const round2 = matches.filter((m) => m.round === 2);
      expect(round1).toHaveLength(2);
      expect(round2).toHaveLength(1);
      expect(round2[0].bracket).toBe('finals');
    });

    it('pads 3 players to 4 with a bye', () => {
      const matches = generateSingleElimination(['p1', 'p2', 'p3']);
      expect(matches).toHaveLength(3);
      const round1 = matches.filter((m) => m.round === 1);
      const hasBye = round1.some((m) => m.player1Id === '' || m.player2Id === '');
      expect(hasBye).toBe(true);
    });

    it('generates 7 matches across 3 rounds for 8 players', () => {
      const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
      const matches = generateSingleElimination(players);
      expect(matches).toHaveLength(7);
      const round1 = matches.filter((m) => m.round === 1);
      const round2 = matches.filter((m) => m.round === 2);
      const round3 = matches.filter((m) => m.round === 3);
      expect(round1).toHaveLength(4);
      expect(round2).toHaveLength(2);
      expect(round3).toHaveLength(1);
    });

    it('throws for less than 2 players', () => {
      expect(() => generateSingleElimination(['p1'])).toThrow('At least 2 players');
      expect(() => generateSingleElimination([])).toThrow('At least 2 players');
    });
  });

  describe('generateDoubleElimination', () => {
    it('generates winners + losers + finals for 4 players', () => {
      const matches = generateDoubleElimination(['p1', 'p2', 'p3', 'p4']);
      const winners = matches.filter((m) => m.bracket === 'winners');
      const losers = matches.filter((m) => m.bracket === 'losers');
      const finals = matches.filter((m) => m.bracket === 'finals');
      expect(winners.length).toBeGreaterThan(0);
      expect(losers.length).toBeGreaterThan(0);
      expect(finals).toHaveLength(2);
    });

    it('throws for less than 2 players', () => {
      expect(() => generateDoubleElimination(['p1'])).toThrow('At least 2 players');
    });
  });

  describe('generateRoundRobin', () => {
    it('generates 3 matches for 3 players', () => {
      const matches = generateRoundRobin(['p1', 'p2', 'p3']);
      expect(matches).toHaveLength(3);
    });

    it('generates 6 matches in 3 rounds for 4 players', () => {
      const matches = generateRoundRobin(['p1', 'p2', 'p3', 'p4']);
      expect(matches).toHaveLength(6);
      const rounds = new Set(matches.map((m) => m.round));
      expect(rounds.size).toBe(3);
    });

    it('skips byes for odd number of players', () => {
      const matches = generateRoundRobin(['p1', 'p2', 'p3']);
      for (const match of matches) {
        expect(match.player1Id).not.toBe('');
        expect(match.player2Id).not.toBe('');
      }
    });

    it('throws for less than 2 players', () => {
      expect(() => generateRoundRobin(['p1'])).toThrow('At least 2 players');
    });
  });

  describe('generateSwiss', () => {
    it('generates round 1 matches plus placeholder rounds', () => {
      const matches = generateSwiss(['p1', 'p2', 'p3', 'p4'], 3);
      const round1 = matches.filter((m) => m.round === 1);
      expect(round1).toHaveLength(2);
      expect(round1[0].player1Id).not.toBe('');
      expect(round1[0].player2Id).not.toBe('');
      const round2 = matches.filter((m) => m.round === 2);
      expect(round2.length).toBeGreaterThan(0);
      for (const m of round2) {
        expect(m.player1Id).toBe('');
        expect(m.player2Id).toBe('');
      }
    });

    it('throws for less than 2 players', () => {
      expect(() => generateSwiss(['p1'], 3)).toThrow('At least 2 players');
    });
  });

  describe('seedPlayers', () => {
    it('places highest rated player at best bracket position', () => {
      const ratings = new Map([
        ['p1', 1500],
        ['p2', 1200],
        ['p3', 1800],
        ['p4', 1000],
      ]);
      const seeded = seedPlayers(['p1', 'p2', 'p3', 'p4'], ratings);
      expect(seeded[0]).toBe('p3');
    });

    it('returns array with correct number of positions', () => {
      const ratings = new Map([
        ['p1', 1500],
        ['p2', 1200],
      ]);
      const seeded = seedPlayers(['p1', 'p2'], ratings);
      expect(seeded).toHaveLength(2);
      expect(seeded).toContain('p1');
      expect(seeded).toContain('p2');
    });
  });

  describe('shuffleArray', () => {
    it('returns array with same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffleArray([...arr]);
      expect(result).toHaveLength(arr.length);
    });

    it('returns array with same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffleArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('returns the same array reference (mutates in place)', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffleArray(arr);
      expect(result).toBe(arr);
    });
  });
});

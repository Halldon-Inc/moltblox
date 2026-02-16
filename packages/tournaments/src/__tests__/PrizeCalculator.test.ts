import { describe, it, expect } from 'vitest';
import { calculatePrizes, validateDistribution, DEFAULT_DISTRIBUTION } from '../PrizeCalculator.js';
import type { PrizeDistribution } from '@moltblox/protocol';

describe('PrizeCalculator', () => {
  describe('calculatePrizes', () => {
    it('returns empty array for empty standings', () => {
      const result = calculatePrizes('1000', DEFAULT_DISTRIBUTION, []);
      expect(result).toEqual([]);
    });

    it('gives 100% to sole player', () => {
      const result = calculatePrizes('1000', DEFAULT_DISTRIBUTION, ['player1']);
      expect(result).toHaveLength(1);
      expect(result[0].playerId).toBe('player1');
      expect(result[0].placement).toBe(1);
      expect(result[0].prizeAmount).toBe('1000');
      expect(result[0].percentage).toBe(100);
    });

    it('redistributes correctly for 2 players', () => {
      // first: 50, second: 25, third: 15, participation: 10
      // firstPct = 50 + floor(15/2) + floor(10/2) = 50 + 7 + 5 = 62
      // secondPct = 100 - 62 = 38
      const result = calculatePrizes('1000', DEFAULT_DISTRIBUTION, ['p1', 'p2']);
      expect(result).toHaveLength(2);
      expect(result[0].percentage).toBe(62);
      expect(result[1].percentage).toBe(38);
      expect(result[0].prizeAmount).toBe('620');
      expect(result[1].prizeAmount).toBe('380');
    });

    it('redistributes correctly for 3 players', () => {
      // participation=10, extraEach=floor(10/3)=3, remainder=10-3*3=1
      // first: 50+3+1=54, second: 25+3=28, third: 15+3=18
      const result = calculatePrizes('1000', DEFAULT_DISTRIBUTION, ['p1', 'p2', 'p3']);
      expect(result).toHaveLength(3);
      expect(result[0].percentage).toBe(54);
      expect(result[1].percentage).toBe(28);
      expect(result[2].percentage).toBe(18);
      expect(result[0].prizeAmount).toBe('540');
      expect(result[1].prizeAmount).toBe('280');
      expect(result[2].prizeAmount).toBe('180');
    });

    it('distributes standard amounts for 4+ players', () => {
      const result = calculatePrizes('1000', DEFAULT_DISTRIBUTION, ['p1', 'p2', 'p3', 'p4']);
      expect(result).toHaveLength(4);
      expect(result[0].percentage).toBe(50);
      expect(result[1].percentage).toBe(25);
      expect(result[2].percentage).toBe(15);
      expect(result[0].prizeAmount).toBe('500');
      expect(result[1].prizeAmount).toBe('250');
      expect(result[2].prizeAmount).toBe('150');
      expect(result[3].prizeAmount).toBe('100');
    });

    it('splits participation pool among remaining players for 6 players', () => {
      const result = calculatePrizes('1200', DEFAULT_DISTRIBUTION, [
        'p1',
        'p2',
        'p3',
        'p4',
        'p5',
        'p6',
      ]);
      expect(result).toHaveLength(6);
      // participation pool = 1200 * 10 / 100 = 120
      // per player (4th-6th) = 120 / 3 = 40 each
      expect(result[0].prizeAmount).toBe('600'); // 50%
      expect(result[1].prizeAmount).toBe('300'); // 25%
      expect(result[2].prizeAmount).toBe('180'); // 15%
      expect(result[3].prizeAmount).toBe('40');
      expect(result[4].prizeAmount).toBe('40');
      expect(result[5].prizeAmount).toBe('40');
    });

    it('handles BigInt precision with large prize pools', () => {
      const bigPool = '1000000000000000000'; // 1e18
      const result = calculatePrizes(bigPool, DEFAULT_DISTRIBUTION, ['p1', 'p2', 'p3', 'p4']);
      expect(result[0].prizeAmount).toBe('500000000000000000');
      expect(result[1].prizeAmount).toBe('250000000000000000');
      expect(result[2].prizeAmount).toBe('150000000000000000');
      expect(result[3].prizeAmount).toBe('100000000000000000');
    });

    it('throws if distribution does not total 100', () => {
      const badDist: PrizeDistribution = { first: 50, second: 25, third: 15, participation: 5 };
      expect(() => calculatePrizes('1000', badDist, ['p1', 'p2', 'p3', 'p4'])).toThrow(
        'Prize distribution must total 100%',
      );
    });
  });

  describe('validateDistribution', () => {
    it('returns true for valid distribution', () => {
      expect(validateDistribution(DEFAULT_DISTRIBUTION)).toBe(true);
    });

    it('throws for negative percentages', () => {
      expect(() =>
        validateDistribution({ first: 60, second: 30, third: -5, participation: 15 }),
      ).toThrow('non-negative');
    });

    it('throws when total is not 100', () => {
      expect(() =>
        validateDistribution({ first: 50, second: 25, third: 15, participation: 5 }),
      ).toThrow('must total 100%');
    });

    it('throws when first < second', () => {
      expect(() =>
        validateDistribution({ first: 20, second: 40, third: 30, participation: 10 }),
      ).toThrow('First place prize must be >= second');
    });

    it('throws when second < third', () => {
      expect(() =>
        validateDistribution({ first: 50, second: 10, third: 30, participation: 10 }),
      ).toThrow('Second place prize must be >= third');
    });
  });
});

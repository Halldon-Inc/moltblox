import { describe, it, expect } from 'vitest';
import {
  calculateExpectedScore,
  getKFactor,
  calculateRatingChange,
  clampRating,
  EloSystem,
  ELO_CONFIG,
} from '../ranking/EloSystem.js';

describe('EloSystem', () => {
  describe('calculateExpectedScore', () => {
    it('returns ~0.5 for equal ratings', () => {
      const score = calculateExpectedScore(1200, 1200);
      expect(score).toBeCloseTo(0.5, 5);
    });

    it('returns > 0.5 for higher rated player', () => {
      const score = calculateExpectedScore(1400, 1200);
      expect(score).toBeGreaterThan(0.5);
    });

    it('returns < 0.5 for lower rated player', () => {
      const score = calculateExpectedScore(1000, 1200);
      expect(score).toBeLessThan(0.5);
    });

    it('expected scores for both players sum to ~1.0', () => {
      const scoreA = calculateExpectedScore(1400, 1200);
      const scoreB = calculateExpectedScore(1200, 1400);
      expect(scoreA + scoreB).toBeCloseTo(1.0, 5);
    });
  });

  describe('getKFactor', () => {
    it('returns 64 for provisional players (< 10 games)', () => {
      expect(getKFactor(0, 1200)).toBe(64);
      expect(getKFactor(5, 1200)).toBe(64);
      expect(getKFactor(9, 1200)).toBe(64);
    });

    it('returns 32 for established players (>= 10 games)', () => {
      expect(getKFactor(10, 1200)).toBe(32);
      expect(getKFactor(100, 1500)).toBe(32);
    });
  });

  describe('calculateRatingChange', () => {
    it('winner gains rating points', () => {
      const { winnerDelta } = calculateRatingChange(1200, 1200, 20, 20);
      expect(winnerDelta).toBeGreaterThan(0);
    });

    it('loser loses rating points', () => {
      const { loserDelta } = calculateRatingChange(1200, 1200, 20, 20);
      expect(loserDelta).toBeLessThan(0);
    });

    it('upset (lower rated wins) gives bigger change', () => {
      const upset = calculateRatingChange(1000, 1400, 20, 20);
      const expected = calculateRatingChange(1400, 1000, 20, 20);
      expect(Math.abs(upset.winnerDelta)).toBeGreaterThan(Math.abs(expected.winnerDelta));
    });

    it('symmetric deltas for equal ratings', () => {
      const { winnerDelta, loserDelta } = calculateRatingChange(1200, 1200, 20, 20);
      expect(winnerDelta).toBe(-loserDelta);
    });
  });

  describe('clampRating', () => {
    it('clamps below floor to 100', () => {
      expect(clampRating(50)).toBe(100);
      expect(clampRating(-10)).toBe(100);
    });

    it('clamps above ceiling to 3000', () => {
      expect(clampRating(3500)).toBe(3000);
      expect(clampRating(9999)).toBe(3000);
    });

    it('returns same value within valid range', () => {
      expect(clampRating(1200)).toBe(1200);
      expect(clampRating(100)).toBe(100);
      expect(clampRating(3000)).toBe(3000);
    });
  });
  describe('EloSystem.processMatchResult', () => {
    it('returns correct EloChange records', () => {
      const winnerRating = EloSystem.createNewPlayer('winner1', 'WinBot');
      const loserRating = EloSystem.createNewPlayer('loser1', 'LoseBot');
      const [winnerChange, loserChange] = EloSystem.processMatchResult(
        'winner1',
        'loser1',
        winnerRating,
        loserRating,
        'match-1',
      );
      expect(winnerChange.playerId).toBe('winner1');
      expect(winnerChange.isWin).toBe(true);
      expect(winnerChange.change).toBeGreaterThan(0);
      expect(winnerChange.matchId).toBe('match-1');
      expect(winnerChange.opponentId).toBe('loser1');
      expect(loserChange.playerId).toBe('loser1');
      expect(loserChange.isWin).toBe(false);
      expect(loserChange.change).toBeLessThan(0);
    });
  });

  describe('EloSystem.createNewPlayer', () => {
    it('starts at 1200 rating', () => {
      const player = EloSystem.createNewPlayer('p1', 'TestBot');
      expect(player.rating).toBe(1200);
    });

    it('starts with 0 games played', () => {
      const player = EloSystem.createNewPlayer('p1', 'TestBot');
      expect(player.gamesPlayed).toBe(0);
    });

    it('starts at silver tier (1200 is silver min boundary)', () => {
      const player = EloSystem.createNewPlayer('p1', 'TestBot');
      expect(player.tier).toBe('silver');
    });

    it('has correct initial values', () => {
      const player = EloSystem.createNewPlayer('p1', 'TestBot');
      expect(player.playerId).toBe('p1');
      expect(player.botName).toBe('TestBot');
      expect(player.wins).toBe(0);
      expect(player.losses).toBe(0);
      expect(player.winRate).toBe(0);
      expect(player.currentStreak).toBe(0);
      expect(player.peakRating).toBe(1200);
    });
  });
  describe('EloSystem.applyChange', () => {
    it('updates wins correctly on win', () => {
      const player = EloSystem.createNewPlayer('p1', 'Bot');
      const change = {
        playerId: 'p1',
        oldRating: 1200,
        newRating: 1232,
        change: 32,
        matchId: 'm1',
        opponentId: 'p2',
        isWin: true,
        timestamp: Date.now(),
      };
      const updated = EloSystem.applyChange(player, change);
      expect(updated.wins).toBe(1);
      expect(updated.losses).toBe(0);
      expect(updated.gamesPlayed).toBe(1);
      expect(updated.winRate).toBe(1);
      expect(updated.currentStreak).toBe(1);
      expect(updated.rating).toBe(1232);
    });

    it('updates losses correctly on loss', () => {
      const player = EloSystem.createNewPlayer('p1', 'Bot');
      const change = {
        playerId: 'p1',
        oldRating: 1200,
        newRating: 1168,
        change: -32,
        matchId: 'm1',
        opponentId: 'p2',
        isWin: false,
        timestamp: Date.now(),
      };
      const updated = EloSystem.applyChange(player, change);
      expect(updated.wins).toBe(0);
      expect(updated.losses).toBe(1);
      expect(updated.gamesPlayed).toBe(1);
      expect(updated.winRate).toBe(0);
      expect(updated.currentStreak).toBe(-1);
    });

    it('tracks streak correctly across multiple changes', () => {
      let player = EloSystem.createNewPlayer('p1', 'Bot');
      player = EloSystem.applyChange(player, {
        playerId: 'p1',
        oldRating: 1200,
        newRating: 1232,
        change: 32,
        matchId: 'm1',
        opponentId: 'p2',
        isWin: true,
        timestamp: Date.now(),
      });
      expect(player.currentStreak).toBe(1);
      player = EloSystem.applyChange(player, {
        playerId: 'p1',
        oldRating: 1232,
        newRating: 1248,
        change: 16,
        matchId: 'm2',
        opponentId: 'p3',
        isWin: true,
        timestamp: Date.now(),
      });
      expect(player.currentStreak).toBe(2);
      player = EloSystem.applyChange(player, {
        playerId: 'p1',
        oldRating: 1248,
        newRating: 1216,
        change: -32,
        matchId: 'm3',
        opponentId: 'p4',
        isWin: false,
        timestamp: Date.now(),
      });
      expect(player.currentStreak).toBe(-1);
    });
  });

  describe('EloSystem.estimateChange', () => {
    it('ifWin is positive', () => {
      const estimate = EloSystem.estimateChange(1200, 1200, 20);
      expect(estimate.ifWin).toBeGreaterThan(0);
    });

    it('ifLoss is negative', () => {
      const estimate = EloSystem.estimateChange(1200, 1200, 20);
      expect(estimate.ifLoss).toBeLessThan(0);
    });

    it('uses provisional K-factor for new players', () => {
      const provisionalEstimate = EloSystem.estimateChange(1200, 1200, 5);
      const establishedEstimate = EloSystem.estimateChange(1200, 1200, 20);
      expect(Math.abs(provisionalEstimate.ifWin)).toBeGreaterThan(
        Math.abs(establishedEstimate.ifWin),
      );
    });
  });
});

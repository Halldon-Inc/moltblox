/**
 * Tournament service for Moltblox
 * Manages tournament lifecycle: creation, registration, bracket progression, and prize distribution
 */

import type {
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  TournamentFormat,
  TournamentStatus,
  PrizeDistribution,
  MatchFormat,
  TournamentType,
  TournamentWinner,
  BracketRound,
} from '@moltblox/protocol';

import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generateSwiss,
  shuffleArray,
  type BracketMatch,
} from './BracketGenerator.js';

import { calculatePrizes, DEFAULT_DISTRIBUTION, type PrizeResult } from './PrizeCalculator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for creating a new tournament */
export interface CreateTournamentConfig {
  name: string;
  description: string;
  gameId: string;
  sponsorId: string;
  sponsorAddress: string;
  type: TournamentType;
  prizePool: string;
  entryFee: string;
  distribution?: PrizeDistribution;
  maxParticipants: number;
  format: TournamentFormat;
  matchFormat: MatchFormat;
  rules: string;
  registrationStart: Date;
  registrationEnd: Date;
  startTime: Date;
}

/** Tournament standings entry */
export interface StandingEntry {
  playerId: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  placement: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Stateful tournament service.
 * All data is stored in-memory using Maps.
 */
export class TournamentService {
  private tournaments = new Map<string, Tournament>();
  private matches = new Map<string, TournamentMatch[]>(); // tournamentId -> matches
  private idCounter = 0;
  private matchIdCounter = 0;

  // -----------------------------------------------------------------------
  // Tournament Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Create a new tournament.
   *
   * @param config - Tournament configuration
   * @returns The created tournament
   */
  createTournament(config: CreateTournamentConfig): Tournament {
    const id = this.generateId('tourney');

    const tournament: Tournament = {
      id,
      name: config.name,
      description: config.description,
      gameId: config.gameId,
      sponsorId: config.sponsorId,
      sponsorAddress: config.sponsorAddress,
      type: config.type,
      prizePool: config.prizePool,
      entryFee: config.entryFee,
      distribution: config.distribution ?? { ...DEFAULT_DISTRIBUTION },
      maxParticipants: config.maxParticipants,
      currentParticipants: 0,
      participants: [],
      format: config.format,
      matchFormat: config.matchFormat,
      rules: config.rules,
      registrationStart: config.registrationStart,
      registrationEnd: config.registrationEnd,
      startTime: config.startTime,
      status: 'upcoming',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tournaments.set(id, tournament);
    this.matches.set(id, []);

    return tournament;
  }

  /**
   * Register a player for a tournament.
   *
   * @param tournamentId - Tournament ID
   * @param playerId - Player ID
   * @param playerAddress - Player wallet address
   * @returns The registered participant
   */
  registerParticipant(
    tournamentId: string,
    playerId: string,
    playerAddress: string = '0x0000000000000000000000000000000000000000',
  ): TournamentParticipant {
    const tournament = this.getTournamentOrThrow(tournamentId);

    if (tournament.status !== 'upcoming' && tournament.status !== 'registration') {
      throw new Error(`Cannot register: tournament status is '${tournament.status}'`);
    }

    if (tournament.currentParticipants >= tournament.maxParticipants) {
      throw new Error('Tournament is full');
    }

    // Check for duplicate registration
    const existing = tournament.participants.find((p) => p.playerId === playerId);
    if (existing) {
      throw new Error(`Player ${playerId} is already registered`);
    }

    const participant: TournamentParticipant = {
      playerId,
      playerAddress,
      registeredAt: new Date(),
      entryFeePaid: tournament.entryFee,
      status: 'registered',
    };

    tournament.participants.push(participant);
    tournament.currentParticipants++;
    tournament.status = 'registration';
    tournament.updatedAt = new Date();

    return participant;
  }

  /**
   * Start a tournament by generating the bracket and setting status to active.
   *
   * @param tournamentId - Tournament ID
   * @returns The updated tournament
   */
  startTournament(tournamentId: string): Tournament {
    const tournament = this.getTournamentOrThrow(tournamentId);

    if (tournament.status !== 'registration' && tournament.status !== 'upcoming') {
      throw new Error(`Cannot start: tournament status is '${tournament.status}'`);
    }

    if (tournament.currentParticipants < 2) {
      throw new Error('At least 2 participants are required to start a tournament');
    }

    // Shuffle participants for random seeding
    const playerIds = shuffleArray(tournament.participants.map((p) => p.playerId));

    // Generate bracket based on format
    const bracketMatches = this.generateBracket(tournament.format, playerIds);

    // Convert bracket matches to full TournamentMatch objects
    const tournamentMatches: TournamentMatch[] = bracketMatches.map((bm) => ({
      id: this.generateMatchId(),
      tournamentId,
      round: bm.round,
      matchNumber: bm.matchNumber,
      bracket: bm.bracket,
      player1Id: bm.player1Id,
      player2Id: bm.player2Id,
      status: bm.player1Id && bm.player2Id ? 'scheduled' : 'pending',
    }));

    this.matches.set(tournamentId, tournamentMatches);

    // Update participant statuses
    for (const p of tournament.participants) {
      p.status = 'active';
    }

    // Auto-resolve byes in round 1
    this.resolveByeMatches(tournamentId);

    tournament.status = 'active';
    tournament.updatedAt = new Date();

    return tournament;
  }

  /**
   * Report the result of a match.
   *
   * @param tournamentId - Tournament ID
   * @param matchId - Match ID
   * @param winnerId - Player ID of the winner
   * @param score - Optional score object
   * @returns The updated match
   */
  reportResult(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    score?: { player1: number; player2: number },
  ): TournamentMatch {
    const tournament = this.getTournamentOrThrow(tournamentId);

    if (tournament.status !== 'active') {
      throw new Error(`Cannot report result: tournament status is '${tournament.status}'`);
    }

    const tournamentMatches = this.matches.get(tournamentId) ?? [];
    const match = tournamentMatches.find((m) => m.id === matchId);

    if (!match) {
      throw new Error(`Match ${matchId} not found in tournament ${tournamentId}`);
    }

    if (match.status === 'completed') {
      throw new Error(`Match ${matchId} has already been completed`);
    }

    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      throw new Error(`Winner ${winnerId} is not a participant in match ${matchId}`);
    }

    match.winnerId = winnerId;
    match.status = 'completed';
    match.endedAt = new Date();
    if (score) {
      match.score = score;
    }

    // Update participant status for the loser in elimination formats
    if (tournament.format === 'single_elimination') {
      const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
      const loser = tournament.participants.find((p) => p.playerId === loserId);
      if (loser) {
        loser.status = 'eliminated';
      }
    }

    tournament.updatedAt = new Date();

    return match;
  }

  /**
   * Advance the bracket after results have been reported.
   * Moves winners to the next round's matches.
   *
   * @param tournamentId - Tournament ID
   * @returns Array of matches that were updated
   */
  advanceBracket(tournamentId: string): TournamentMatch[] {
    const tournament = this.getTournamentOrThrow(tournamentId);
    const tournamentMatches = this.matches.get(tournamentId) ?? [];
    const updated: TournamentMatch[] = [];

    // Find the current round (lowest round with incomplete matches that have players assigned)
    const rounds = [...new Set(tournamentMatches.map((m) => m.round))].sort((a, b) => a - b);

    for (const round of rounds) {
      const roundMatches = tournamentMatches.filter((m) => m.round === round);
      const allCompleted = roundMatches.every(
        (m) => m.status === 'completed' || (!m.player1Id && !m.player2Id),
      );

      if (!allCompleted) continue;

      // Find next round matches to populate
      const nextRound = rounds.find((r) => r > round);
      if (!nextRound) continue;

      const nextRoundMatches = tournamentMatches.filter((m) => m.round === nextRound);
      const winners = roundMatches.filter((m) => m.winnerId).map((m) => m.winnerId!);

      // Pair winners into next round matches
      let winnerIdx = 0;
      for (const nextMatch of nextRoundMatches) {
        if (nextMatch.player1Id && nextMatch.player2Id) continue; // already filled

        if (!nextMatch.player1Id && winnerIdx < winners.length) {
          nextMatch.player1Id = winners[winnerIdx++];
        }
        if (!nextMatch.player2Id && winnerIdx < winners.length) {
          nextMatch.player2Id = winners[winnerIdx++];
        }

        // If both players are now assigned, schedule the match
        if (nextMatch.player1Id && nextMatch.player2Id) {
          nextMatch.status = 'scheduled';
          nextMatch.scheduledAt = new Date();
        }

        updated.push(nextMatch);
      }
    }

    tournament.updatedAt = new Date();
    return updated;
  }

  /**
   * Get a tournament by ID.
   *
   * @param tournamentId - Tournament ID
   * @returns The tournament or undefined
   */
  getTournament(tournamentId: string): Tournament | undefined {
    return this.tournaments.get(tournamentId);
  }

  /**
   * Get current standings for a tournament.
   *
   * @param tournamentId - Tournament ID
   * @returns Array of standing entries sorted by placement
   */
  getStandings(tournamentId: string): StandingEntry[] {
    const tournament = this.getTournamentOrThrow(tournamentId);
    const tournamentMatches = this.matches.get(tournamentId) ?? [];

    // Build win/loss records
    const records = new Map<string, { wins: number; losses: number; draws: number }>();

    for (const p of tournament.participants) {
      records.set(p.playerId, { wins: 0, losses: 0, draws: 0 });
    }

    for (const match of tournamentMatches) {
      if (match.status !== 'completed' || !match.winnerId) continue;

      const winner = records.get(match.winnerId);
      if (winner) winner.wins++;

      const loserId = match.player1Id === match.winnerId ? match.player2Id : match.player1Id;
      if (loserId) {
        const loser = records.get(loserId);
        if (loser) loser.losses++;
      }
    }

    // Sort by wins (descending), then losses (ascending)
    const standings: StandingEntry[] = [];
    for (const [playerId, record] of records) {
      standings.push({
        playerId,
        wins: record.wins,
        losses: record.losses,
        draws: record.draws,
        points: record.wins * 3 + record.draws,
        placement: 0, // filled below
      });
    }

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.wins - a.wins;
    });

    // Assign placements (handle ties)
    let currentPlacement = 1;
    for (let i = 0; i < standings.length; i++) {
      if (
        i > 0 &&
        standings[i].points === standings[i - 1].points &&
        standings[i].losses === standings[i - 1].losses
      ) {
        standings[i].placement = standings[i - 1].placement;
      } else {
        standings[i].placement = currentPlacement;
      }
      currentPlacement++;
    }

    return standings;
  }

  /**
   * Complete a tournament: finalize standings and calculate prizes.
   *
   * @param tournamentId - Tournament ID
   * @returns The completed tournament with winners
   */
  completeTournament(tournamentId: string): Tournament {
    const tournament = this.getTournamentOrThrow(tournamentId);

    if (tournament.status !== 'active') {
      throw new Error(`Cannot complete: tournament status is '${tournament.status}'`);
    }

    const standings = this.getStandings(tournamentId);
    const standingsOrder = standings.map((s) => s.playerId);

    // Calculate prizes
    const prizeResults = calculatePrizes(
      tournament.prizePool,
      tournament.distribution,
      standingsOrder,
    );

    // Create winner records
    const winners: TournamentWinner[] = prizeResults
      .filter((pr) => BigInt(pr.prizeAmount) > 0n)
      .map((pr) => {
        const participant = tournament.participants.find((p) => p.playerId === pr.playerId);
        return {
          playerId: pr.playerId,
          playerAddress: participant?.playerAddress ?? '0x0000000000000000000000000000000000000000',
          placement: pr.placement,
          prizeAmount: pr.prizeAmount,
          txHash: '', // Would be filled after on-chain payout
          paidAt: new Date(),
        };
      });

    // Update participant statuses and placements
    for (const standing of standings) {
      const participant = tournament.participants.find((p) => p.playerId === standing.playerId);
      if (participant) {
        participant.placement = standing.placement;
        const prize = prizeResults.find((pr) => pr.playerId === standing.playerId);
        if (prize) {
          participant.prizeWon = prize.prizeAmount;
        }
        if (standing.placement === 1) {
          participant.status = 'winner';
        } else if (participant.status !== 'eliminated') {
          participant.status = 'eliminated';
        }
      }
    }

    tournament.winners = winners;
    tournament.status = 'completed';
    tournament.endTime = new Date();
    tournament.updatedAt = new Date();

    return tournament;
  }

  // -----------------------------------------------------------------------
  // Query Methods
  // -----------------------------------------------------------------------

  /**
   * Get all matches for a tournament.
   */
  getMatches(tournamentId: string): TournamentMatch[] {
    return this.matches.get(tournamentId) ?? [];
  }

  /**
   * Get bracket rounds for a tournament (grouped matches by round).
   */
  getBracketRounds(tournamentId: string): BracketRound[] {
    const tournamentMatches = this.matches.get(tournamentId) ?? [];
    const rounds = [...new Set(tournamentMatches.map((m) => m.round))].sort((a, b) => a - b);

    return rounds.map((roundNumber) => {
      const roundMatches = tournamentMatches.filter((m) => m.round === roundNumber);
      const allCompleted = roundMatches.every((m) => m.status === 'completed');
      const anyInProgress = roundMatches.some(
        (m) => m.status === 'in_progress' || m.status === 'scheduled',
      );

      let status: 'pending' | 'in_progress' | 'completed';
      if (allCompleted) {
        status = 'completed';
      } else if (anyInProgress) {
        status = 'in_progress';
      } else {
        status = 'pending';
      }

      return {
        roundNumber,
        matches: roundMatches,
        status,
      };
    });
  }

  /**
   * List all tournaments, optionally filtered.
   */
  listTournaments(filter?: { status?: TournamentStatus; gameId?: string }): Tournament[] {
    let results = [...this.tournaments.values()];

    if (filter?.status) {
      results = results.filter((t) => t.status === filter.status);
    }
    if (filter?.gameId) {
      results = results.filter((t) => t.gameId === filter.gameId);
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  private getTournamentOrThrow(tournamentId: string): Tournament {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    return tournament;
  }

  private generateBracket(format: TournamentFormat, playerIds: string[]): BracketMatch[] {
    switch (format) {
      case 'single_elimination':
        return generateSingleElimination(playerIds);
      case 'double_elimination':
        return generateDoubleElimination(playerIds);
      case 'round_robin':
        return generateRoundRobin(playerIds);
      case 'swiss':
        return generateSwiss(playerIds, Math.ceil(Math.log2(playerIds.length)));
      default:
        throw new Error(`Unsupported tournament format: ${format}`);
    }
  }

  /**
   * Auto-resolve matches where one player has a bye (empty string opponent).
   */
  private resolveByeMatches(tournamentId: string): void {
    const tournamentMatches = this.matches.get(tournamentId) ?? [];

    for (const match of tournamentMatches) {
      if (match.status !== 'scheduled' && match.status !== 'pending') continue;

      const hasBye1 = !match.player1Id;
      const hasBye2 = !match.player2Id;

      if (hasBye1 && hasBye2) {
        // Both byes - skip
        continue;
      }

      if (hasBye1 || hasBye2) {
        // One player has a bye - auto-advance the real player
        match.winnerId = hasBye1 ? match.player2Id : match.player1Id;
        match.status = 'completed';
        match.endedAt = new Date();
        match.score = { player1: hasBye1 ? 0 : 1, player2: hasBye2 ? 0 : 1 };
      }
    }
  }

  private generateId(prefix: string): string {
    this.idCounter++;
    return `${prefix}-${Date.now()}-${this.idCounter.toString().padStart(4, '0')}`;
  }

  private generateMatchId(): string {
    this.matchIdCounter++;
    return `match-${Date.now()}-${this.matchIdCounter.toString().padStart(4, '0')}`;
  }
}

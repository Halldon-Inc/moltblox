/**
 * Bracket generation for Moltblox tournaments
 * Supports single elimination, double elimination, round robin, and Swiss system
 */

import type { TournamentMatch } from '@moltblox/protocol';

/** A match stub used during bracket generation before full TournamentMatch creation */
export interface BracketMatch {
  round: number;
  matchNumber: number;
  bracket: 'winners' | 'losers' | 'finals';
  player1Id: string;
  player2Id: string;
}

/** Player with an optional rating used for seeding */
export interface SeededPlayer {
  playerId: string;
  rating: number;
}

// ---------------------------------------------------------------------------
// Single Elimination
// ---------------------------------------------------------------------------

/**
 * Generate a single elimination bracket.
 *
 * Players are placed into the first round. If the count is not a power of two,
 * byes (empty string player IDs) are added so the bracket fills evenly.
 *
 * @param playerIds - Array of player IDs (already seeded or random order)
 * @returns Array of BracketMatch objects for every round
 */
export function generateSingleElimination(playerIds: string[]): BracketMatch[] {
  if (playerIds.length < 2) {
    throw new Error('At least 2 players are required for a single elimination bracket');
  }

  // Pad to next power of 2
  const bracketSize = nextPowerOfTwo(playerIds.length);
  const paddedPlayers = [...playerIds];
  while (paddedPlayers.length < bracketSize) {
    paddedPlayers.push(''); // bye
  }

  const totalRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // Round 1 - pair players
  for (let i = 0; i < paddedPlayers.length; i += 2) {
    matchCounter++;
    matches.push({
      round: 1,
      matchNumber: matchCounter,
      bracket: 'winners',
      player1Id: paddedPlayers[i],
      player2Id: paddedPlayers[i + 1],
    });
  }

  // Subsequent rounds - placeholder matches
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let m = 0; m < matchesInRound; m++) {
      matchCounter++;
      matches.push({
        round,
        matchNumber: matchCounter,
        bracket: round === totalRounds ? 'finals' : 'winners',
        player1Id: '', // TBD - filled by advanceBracket
        player2Id: '',
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Double Elimination
// ---------------------------------------------------------------------------

/**
 * Generate a double elimination bracket.
 *
 * Creates a winners bracket, losers bracket, and grand finals.
 * Players who lose once drop to the losers bracket; two losses and they are out.
 *
 * @param playerIds - Array of player IDs
 * @returns Array of BracketMatch objects for the full double-elimination structure
 */
export function generateDoubleElimination(playerIds: string[]): BracketMatch[] {
  if (playerIds.length < 2) {
    throw new Error('At least 2 players are required for a double elimination bracket');
  }

  const bracketSize = nextPowerOfTwo(playerIds.length);
  const paddedPlayers = [...playerIds];
  while (paddedPlayers.length < bracketSize) {
    paddedPlayers.push('');
  }

  const winnersRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // --- Winners Bracket ---

  // Round 1 of winners
  for (let i = 0; i < paddedPlayers.length; i += 2) {
    matchCounter++;
    matches.push({
      round: 1,
      matchNumber: matchCounter,
      bracket: 'winners',
      player1Id: paddedPlayers[i],
      player2Id: paddedPlayers[i + 1],
    });
  }

  // Subsequent winners rounds
  for (let round = 2; round <= winnersRounds; round++) {
    const count = bracketSize / Math.pow(2, round);
    for (let m = 0; m < count; m++) {
      matchCounter++;
      matches.push({
        round,
        matchNumber: matchCounter,
        bracket: 'winners',
        player1Id: '',
        player2Id: '',
      });
    }
  }

  // --- Losers Bracket ---
  // Losers bracket has roughly (2 * winnersRounds - 2) rounds
  const losersRounds = (winnersRounds - 1) * 2;
  let losersMatchesInRound = bracketSize / 4; // starts at half of winners round 1

  for (let round = 1; round <= losersRounds; round++) {
    // Even rounds shrink, odd rounds keep same size (losers from winners drop in)
    if (round > 1 && round % 2 === 1) {
      losersMatchesInRound = Math.max(1, Math.floor(losersMatchesInRound / 2));
    }
    const count = Math.max(1, losersMatchesInRound);
    for (let m = 0; m < count; m++) {
      matchCounter++;
      matches.push({
        round: winnersRounds + round, // offset rounds so they don't collide
        matchNumber: matchCounter,
        bracket: 'losers',
        player1Id: '',
        player2Id: '',
      });
    }
  }

  // --- Grand Finals ---
  // Match between winners bracket champion and losers bracket champion
  matchCounter++;
  matches.push({
    round: winnersRounds + losersRounds + 1,
    matchNumber: matchCounter,
    bracket: 'finals',
    player1Id: '',
    player2Id: '',
  });

  // Possible reset match (if losers bracket champion wins first finals match)
  matchCounter++;
  matches.push({
    round: winnersRounds + losersRounds + 2,
    matchNumber: matchCounter,
    bracket: 'finals',
    player1Id: '',
    player2Id: '',
  });

  return matches;
}

// ---------------------------------------------------------------------------
// Round Robin
// ---------------------------------------------------------------------------

/**
 * Generate a round-robin schedule where every player plays every other player once.
 *
 * Uses the circle method to generate balanced rounds.
 *
 * @param playerIds - Array of player IDs
 * @returns Array of BracketMatch objects
 */
export function generateRoundRobin(playerIds: string[]): BracketMatch[] {
  if (playerIds.length < 2) {
    throw new Error('At least 2 players are required for a round robin tournament');
  }

  const players = [...playerIds];

  // If odd number of players, add a "bye" player
  if (players.length % 2 !== 0) {
    players.push(''); // bye
  }

  const n = players.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // Circle method: fix player[0], rotate the rest
  const fixed = players[0];
  const rotating = players.slice(1);

  for (let round = 0; round < totalRounds; round++) {
    const roundPlayers = [fixed, ...rotating];

    for (let m = 0; m < matchesPerRound; m++) {
      const p1 = roundPlayers[m];
      const p2 = roundPlayers[n - 1 - m];

      // Skip byes
      if (!p1 || !p2) continue;

      matchCounter++;
      matches.push({
        round: round + 1,
        matchNumber: matchCounter,
        bracket: 'winners', // round robin doesn't have bracket distinction
        player1Id: p1,
        player2Id: p2,
      });
    }

    // Rotate: move last element to position 0 of the rotating array
    rotating.unshift(rotating.pop()!);
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Swiss System
// ---------------------------------------------------------------------------

/**
 * Generate Swiss-system pairings for a given round.
 *
 * In Swiss, players with similar records are paired against each other.
 * This function generates pairings for the first round (random or seeded)
 * and can be called again for subsequent rounds with updated standings.
 *
 * @param playerIds - Array of player IDs (ordered by current standing for rounds > 1)
 * @param rounds - Total number of rounds in the Swiss tournament
 * @returns Array of BracketMatch objects for all rounds (round 1 populated, rest are placeholders)
 */
export function generateSwiss(playerIds: string[], rounds: number): BracketMatch[] {
  if (playerIds.length < 2) {
    throw new Error('At least 2 players are required for a Swiss tournament');
  }

  const effectiveRounds = Math.min(rounds, Math.ceil(Math.log2(playerIds.length)));
  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // Round 1: pair adjacent players (assumes seeded order)
  const players = [...playerIds];
  if (players.length % 2 !== 0) {
    players.push(''); // bye
  }

  for (let i = 0; i < players.length; i += 2) {
    if (!players[i] || !players[i + 1]) continue;
    matchCounter++;
    matches.push({
      round: 1,
      matchNumber: matchCounter,
      bracket: 'winners',
      player1Id: players[i],
      player2Id: players[i + 1],
    });
  }

  // Placeholder matches for subsequent rounds
  const matchesPerRound = Math.floor(players.filter(p => p !== '').length / 2);
  for (let round = 2; round <= effectiveRounds; round++) {
    for (let m = 0; m < matchesPerRound; m++) {
      matchCounter++;
      matches.push({
        round,
        matchNumber: matchCounter,
        bracket: 'winners',
        player1Id: '', // TBD - generated when round starts
        player2Id: '',
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed players by rating (highest rating gets best seed position).
 *
 * Standard tournament seeding places the #1 seed against the worst seed,
 * #2 seed against the second-worst, etc.
 *
 * @param playerIds - Array of player IDs
 * @param ratings - Map of playerId to rating (higher is better)
 * @returns Seeded array of player IDs in optimal bracket order
 */
export function seedPlayers(playerIds: string[], ratings: Map<string, number>): string[] {
  // Sort by rating descending
  const sorted = [...playerIds].sort((a, b) => {
    const ratingA = ratings.get(a) ?? 0;
    const ratingB = ratings.get(b) ?? 0;
    return ratingB - ratingA;
  });

  // For a standard bracket, we want to interleave so that 1 vs N, 2 vs N-1, etc.
  const bracketSize = nextPowerOfTwo(sorted.length);
  const seeded: string[] = new Array(bracketSize).fill('');

  // Place seeds using standard bracket positioning
  const positions = getBracketPositions(bracketSize);
  for (let i = 0; i < sorted.length; i++) {
    seeded[positions[i]] = sorted[i];
  }

  return seeded;
}

/**
 * Fisher-Yates shuffle - randomly shuffles an array in place.
 *
 * @param arr - Array to shuffle
 * @returns The same array, shuffled
 */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get the next power of 2 that is >= n
 */
function nextPowerOfTwo(n: number): number {
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
}

/**
 * Generate standard tournament bracket seed positions.
 * Ensures top seeds are spread across the bracket so they meet late.
 *
 * For a bracket of size 8: positions are [0, 7, 4, 3, 2, 5, 6, 1]
 * meaning seed 1 goes to slot 0, seed 2 goes to slot 7, etc.
 */
function getBracketPositions(bracketSize: number): number[] {
  if (bracketSize === 1) return [0];
  if (bracketSize === 2) return [0, 1];

  // Recursively build positions
  const smaller = getBracketPositions(bracketSize / 2);
  const positions: number[] = [];

  for (const pos of smaller) {
    positions.push(pos * 2);
    positions.push(bracketSize - 1 - pos * 2);
  }

  return positions;
}

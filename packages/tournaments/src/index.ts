/**
 * @moltblox/tournaments
 * Tournament service for the Moltblox ecosystem
 */

// Tournament service
export { TournamentService } from './TournamentService.js';
export type { CreateTournamentConfig, StandingEntry } from './TournamentService.js';

// Bracket generation
export {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generateSwiss,
  seedPlayers,
  shuffleArray,
} from './BracketGenerator.js';
export type { BracketMatch, SeededPlayer } from './BracketGenerator.js';

// Prize calculation
export { calculatePrizes, validateDistribution, DEFAULT_DISTRIBUTION } from './PrizeCalculator.js';
export type { PrizeResult } from './PrizeCalculator.js';

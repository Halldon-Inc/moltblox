import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const CATEGORIES = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
] as const;

type Category = (typeof CATEGORIES)[number];

interface YahtzeeState {
  [key: string]: unknown;
  dice: number[];
  rollsLeft: number;
  held: boolean[];
  scorecards: Record<string, Record<string, number | null>>;
  currentPlayer: number;
  turnsRemaining: Record<string, number>;
  winner: string | null;
}

export class YahtzeeGame extends BaseGame {
  readonly name = 'Yahtzee';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): YahtzeeState {
    const scorecards: Record<string, Record<string, number | null>> = {};
    const turnsRemaining: Record<string, number> = {};
    for (const p of playerIds) {
      scorecards[p] = {};
      for (const cat of CATEGORIES) scorecards[p][cat] = null;
      turnsRemaining[p] = 13;
    }

    return {
      dice: [0, 0, 0, 0, 0],
      rollsLeft: 3,
      held: [false, false, false, false, false],
      scorecards,
      currentPlayer: 0,
      turnsRemaining,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<YahtzeeState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'roll') {
      if (data.rollsLeft <= 0) return { success: false, error: 'No rolls remaining, must score' };

      for (let i = 0; i < 5; i++) {
        if (!data.held[i]) data.dice[i] = Math.floor(Math.random() * 6) + 1;
      }
      data.rollsLeft--;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'hold') {
      const indices = action.payload.indices as number[];
      if (!Array.isArray(indices))
        return { success: false, error: 'Must provide dice indices to hold' };
      data.held = [false, false, false, false, false];
      for (const idx of indices) {
        if (idx >= 0 && idx < 5) data.held[idx] = true;
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'score') {
      if (data.rollsLeft === 3)
        return { success: false, error: 'Must roll at least once before scoring' };

      const category = action.payload.category as string;
      if (!CATEGORIES.includes(category as Category))
        return { success: false, error: 'Invalid category' };
      if (data.scorecards[playerId][category] !== null)
        return { success: false, error: 'Category already used' };

      data.scorecards[playerId][category] = this.calculateCategoryScore(
        data.dice,
        category as Category,
      );
      data.turnsRemaining[playerId]--;

      data.currentPlayer = (data.currentPlayer + 1) % players.length;
      let checked = 0;
      while (data.turnsRemaining[players[data.currentPlayer]] <= 0 && checked < players.length) {
        data.currentPlayer = (data.currentPlayer + 1) % players.length;
        checked++;
      }

      data.rollsLeft = 3;
      data.held = [false, false, false, false, false];
      data.dice = [0, 0, 0, 0, 0];

      if (players.every((p) => data.turnsRemaining[p] <= 0)) {
        let bestPlayer: string | null = null;
        let bestScore = -1;
        for (const p of players) {
          const total = this.totalScore(data.scorecards[p]);
          if (total > bestScore) {
            bestScore = total;
            bestPlayer = p;
          }
        }
        data.winner = bestPlayer;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private calculateCategoryScore(dice: number[], category: Category): number {
    const counts = new Array(7).fill(0);
    let sum = 0;
    for (const d of dice) {
      counts[d]++;
      sum += d;
    }

    switch (category) {
      case 'ones':
        return counts[1] * 1;
      case 'twos':
        return counts[2] * 2;
      case 'threes':
        return counts[3] * 3;
      case 'fours':
        return counts[4] * 4;
      case 'fives':
        return counts[5] * 5;
      case 'sixes':
        return counts[6] * 6;
      case 'threeOfAKind':
        return counts.some((c) => c >= 3) ? sum : 0;
      case 'fourOfAKind':
        return counts.some((c) => c >= 4) ? sum : 0;
      case 'fullHouse':
        return counts.includes(3) && counts.includes(2) ? 25 : 0;
      case 'smallStraight':
        return this.hasStraight(counts, 4) ? 30 : 0;
      case 'largeStraight':
        return this.hasStraight(counts, 5) ? 40 : 0;
      case 'yahtzee':
        return counts.some((c) => c === 5) ? 50 : 0;
      case 'chance':
        return sum;
      default:
        return 0;
    }
  }

  private hasStraight(counts: number[], length: number): boolean {
    let run = 0;
    for (let i = 1; i <= 6; i++) {
      if (counts[i] > 0) {
        run++;
        if (run >= length) return true;
      } else run = 0;
    }
    return false;
  }

  private totalScore(scorecard: Record<string, number | null>): number {
    let total = 0;
    let upperTotal = 0;
    const upperCats = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
    for (const [cat, val] of Object.entries(scorecard)) {
      if (val !== null) {
        total += val;
        if (upperCats.includes(cat)) upperTotal += val;
      }
    }
    if (upperTotal >= 63) total += 35;
    return total;
  }

  protected checkGameOver(): boolean {
    return this.getData<YahtzeeState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<YahtzeeState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<YahtzeeState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = this.totalScore(data.scorecards[p]);
    return scores;
  }
}

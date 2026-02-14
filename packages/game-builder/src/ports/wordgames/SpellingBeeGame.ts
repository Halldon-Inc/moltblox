import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const PUZZLES = [
  {
    center: 'A',
    outer: ['P', 'L', 'E', 'N', 'T', 'G'],
    words: [
      'PLANE',
      'PLANT',
      'PLATE',
      'PLEAT',
      'PETAL',
      'AGENT',
      'ANGEL',
      'ANGLE',
      'PLATE',
      'ELEGANT',
    ],
  },
  {
    center: 'O',
    outer: ['R', 'S', 'T', 'N', 'E', 'M'],
    words: [
      'STORE',
      'STORM',
      'MONTE',
      'MENTOR',
      'MONSTER',
      'TONER',
      'STONE',
      'MOROSE',
      'METRO',
      'REMOTE',
    ],
  },
];

interface SpellingBeeState {
  [key: string]: unknown;
  center: string;
  outer: string[];
  validWords: string[];
  found: string[];
  score: number;
  turnsLeft: number;
}

export class SpellingBeeGame extends BaseGame {
  readonly name = 'Spelling Bee';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): SpellingBeeState {
    const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    return {
      center: puzzle.center,
      outer: [...puzzle.outer],
      validWords: [...puzzle.words],
      found: [],
      score: 0,
      turnsLeft: 30,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'submit') return { success: false, error: 'Use submit action' };
    const d = this.getData<SpellingBeeState>();
    const word = ((action.payload.word as string) || '').toUpperCase();
    if (word.length < 4) return { success: false, error: 'Word must be at least 4 letters' };
    if (!word.includes(d.center)) return { success: false, error: 'Must use center letter' };

    const allLetters = new Set([d.center, ...d.outer]);
    for (const ch of word) {
      if (!allLetters.has(ch)) return { success: false, error: `Letter ${ch} not available` };
    }

    if (d.found.includes(word)) return { success: false, error: 'Already found' };
    if (!d.validWords.includes(word)) return { success: false, error: 'Not a valid word' };

    d.found.push(word);
    d.score += word.length === 4 ? 1 : word.length;
    // Pangram bonus
    if (allLetters.size === new Set(word.split('')).size) d.score += 7;
    d.turnsLeft--;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<SpellingBeeState>();
    return d.turnsLeft <= 0 || d.found.length >= d.validWords.length;
  }

  protected determineWinner(): string | null {
    return this.getData<SpellingBeeState>().score > 0 ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<SpellingBeeState>().score };
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const WORDS = [
  'apple',
  'brave',
  'crane',
  'dance',
  'eagle',
  'flame',
  'grape',
  'house',
  'ivory',
  'jolly',
  'knife',
  'lemon',
  'magic',
  'noble',
  'ocean',
  'piano',
  'queen',
  'river',
  'stone',
  'train',
  'ultra',
  'vivid',
  'whale',
  'xenon',
  'yacht',
  'zebra',
  'blaze',
  'charm',
  'drift',
  'elbow',
  'frost',
  'globe',
  'haste',
  'index',
  'joker',
  'knack',
  'lodge',
  'moist',
  'north',
  'orbit',
  'pulse',
  'quest',
  'roast',
  'shelf',
  'twist',
  'unity',
  'valve',
  'width',
];

interface WordleState {
  [key: string]: unknown;
  target: string;
  guesses: string[];
  feedback: string[][];
  maxGuesses: number;
  won: boolean;
}

export class WordleGame extends BaseGame {
  readonly name = 'Wordle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): WordleState {
    return {
      target: WORDS[Math.floor(Math.random() * WORDS.length)],
      guesses: [],
      feedback: [],
      maxGuesses: 6,
      won: false,
    };
  }

  getStateForPlayer(_playerId: string) {
    const state = super.getState();
    const d = state.data as Record<string, unknown>;
    // Hide target word until game is over (prevent cheating)
    if (d && !d.won && (d.guesses as string[]).length < (d.maxGuesses as number)) {
      const { target: _target, ...safeData } = d;
      return { ...state, data: safeData };
    }
    return state;
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'guess') return { success: false, error: 'Use guess action' };
    const d = this.getData<WordleState>();
    const word = ((action.payload.word as string) || '').toLowerCase();
    if (word.length !== 5) return { success: false, error: 'Word must be 5 letters' };
    if (!/^[a-z]+$/.test(word)) return { success: false, error: 'Letters only' };

    const fb: string[] = Array(5).fill('gray');
    const targetChars = d.target.split('');
    const used = Array(5).fill(false);

    // Green pass
    for (let i = 0; i < 5; i++) {
      if (word[i] === targetChars[i]) {
        fb[i] = 'green';
        used[i] = true;
      }
    }
    // Yellow pass
    for (let i = 0; i < 5; i++) {
      if (fb[i] === 'green') continue;
      for (let j = 0; j < 5; j++) {
        if (!used[j] && word[i] === targetChars[j]) {
          fb[i] = 'yellow';
          used[j] = true;
          break;
        }
      }
    }

    d.guesses.push(word);
    d.feedback.push(fb);
    if (word === d.target) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<WordleState>();
    return d.won || d.guesses.length >= d.maxGuesses;
  }

  protected determineWinner(): string | null {
    return this.getData<WordleState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<WordleState>();
    return { [this.getPlayers()[0]]: d.won ? (d.maxGuesses - d.guesses.length + 1) * 100 : 0 };
  }
}

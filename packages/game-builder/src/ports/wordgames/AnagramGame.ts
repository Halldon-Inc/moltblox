import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const WORD_SETS = [
  { letters: 'listen', answers: ['listen', 'silent', 'tinsel', 'inlets', 'enlist'] },
  { letters: 'earth', answers: ['earth', 'heart', 'hater', 'rathe'] },
  { letters: 'master', answers: ['master', 'stream', 'maters'] },
  { letters: 'crate', answers: ['crate', 'trace', 'cater', 'react', 'recta'] },
];

interface AnagramState {
  [key: string]: unknown;
  letters: string;
  validAnswers: string[];
  found: Record<string, string[]>;
  scores: Record<string, number>;
  currentPlayer: number;
  turnsLeft: number;
}

export class AnagramGame extends BaseGame {
  readonly name = 'Anagram';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): AnagramState {
    const set = WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)];
    const shuffled = set.letters
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
    return {
      letters: shuffled,
      validAnswers: set.answers,
      found: Object.fromEntries(playerIds.map((p) => [p, []])),
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      currentPlayer: 0,
      turnsLeft: 20,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    if (action.type !== 'submit') return { success: false, error: 'Use submit action' };
    const d = this.getData<AnagramState>();
    const word = ((action.payload.word as string) || '').toLowerCase();

    // Check if word is valid
    if (!d.validAnswers.includes(word)) return { success: false, error: 'Not a valid word' };
    // Check if already found by anyone
    for (const pid of Object.keys(d.found)) {
      if (d.found[pid].includes(word)) return { success: false, error: 'Already found' };
    }

    d.found[playerId].push(word);
    d.scores[playerId] += word.length * 10;
    d.turnsLeft--;
    d.currentPlayer = (d.currentPlayer + 1) % this.getPlayerCount();

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<AnagramState>();
    if (d.turnsLeft <= 0) return true;
    const allFound = Object.values(d.found).flat();
    return d.validAnswers.every((a) => allFound.includes(a));
  }

  protected determineWinner(): string | null {
    const d = this.getData<AnagramState>();
    let best = '',
      bestScore = -1;
    for (const [p, s] of Object.entries(d.scores)) {
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return bestScore > 0 ? best : null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<AnagramState>().scores };
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const HIDDEN_WORDS = ['CAT', 'DOG', 'FISH', 'BIRD', 'FROG'];

interface WordSearchState {
  [key: string]: unknown;
  grid: string[][];
  words: string[];
  found: string[];
  size: number;
  score: number;
}

export class WordSearchGame extends BaseGame {
  readonly name = 'Word Search';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): WordSearchState {
    const size = 8;
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))),
    );
    // Place words horizontally for simplicity
    for (let i = 0; i < HIDDEN_WORDS.length && i < size; i++) {
      const word = HIDDEN_WORDS[i];
      const col = Math.floor(Math.random() * (size - word.length));
      for (let j = 0; j < word.length; j++) grid[i + 1][col + j] = word[j];
    }
    return { grid, words: [...HIDDEN_WORDS], found: [], size, score: 0 };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'select') return { success: false, error: 'Use select action' };
    const d = this.getData<WordSearchState>();
    const sr = Number(action.payload.startRow),
      sc = Number(action.payload.startCol);
    const er = Number(action.payload.endRow),
      ec = Number(action.payload.endCol);

    // Extract word from selection
    let word = '';
    if (sr === er) {
      // horizontal
      const minC = Math.min(sc, ec),
        maxC = Math.max(sc, ec);
      for (let c = minC; c <= maxC; c++) word += d.grid[sr]?.[c] || '';
    } else if (sc === ec) {
      // vertical
      const minR = Math.min(sr, er),
        maxR = Math.max(sr, er);
      for (let r = minR; r <= maxR; r++) word += d.grid[r]?.[sc] || '';
    } else {
      return { success: false, error: 'Select horizontal or vertical line' };
    }

    if (d.words.includes(word) && !d.found.includes(word)) {
      d.found.push(word);
      d.score += word.length * 20;
    } else {
      return { success: false, error: 'Word not found or already discovered' };
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<WordSearchState>();
    return d.found.length >= d.words.length;
  }

  protected determineWinner(): string | null {
    return this.getData<WordSearchState>().found.length >=
      this.getData<WordSearchState>().words.length
      ? this.getPlayers()[0]
      : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<WordSearchState>().score };
  }
}

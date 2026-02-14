import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const WORDS = [
  'elephant',
  'computer',
  'mountain',
  'building',
  'keyboard',
  'dinosaur',
  'football',
  'painting',
];

interface HangmanState {
  [key: string]: unknown;
  word: string;
  guessed: string[];
  wrong: number;
  maxWrong: number;
  revealed: string;
  won: boolean;
  lost: boolean;
  setter: string | null;
}

export class HangmanGame extends BaseGame {
  readonly name = 'Hangman';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): HangmanState {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    return {
      word,
      guessed: [],
      wrong: 0,
      maxWrong: 7,
      revealed: word.replace(/[a-z]/gi, '_'),
      won: false,
      lost: false,
      setter: playerIds.length > 1 ? playerIds[0] : null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<HangmanState>();
    if (action.type === 'setWord' && d.setter === playerId) {
      const w = ((action.payload.word as string) || '').toLowerCase();
      if (w.length < 3) return { success: false, error: 'Word too short' };
      d.word = w;
      d.revealed = w.replace(/[a-z]/gi, '_');
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'guess') return { success: false, error: 'Use guess action' };
    const letter = ((action.payload.letter as string) || '').toLowerCase();
    if (letter.length !== 1 || !/[a-z]/.test(letter))
      return { success: false, error: 'Single letter required' };
    if (d.guessed.includes(letter)) return { success: false, error: 'Already guessed' };

    d.guessed.push(letter);
    if (d.word.includes(letter)) {
      d.revealed = d.word
        .split('')
        .map((ch) => (d.guessed.includes(ch) ? ch : '_'))
        .join('');
      if (!d.revealed.includes('_')) d.won = true;
    } else {
      d.wrong++;
      if (d.wrong >= d.maxWrong) d.lost = true;
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<HangmanState>();
    return d.won || d.lost;
  }

  protected determineWinner(): string | null {
    const d = this.getData<HangmanState>();
    const players = this.getPlayers();
    if (d.won) return d.setter ? players[1] : players[0];
    return d.setter ? players[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<HangmanState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = 0;
    if (d.won) scores[this.determineWinner()!] = (d.maxWrong - d.wrong) * 10;
    return scores;
  }
}

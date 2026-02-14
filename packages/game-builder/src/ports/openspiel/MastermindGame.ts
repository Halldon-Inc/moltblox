import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MastermindConfig {
  codeLength?: number;
  colorCount?: number;
  numColors?: number;
  maxGuesses?: number;
}

interface MastermindState {
  [key: string]: unknown;
  secret: number[];
  guesses: { code: number[]; exact: number; partial: number }[];
  codeLength: number;
  colorCount: number;
  maxGuesses: number;
  solved: boolean;
  gameOver: boolean;
}

export class MastermindGame extends BaseGame {
  readonly name = 'Mastermind';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MastermindState {
    const codeLength = (this.config as MastermindConfig).codeLength ?? 4;
    const cfg = this.config as MastermindConfig;
    const colorCount = cfg.numColors ?? cfg.colorCount ?? 6;
    const maxGuesses = (this.config as MastermindConfig).maxGuesses ?? 10;

    const secret: number[] = [];
    for (let i = 0; i < codeLength; i++) {
      secret.push(Math.floor(Math.random() * colorCount));
    }

    return {
      secret,
      guesses: [],
      codeLength,
      colorCount,
      maxGuesses,
      solved: false,
      gameOver: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MastermindState>();

    if (data.gameOver) return { success: false, error: 'Game is over' };
    if (action.type !== 'guess') return { success: false, error: `Unknown action: ${action.type}` };

    const code = (action.payload.guess ?? action.payload.code) as number[];
    if (!Array.isArray(code) || code.length !== data.codeLength) {
      return { success: false, error: `Guess must be ${data.codeLength} colors` };
    }
    for (const c of code) {
      if (typeof c !== 'number' || c < 0 || c >= data.colorCount) {
        return { success: false, error: `Each color must be 0 to ${data.colorCount - 1}` };
      }
    }

    const secretCopy = [...data.secret];
    const guessCopy = [...code];
    let exact = 0;
    let partial = 0;

    for (let i = 0; i < data.codeLength; i++) {
      if (guessCopy[i] === secretCopy[i]) {
        exact++;
        secretCopy[i] = -1;
        guessCopy[i] = -2;
      }
    }

    for (let i = 0; i < data.codeLength; i++) {
      if (guessCopy[i] === -2) continue;
      const idx = secretCopy.indexOf(guessCopy[i]);
      if (idx !== -1) {
        partial++;
        secretCopy[idx] = -1;
      }
    }

    data.guesses.push({ code, exact, partial });

    if (exact === data.codeLength) {
      data.solved = true;
      data.gameOver = true;
      this.emitEvent('solved', playerId, { attempts: data.guesses.length });
    } else if (data.guesses.length >= data.maxGuesses) {
      data.gameOver = true;
      this.emitEvent('failed', playerId, { secret: data.secret });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<MastermindState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.getData<MastermindState>().solved ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MastermindState>();
    if (!data.solved) return { [this.getPlayers()[0]]: 0 };
    return { [this.getPlayers()[0]]: Math.max(1000 - (data.guesses.length - 1) * 100, 100) };
  }
}

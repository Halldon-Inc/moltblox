/**
 * GuessGame (Mastermind): Guess color sequence, get black/white peg feedback
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface GuessConfig {
  pegs?: number;
  colors?: number;
  maxGuesses?: number;
}

interface GuessResult {
  guess: number[];
  black: number;
  white: number;
}

interface GuessState {
  [key: string]: unknown;
  pegs: number;
  colors: number;
  maxGuesses: number;
  secret: number[];
  guesses: GuessResult[];
  moves: number;
  gameOver: boolean;
  won: boolean;
}

export class GuessGame extends BaseGame {
  readonly name = 'Guess';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): GuessState {
    const cfg = this.config as GuessConfig;
    const pegs = Math.max(2, Math.min(cfg.pegs ?? 4, 8));
    const colors = Math.max(2, Math.min(cfg.colors ?? 6, 10));
    const maxGuesses = Math.max(4, Math.min(cfg.maxGuesses ?? 10, 20));

    const secret: number[] = [];
    for (let i = 0; i < pegs; i++) {
      secret.push(Math.floor(Math.random() * colors));
    }

    return {
      pegs,
      colors,
      maxGuesses,
      secret,
      guesses: [],
      moves: 0,
      gameOver: false,
      won: false,
    };
  }

  private evaluate(secret: number[], guess: number[]): { black: number; white: number } {
    let black = 0;
    let white = 0;
    const secretRemaining: number[] = [];
    const guessRemaining: number[] = [];

    for (let i = 0; i < secret.length; i++) {
      if (guess[i] === secret[i]) {
        black++;
      } else {
        secretRemaining.push(secret[i]);
        guessRemaining.push(guess[i]);
      }
    }

    for (const g of guessRemaining) {
      const idx = secretRemaining.indexOf(g);
      if (idx !== -1) {
        white++;
        secretRemaining.splice(idx, 1);
      }
    }

    return { black, white };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GuessState>();
    if (data.gameOver) return { success: false, error: 'Game is over' };

    switch (action.type) {
      case 'guess': {
        const guess = action.payload.colors as number[];
        if (!Array.isArray(guess) || guess.length !== data.pegs) {
          return { success: false, error: `Guess must have ${data.pegs} colors` };
        }
        for (const c of guess) {
          if (c < 0 || c >= data.colors) {
            return { success: false, error: `Colors must be 0-${data.colors - 1}` };
          }
        }

        const result = this.evaluate(data.secret, guess);
        data.guesses.push({ guess, ...result });
        data.moves++;

        if (result.black === data.pegs) {
          data.gameOver = true;
          data.won = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        } else if (data.guesses.length >= data.maxGuesses) {
          data.gameOver = true;
          data.won = false;
          this.emitEvent('out_of_guesses', playerId, { secret: data.secret });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<GuessState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.getData<GuessState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GuessState>();
    const playerId = this.getPlayers()[0];
    if (!data.won) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - (data.moves - 1) * 100);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as GuessState;
    if (!data.gameOver) {
      return { ...state, data: { ...data, secret: [] } };
    }
    return state;
  }
}

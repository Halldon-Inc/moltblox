import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface CodewordState {
  [key: string]: unknown;
  grid: (number | null)[][];
  mapping: Record<number, string>;
  playerMapping: Record<number, string | null>;
  size: number;
  won: boolean;
}

export class CodewordGame extends BaseGame {
  readonly name = 'Codeword';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): CodewordState {
    const size = 7;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const mapping: Record<number, string> = {};
    const used = new Set<number>();
    // Assign random letters to numbers 1-26
    const shuffled = letters.split('').sort(() => Math.random() - 0.5);
    for (let i = 0; i < 26; i++) mapping[i + 1] = shuffled[i];

    // Simple grid with some numbers
    const grid: (number | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    // Fill a pattern
    const words = ['HELLO', 'WORLD'];
    for (let c = 0; c < 5; c++) {
      const num1 = letters.indexOf(words[0][c]) + 1;
      const num2 = letters.indexOf(words[1][c]) + 1;
      grid[1][c + 1] = num1;
      grid[3][c + 1] = num2;
    }

    return {
      grid,
      mapping,
      playerMapping: {},
      size,
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'assign') return { success: false, error: 'Use assign action' };
    const d = this.getData<CodewordState>();
    const num = Number(action.payload.number);
    const letter = ((action.payload.letter as string) || '').toUpperCase();
    if (num < 1 || num > 26) return { success: false, error: 'Number must be 1 to 26' };
    if (letter.length !== 1 || !/[A-Z]/.test(letter))
      return { success: false, error: 'Single letter required' };

    d.playerMapping[num] = letter;

    // Check if all assigned correctly
    let allCorrect = true;
    const numbersInGrid = new Set<number>();
    for (const row of d.grid) for (const cell of row) if (cell !== null) numbersInGrid.add(cell);
    for (const n of numbersInGrid) {
      if (d.playerMapping[n] !== d.mapping[n]) {
        allCorrect = false;
        break;
      }
    }
    if (allCorrect && numbersInGrid.size > 0) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<CodewordState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<CodewordState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<CodewordState>().won ? 100 : 0 };
  }
}

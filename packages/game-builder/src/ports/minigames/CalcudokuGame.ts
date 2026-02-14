import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface CalcudokuState {
  [key: string]: unknown;
  size: number;
  grid: (number | null)[][];
  solution: number[][];
  cages: { cells: number[][]; operation: string; target: number }[];
  won: boolean;
}

export class CalcudokuGame extends BaseGame {
  readonly name = 'Calcudoku';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): CalcudokuState {
    const size = 4;
    const solution = [
      [4, 3, 1, 2],
      [1, 2, 4, 3],
      [2, 1, 3, 4],
      [3, 4, 2, 1],
    ];
    const cages = [
      {
        cells: [
          [0, 0],
          [1, 0],
        ],
        operation: '*',
        target: 4,
      },
      {
        cells: [
          [0, 1],
          [0, 2],
        ],
        operation: '/',
        target: 3,
      },
      {
        cells: [
          [0, 3],
          [1, 3],
        ],
        operation: '+',
        target: 5,
      },
      {
        cells: [
          [1, 1],
          [1, 2],
        ],
        operation: '-',
        target: 2,
      },
      {
        cells: [
          [2, 0],
          [2, 1],
        ],
        operation: '+',
        target: 3,
      },
      {
        cells: [
          [2, 2],
          [3, 2],
        ],
        operation: '+',
        target: 5,
      },
      {
        cells: [
          [2, 3],
          [3, 3],
        ],
        operation: '+',
        target: 5,
      },
      {
        cells: [
          [3, 0],
          [3, 1],
        ],
        operation: '*',
        target: 12,
      },
    ];
    return {
      size,
      solution,
      cages,
      grid: Array.from({ length: size }, () => Array(size).fill(null)),
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'place') return { success: false, error: 'Use place action' };
    const d = this.getData<CalcudokuState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    const num = Number(action.payload.number);
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };
    if (num < 1 || num > d.size) return { success: false, error: `Number 1 to ${d.size}` };

    d.grid[row][col] = num;

    let filled = true,
      correct = true;
    for (let r = 0; r < d.size; r++)
      for (let c = 0; c < d.size; c++) {
        if (d.grid[r][c] === null) filled = false;
        else if (d.grid[r][c] !== d.solution[r][c]) correct = false;
      }
    if (filled && correct) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<CalcudokuState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<CalcudokuState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<CalcudokuState>().won ? 100 : 0 };
  }
}

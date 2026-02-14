import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Cage {
  cells: number[][];
  operation: string;
  target: number;
}

interface KenKenState {
  [key: string]: unknown;
  size: number;
  grid: (number | null)[][];
  solution: number[][];
  cages: Cage[];
  won: boolean;
}

export class KenKenGame extends BaseGame {
  readonly name = 'KenKen';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): KenKenState {
    const size = 4;
    const solution = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [4, 3, 2, 1],
      [2, 1, 4, 3],
    ];
    const cages: Cage[] = [
      {
        cells: [
          [0, 0],
          [0, 1],
        ],
        operation: '+',
        target: 3,
      },
      {
        cells: [
          [0, 2],
          [0, 3],
        ],
        operation: '*',
        target: 12,
      },
      {
        cells: [
          [1, 0],
          [2, 0],
        ],
        operation: '+',
        target: 7,
      },
      {
        cells: [
          [1, 1],
          [1, 2],
        ],
        operation: '-',
        target: 3,
      },
      {
        cells: [
          [1, 3],
          [2, 3],
        ],
        operation: '+',
        target: 3,
      },
      {
        cells: [
          [2, 1],
          [2, 2],
        ],
        operation: '+',
        target: 5,
      },
      {
        cells: [
          [3, 0],
          [3, 1],
        ],
        operation: '+',
        target: 3,
      },
      {
        cells: [
          [3, 2],
          [3, 3],
        ],
        operation: '+',
        target: 7,
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
    const d = this.getData<KenKenState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    const num = Number(action.payload.number);
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };
    if (num < 1 || num > d.size) return { success: false, error: `Number must be 1 to ${d.size}` };

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
    return this.getData<KenKenState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<KenKenState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<KenKenState>().won ? 100 : 0 };
  }
}

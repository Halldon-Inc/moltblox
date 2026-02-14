import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Constraint {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
} // r1,c1 < r2,c2

interface FutoshikiState {
  [key: string]: unknown;
  size: number;
  grid: (number | null)[][];
  solution: number[][];
  constraints: Constraint[];
  won: boolean;
}

export class FutoshikiGame extends BaseGame {
  readonly name = 'Futoshiki';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): FutoshikiState {
    const size = 4;
    const solution = [
      [2, 1, 4, 3],
      [4, 3, 2, 1],
      [1, 4, 3, 2],
      [3, 2, 1, 4],
    ];
    const constraints: Constraint[] = [
      { r1: 0, c1: 0, r2: 0, c2: 1 }, // 2 > 1
      { r1: 1, c1: 2, r2: 1, c2: 3 }, // 2 > 1
    ];
    return {
      size,
      solution,
      constraints,
      grid: Array.from({ length: size }, () => Array(size).fill(null)),
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'place') return { success: false, error: 'Use place action' };
    const d = this.getData<FutoshikiState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    const num = Number(action.payload.number);
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };
    if (num < 1 || num > d.size) return { success: false, error: `Number must be 1 to ${d.size}` };

    d.grid[row][col] = num;

    // Check complete and correct
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
    return this.getData<FutoshikiState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<FutoshikiState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<FutoshikiState>().won ? 100 : 0 };
  }
}

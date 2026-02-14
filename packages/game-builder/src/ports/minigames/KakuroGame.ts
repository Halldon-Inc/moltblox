import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface KakuroState {
  [key: string]: unknown;
  size: number;
  grid: (number | null)[][];
  solution: (number | null)[][];
  clues: { row: number; col: number; direction: string; sum: number }[];
  won: boolean;
}

export class KakuroGame extends BaseGame {
  readonly name = 'Kakuro';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): KakuroState {
    const size = 5;
    // Simple pre-built puzzle
    const solution: (number | null)[][] = [
      [null, null, null, null, null],
      [null, 1, 3, null, null],
      [null, 2, 4, 1, null],
      [null, null, 2, 3, null],
      [null, null, null, null, null],
    ];
    const clues = [
      { row: 1, col: 1, direction: 'across', sum: 4 },
      { row: 2, col: 1, direction: 'across', sum: 7 },
      { row: 3, col: 2, direction: 'across', sum: 5 },
      { row: 1, col: 1, direction: 'down', sum: 3 },
      { row: 1, col: 2, direction: 'down', sum: 9 },
      { row: 2, col: 3, direction: 'down', sum: 4 },
    ];
    return {
      size,
      solution,
      clues,
      grid: Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => (solution[r][c] !== null ? null : null)),
      ),
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'place') return { success: false, error: 'Use place action' };
    const d = this.getData<KakuroState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    const num = Number(action.payload.number);
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };
    if (d.solution[row][col] === null) return { success: false, error: 'Not a playable cell' };
    if (num < 1 || num > 9) return { success: false, error: 'Number must be 1 to 9' };

    d.grid[row][col] = num;

    // Check if all filled correctly
    let correct = true;
    for (let r = 0; r < d.size; r++)
      for (let c = 0; c < d.size; c++) {
        if (d.solution[r][c] !== null && d.grid[r][c] !== d.solution[r][c]) correct = false;
      }
    if (correct) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<KakuroState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<KakuroState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<KakuroState>().won ? 100 : 0 };
  }
}

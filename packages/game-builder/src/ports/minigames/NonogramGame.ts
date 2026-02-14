import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface NonogramState {
  [key: string]: unknown;
  size: number;
  solution: boolean[][];
  grid: (boolean | null)[][];
  rowClues: number[][];
  colClues: number[][];
  won: boolean;
}

export class NonogramGame extends BaseGame {
  readonly name = 'Nonogram';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private getClues(line: boolean[]): number[] {
    const clues: number[] = [];
    let count = 0;
    for (const v of line) {
      if (v) count++;
      else if (count > 0) {
        clues.push(count);
        count = 0;
      }
    }
    if (count > 0) clues.push(count);
    return clues.length > 0 ? clues : [0];
  }

  protected initializeState(): NonogramState {
    const size = 5;
    const solution = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.random() > 0.5),
    );
    const rowClues = solution.map((row) => this.getClues(row));
    const colClues = Array.from({ length: size }, (_, c) =>
      this.getClues(solution.map((row) => row[c])),
    );
    return {
      size,
      solution,
      grid: Array.from({ length: size }, () => Array(size).fill(null)),
      rowClues,
      colClues,
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<NonogramState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };

    if (action.type === 'fill') {
      d.grid[row][col] = true;
    } else if (action.type === 'mark') {
      d.grid[row][col] = false;
    } else {
      return { success: false, error: 'Use fill or mark action' };
    }

    // Check win
    let correct = true;
    for (let r = 0; r < d.size; r++)
      for (let c = 0; c < d.size; c++) {
        const filled = d.grid[r][c] === true;
        if (filled !== d.solution[r][c]) correct = false;
      }
    if (correct) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<NonogramState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<NonogramState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<NonogramState>().won ? 100 : 0 };
  }
}

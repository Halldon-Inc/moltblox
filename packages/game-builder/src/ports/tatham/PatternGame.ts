/**
 * PatternGame (Picross/Nonogram): Fill cells matching row/col number sequences
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PatternConfig {
  size?: number;
}

interface PatternState {
  [key: string]: unknown;
  size: number;
  solution: boolean[];
  cells: (boolean | null)[];
  rowClues: number[][];
  colClues: number[][];
  moves: number;
  solved: boolean;
}

export class PatternGame extends BaseGame {
  readonly name = 'Pattern';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private computeClues(line: boolean[]): number[] {
    const clues: number[] = [];
    let run = 0;
    for (const cell of line) {
      if (cell) {
        run++;
      } else {
        if (run > 0) clues.push(run);
        run = 0;
      }
    }
    if (run > 0) clues.push(run);
    return clues.length > 0 ? clues : [0];
  }

  protected initializeState(_playerIds: string[]): PatternState {
    const cfg = this.config as PatternConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 10, 20));
    const total = size * size;

    const solution: boolean[] = [];
    for (let i = 0; i < total; i++) {
      solution.push(Math.random() < 0.5);
    }

    const rowClues: number[][] = [];
    for (let r = 0; r < size; r++) {
      const row = solution.slice(r * size, (r + 1) * size);
      rowClues.push(this.computeClues(row));
    }

    const colClues: number[][] = [];
    for (let c = 0; c < size; c++) {
      const col: boolean[] = [];
      for (let r = 0; r < size; r++) col.push(solution[r * size + c]);
      colClues.push(this.computeClues(col));
    }

    return {
      size,
      solution,
      cells: new Array(total).fill(null),
      rowClues,
      colClues,
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PatternState>();

    switch (action.type) {
      case 'fill': {
        const index = Number(action.payload.index);
        const filled = action.payload.filled as boolean | null;
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }

        data.cells[index] = filled;
        data.moves++;

        let allSet = true;
        let allCorrect = true;
        for (let i = 0; i < data.cells.length; i++) {
          if (data.cells[i] === null) {
            allSet = false;
            break;
          }
          if ((data.cells[i] === true) !== data.solution[i]) allCorrect = false;
        }

        if (allSet && allCorrect) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<PatternState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PatternState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 3);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as PatternState;
    return {
      ...state,
      data: { ...data, solution: [] },
    };
  }
}

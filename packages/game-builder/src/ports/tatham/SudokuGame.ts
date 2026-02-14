/**
 * SudokuGame (Solo): 9x9 grid, fill 1-9 in rows/cols/boxes
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SudokuConfig {
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface SudokuState {
  [key: string]: unknown;
  grid: number[];
  solution: number[];
  fixed: boolean[];
  moves: number;
  size: number;
  errors: number;
}

export class SudokuGame extends BaseGame {
  readonly name = 'Sudoku';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private generateSolution(): number[] {
    const grid = new Array(81).fill(0);

    const isValid = (g: number[], pos: number, num: number): boolean => {
      const row = Math.floor(pos / 9);
      const col = pos % 9;
      for (let c = 0; c < 9; c++) {
        if (g[row * 9 + c] === num) return false;
      }
      for (let r = 0; r < 9; r++) {
        if (g[r * 9 + col] === num) return false;
      }
      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;
      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          if (g[r * 9 + c] === num) return false;
        }
      }
      return true;
    };

    const solve = (g: number[], pos: number): boolean => {
      if (pos === 81) return true;
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      for (const num of nums) {
        if (isValid(g, pos, num)) {
          g[pos] = num;
          if (solve(g, pos + 1)) return true;
          g[pos] = 0;
        }
      }
      return false;
    };

    solve(grid, 0);
    return grid;
  }

  protected initializeState(_playerIds: string[]): SudokuState {
    const cfg = this.config as SudokuConfig;
    const difficulty = cfg.difficulty ?? 'medium';
    const solution = this.generateSolution();
    const grid = [...solution];
    const fixed = new Array(81).fill(true);

    const removals = difficulty === 'easy' ? 35 : difficulty === 'medium' ? 45 : 55;
    const indices = Array.from({ length: 81 }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < removals; i++) {
      grid[indices[i]] = 0;
      fixed[indices[i]] = false;
    }

    return {
      grid,
      solution,
      fixed,
      moves: 0,
      size: 9,
      errors: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SudokuState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = Number(action.payload.value);

        if (index < 0 || index >= 81) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.fixed[index]) {
          return { success: false, error: 'Cannot modify fixed cell' };
        }
        if (value < 0 || value > 9) {
          return { success: false, error: 'Value must be 0-9 (0 to clear)' };
        }

        data.grid[index] = value;
        data.moves++;

        if (value !== 0 && value !== data.solution[index]) {
          data.errors++;
          this.emitEvent('wrong_placement', playerId, { index, value });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<SudokuState>();
    for (let i = 0; i < 81; i++) {
      if (data.grid[i] !== data.solution[i]) return false;
    }
    return true;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SudokuState>();
    const playerId = this.getPlayers()[0];
    const score = Math.max(0, 1000 - data.errors * 50 - data.moves * 2);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as SudokuState;
    return {
      ...state,
      data: { ...data, solution: [] },
    };
  }
}

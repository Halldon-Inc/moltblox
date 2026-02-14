/**
 * UnequalGame (Futoshiki): Fill grid with 1-N, satisfy inequality signs between cells
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface UnequalConfig {
  size?: number;
}

interface Inequality {
  cell1: number;
  cell2: number;
}

interface UnequalState {
  [key: string]: unknown;
  size: number;
  grid: number[];
  fixed: boolean[];
  inequalities: Inequality[];
  moves: number;
  solved: boolean;
}

export class UnequalGame extends BaseGame {
  readonly name = 'Unequal';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private generateLatinSquare(size: number): number[] {
    const grid = new Array(size * size).fill(0);
    const solve = (pos: number): boolean => {
      if (pos === size * size) return true;
      const row = Math.floor(pos / size);
      const col = pos % size;
      const nums = Array.from({ length: size }, (_, i) => i + 1);
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      for (const num of nums) {
        let valid = true;
        for (let c = 0; c < col; c++)
          if (grid[row * size + c] === num) {
            valid = false;
            break;
          }
        if (!valid) continue;
        for (let r = 0; r < row; r++)
          if (grid[r * size + col] === num) {
            valid = false;
            break;
          }
        if (!valid) continue;
        grid[pos] = num;
        if (solve(pos + 1)) return true;
        grid[pos] = 0;
      }
      return false;
    };
    solve(0);
    return grid;
  }

  protected initializeState(_playerIds: string[]): UnequalState {
    const cfg = this.config as UnequalConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 5, 8));
    const solution = this.generateLatinSquare(size);

    const inequalities: Inequality[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 1; c++) {
        if (Math.random() < 0.5) {
          const cell1 = r * size + c;
          const cell2 = r * size + c + 1;
          if (solution[cell1] < solution[cell2]) {
            inequalities.push({ cell1, cell2 });
          } else {
            inequalities.push({ cell1: cell2, cell2: cell1 });
          }
        }
      }
    }

    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size; c++) {
        if (Math.random() < 0.5) {
          const cell1 = r * size + c;
          const cell2 = (r + 1) * size + c;
          if (solution[cell1] < solution[cell2]) {
            inequalities.push({ cell1, cell2 });
          } else {
            inequalities.push({ cell1: cell2, cell2: cell1 });
          }
        }
      }
    }

    const grid = new Array(size * size).fill(0);
    const fixed = new Array(size * size).fill(false);
    const givens = Math.floor(size * size * 0.2);
    const indices = Array.from({ length: size * size }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < givens; i++) {
      grid[indices[i]] = solution[indices[i]];
      fixed[indices[i]] = true;
    }

    return {
      size,
      grid,
      fixed,
      inequalities,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: UnequalState): boolean {
    const { size, grid, inequalities } = data;

    for (let i = 0; i < size * size; i++) {
      if (grid[i] === 0) return false;
    }

    for (let r = 0; r < size; r++) {
      const seen = new Set<number>();
      for (let c = 0; c < size; c++) {
        if (seen.has(grid[r * size + c])) return false;
        seen.add(grid[r * size + c]);
      }
    }
    for (let c = 0; c < size; c++) {
      const seen = new Set<number>();
      for (let r = 0; r < size; r++) {
        if (seen.has(grid[r * size + c])) return false;
        seen.add(grid[r * size + c]);
      }
    }

    for (const ineq of inequalities) {
      if (grid[ineq.cell1] >= grid[ineq.cell2]) return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<UnequalState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = Number(action.payload.value);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.fixed[index]) {
          return { success: false, error: 'Cannot modify fixed cell' };
        }
        if (value < 0 || value > data.size) {
          return { success: false, error: `Value must be 0-${data.size}` };
        }

        data.grid[index] = value;
        data.moves++;

        if (this.checkSolved(data)) {
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
    return this.getData<UnequalState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<UnequalState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }
}

/**
 * KeenGame (KenKen): Fill grid like sudoku with cage arithmetic constraints
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface KeenConfig {
  size?: number;
}

interface Cage {
  cells: number[];
  target: number;
  op: '+' | '-' | '*' | '/';
}

interface KeenState {
  [key: string]: unknown;
  size: number;
  grid: number[];
  cages: Cage[];
  moves: number;
  solved: boolean;
}

export class KeenGame extends BaseGame {
  readonly name = 'KenKen';
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
        for (let c = 0; c < col; c++) {
          if (grid[row * size + c] === num) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;
        for (let r = 0; r < row; r++) {
          if (grid[r * size + col] === num) {
            valid = false;
            break;
          }
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

  protected initializeState(_playerIds: string[]): KeenState {
    const cfg = this.config as KeenConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 5, 9));
    const total = size * size;
    const solution = this.generateLatinSquare(size);

    const cages: Cage[] = [];
    const assigned = new Set<number>();
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (const start of indices) {
      if (assigned.has(start)) continue;
      const cageSize = Math.min(Math.floor(Math.random() * 3) + 1, 3);
      const cells = [start];
      assigned.add(start);

      while (cells.length < cageSize) {
        const cell = cells[Math.floor(Math.random() * cells.length)];
        const row = Math.floor(cell / size);
        const col = cell % size;
        const neighbors: number[] = [];
        if (row > 0 && !assigned.has((row - 1) * size + col))
          neighbors.push((row - 1) * size + col);
        if (row < size - 1 && !assigned.has((row + 1) * size + col))
          neighbors.push((row + 1) * size + col);
        if (col > 0 && !assigned.has(row * size + col - 1)) neighbors.push(row * size + col - 1);
        if (col < size - 1 && !assigned.has(row * size + col + 1))
          neighbors.push(row * size + col + 1);
        if (neighbors.length === 0) break;
        const n = neighbors[Math.floor(Math.random() * neighbors.length)];
        cells.push(n);
        assigned.add(n);
      }

      const values = cells.map((c) => solution[c]);

      if (cells.length === 1) {
        cages.push({ cells, target: values[0], op: '+' });
        continue;
      }

      const ops: ('+' | '-' | '*' | '/')[] = ['+', '*'];
      if (cells.length === 2) {
        ops.push('-', '/');
      }
      const op = ops[Math.floor(Math.random() * ops.length)];

      let target: number;
      if (op === '+') {
        target = values.reduce((a, b) => a + b, 0);
      } else if (op === '*') {
        target = values.reduce((a, b) => a * b, 1);
      } else if (op === '-') {
        target = Math.abs(values[0] - values[1]);
      } else {
        const [a, b] = values[0] > values[1] ? [values[0], values[1]] : [values[1], values[0]];
        if (b !== 0 && a % b === 0) {
          target = a / b;
        } else {
          target = values[0] + values[1];
          cages.push({ cells, target, op: '+' });
          continue;
        }
      }

      cages.push({ cells, target, op });
    }

    return {
      size,
      grid: new Array(total).fill(0),
      cages,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: KeenState): boolean {
    const { size, grid, cages } = data;

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

    for (const cage of cages) {
      const values = cage.cells.map((c) => grid[c]);
      let result: number;

      if (cage.op === '+') {
        result = values.reduce((a, b) => a + b, 0);
      } else if (cage.op === '*') {
        result = values.reduce((a, b) => a * b, 1);
      } else if (cage.op === '-') {
        result = Math.abs(values[0] - values[1]);
      } else {
        const [a, b] = values[0] > values[1] ? [values[0], values[1]] : [values[1], values[0]];
        result = b !== 0 ? a / b : -1;
      }

      if (result !== cage.target) return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<KeenState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = Number(action.payload.value);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
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
    return this.getData<KeenState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<KeenState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }
}

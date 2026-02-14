/**
 * TowersGame (Skyscrapers): Fill grid like sudoku.
 * Edge clue numbers = visible towers from that direction.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TowersConfig {
  size?: number;
}

interface TowersState {
  [key: string]: unknown;
  size: number;
  grid: number[];
  topClues: (number | null)[];
  bottomClues: (number | null)[];
  leftClues: (number | null)[];
  rightClues: (number | null)[];
  fixed: boolean[];
  moves: number;
  solved: boolean;
}

export class TowersGame extends BaseGame {
  readonly name = 'Towers';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private visibleTowers(heights: number[]): number {
    let count = 0;
    let maxH = 0;
    for (const h of heights) {
      if (h > maxH) {
        count++;
        maxH = h;
      }
    }
    return count;
  }

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

  protected initializeState(_playerIds: string[]): TowersState {
    const cfg = this.config as TowersConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 5, 8));
    const solution = this.generateLatinSquare(size);

    const topClues: (number | null)[] = [];
    const bottomClues: (number | null)[] = [];
    const leftClues: (number | null)[] = [];
    const rightClues: (number | null)[] = [];

    for (let c = 0; c < size; c++) {
      const col: number[] = [];
      for (let r = 0; r < size; r++) col.push(solution[r * size + c]);
      topClues.push(Math.random() < 0.5 ? this.visibleTowers(col) : null);
      bottomClues.push(Math.random() < 0.5 ? this.visibleTowers([...col].reverse()) : null);
    }

    for (let r = 0; r < size; r++) {
      const row = solution.slice(r * size, (r + 1) * size);
      leftClues.push(Math.random() < 0.5 ? this.visibleTowers(row) : null);
      rightClues.push(Math.random() < 0.5 ? this.visibleTowers([...row].reverse()) : null);
    }

    const grid = new Array(size * size).fill(0);
    const fixed = new Array(size * size).fill(false);
    const givens = Math.floor(size * size * 0.25);
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
      topClues,
      bottomClues,
      leftClues,
      rightClues,
      fixed,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: TowersState): boolean {
    const { size, grid, topClues, bottomClues, leftClues, rightClues } = data;

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

    for (let c = 0; c < size; c++) {
      const col: number[] = [];
      for (let r = 0; r < size; r++) col.push(grid[r * size + c]);
      if (topClues[c] !== null && this.visibleTowers(col) !== topClues[c]) return false;
      if (bottomClues[c] !== null && this.visibleTowers([...col].reverse()) !== bottomClues[c])
        return false;
    }
    for (let r = 0; r < size; r++) {
      const row = grid.slice(r * size, (r + 1) * size);
      if (leftClues[r] !== null && this.visibleTowers(row) !== leftClues[r]) return false;
      if (rightClues[r] !== null && this.visibleTowers([...row].reverse()) !== rightClues[r])
        return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TowersState>();

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
    return this.getData<TowersState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TowersState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }
}

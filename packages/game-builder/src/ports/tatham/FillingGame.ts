/**
 * FillingGame: Fill empty cells so each connected region of same number has that many cells
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface FillingConfig {
  width?: number;
  height?: number;
}

interface FillingState {
  [key: string]: unknown;
  width: number;
  height: number;
  grid: number[];
  fixed: boolean[];
  moves: number;
  solved: boolean;
}

export class FillingGame extends BaseGame {
  readonly name = 'Filling';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private getConnectedRegion(
    grid: number[],
    width: number,
    height: number,
    start: number,
  ): number[] {
    const val = grid[start];
    if (val === 0) return [];
    const visited = new Set<number>();
    const stack = [start];
    const region: number[] = [];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx)) continue;
      if (grid[idx] !== val) continue;
      visited.add(idx);
      region.push(idx);

      const row = Math.floor(idx / width);
      const col = idx % width;
      if (row > 0) stack.push((row - 1) * width + col);
      if (row < height - 1) stack.push((row + 1) * width + col);
      if (col > 0) stack.push(row * width + col - 1);
      if (col < width - 1) stack.push(row * width + col + 1);
    }

    return region;
  }

  protected initializeState(_playerIds: string[]): FillingState {
    const cfg = this.config as FillingConfig;
    const width = Math.max(4, Math.min(cfg.width ?? 6, 10));
    const height = Math.max(4, Math.min(cfg.height ?? 6, 10));
    const total = width * height;

    const grid = new Array(total).fill(0);
    const assigned = new Set<number>();

    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (const start of indices) {
      if (assigned.has(start)) continue;
      const regionSize = Math.min(Math.floor(Math.random() * 4) + 1, total - assigned.size);

      const region = [start];
      assigned.add(start);

      while (region.length < regionSize) {
        const cell = region[Math.floor(Math.random() * region.length)];
        const row = Math.floor(cell / width);
        const col = cell % width;
        const neighbors: number[] = [];
        if (row > 0 && !assigned.has((row - 1) * width + col))
          neighbors.push((row - 1) * width + col);
        if (row < height - 1 && !assigned.has((row + 1) * width + col))
          neighbors.push((row + 1) * width + col);
        if (col > 0 && !assigned.has(row * width + col - 1)) neighbors.push(row * width + col - 1);
        if (col < width - 1 && !assigned.has(row * width + col + 1))
          neighbors.push(row * width + col + 1);

        if (neighbors.length === 0) break;
        const n = neighbors[Math.floor(Math.random() * neighbors.length)];
        region.push(n);
        assigned.add(n);
      }

      for (const cell of region) {
        grid[cell] = region.length;
      }
    }

    const solution = [...grid];
    const fixed = new Array(total).fill(false);

    for (let i = 0; i < total; i++) {
      if (Math.random() < 0.4) {
        fixed[i] = true;
      } else {
        grid[i] = 0;
      }
    }

    return {
      width,
      height,
      grid,
      fixed,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: FillingState): boolean {
    const { width, height, grid } = data;
    const total = width * height;

    for (let i = 0; i < total; i++) {
      if (grid[i] === 0) return false;
    }

    const checked = new Set<number>();
    for (let i = 0; i < total; i++) {
      if (checked.has(i)) continue;
      const region = this.getConnectedRegion(grid, width, height, i);
      if (region.length !== grid[i]) return false;
      for (const cell of region) checked.add(cell);
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FillingState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = Number(action.payload.value);
        if (index < 0 || index >= data.width * data.height) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.fixed[index]) {
          return { success: false, error: 'Cannot modify fixed cell' };
        }
        if (value < 0 || value > 9) {
          return { success: false, error: 'Value must be 0-9' };
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
    return this.getData<FillingState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FillingState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 8);
    return { [playerId]: score };
  }
}

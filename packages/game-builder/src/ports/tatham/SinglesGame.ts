/**
 * SinglesGame (Hitori): Shade duplicate numbers in rows/cols. Unshaded cells connected.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SinglesConfig {
  size?: number;
}

interface SinglesState {
  [key: string]: unknown;
  size: number;
  grid: number[];
  shaded: boolean[];
  moves: number;
  solved: boolean;
}

export class SinglesGame extends BaseGame {
  readonly name = 'Singles';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SinglesState {
    const cfg = this.config as SinglesConfig;
    const size = Math.max(4, Math.min(cfg.size ?? 6, 10));
    const total = size * size;

    const base: number[][] = [];
    for (let r = 0; r < size; r++) {
      const row: number[] = [];
      const nums = Array.from({ length: size }, (_, i) => i + 1);
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      for (let c = 0; c < size; c++) {
        row.push(nums[c]);
      }
      base.push(row);
    }

    const grid: number[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        grid.push(base[r][c]);
      }
    }

    const numDuplicates = Math.floor(total * 0.2);
    for (let d = 0; d < numDuplicates; d++) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const otherC = Math.floor(Math.random() * size);
      if (c !== otherC) {
        grid[r * size + c] = grid[r * size + otherC];
      }
    }

    return {
      size,
      grid,
      shaded: new Array(total).fill(false),
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: SinglesState): boolean {
    const { size, grid, shaded } = data;
    const total = size * size;

    for (let i = 0; i < total; i++) {
      if (shaded[i]) {
        const row = Math.floor(i / size);
        const col = i % size;
        if (row > 0 && shaded[(row - 1) * size + col]) return false;
        if (row < size - 1 && shaded[(row + 1) * size + col]) return false;
        if (col > 0 && shaded[row * size + col - 1]) return false;
        if (col < size - 1 && shaded[row * size + col + 1]) return false;
      }
    }

    for (let r = 0; r < size; r++) {
      const seen = new Set<number>();
      for (let c = 0; c < size; c++) {
        if (shaded[r * size + c]) continue;
        if (seen.has(grid[r * size + c])) return false;
        seen.add(grid[r * size + c]);
      }
    }
    for (let c = 0; c < size; c++) {
      const seen = new Set<number>();
      for (let r = 0; r < size; r++) {
        if (shaded[r * size + c]) continue;
        if (seen.has(grid[r * size + c])) return false;
        seen.add(grid[r * size + c]);
      }
    }

    let firstUnshaded = -1;
    for (let i = 0; i < total; i++) {
      if (!shaded[i]) {
        firstUnshaded = i;
        break;
      }
    }
    if (firstUnshaded === -1) return false;

    const visited = new Set<number>();
    const stack = [firstUnshaded];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx) || shaded[idx]) continue;
      visited.add(idx);
      const row = Math.floor(idx / size);
      const col = idx % size;
      if (row > 0) stack.push((row - 1) * size + col);
      if (row < size - 1) stack.push((row + 1) * size + col);
      if (col > 0) stack.push(row * size + col - 1);
      if (col < size - 1) stack.push(row * size + col + 1);
    }

    const totalUnshaded = total - shaded.filter(Boolean).length;
    return visited.size === totalUnshaded;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SinglesState>();

    switch (action.type) {
      case 'toggle': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }

        data.shaded[index] = !data.shaded[index];
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
    return this.getData<SinglesState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SinglesState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

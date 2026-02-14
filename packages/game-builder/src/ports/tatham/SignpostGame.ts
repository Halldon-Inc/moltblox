/**
 * SignpostGame (Hidato): Fill grid 1-N following arrow directions
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SignpostConfig {
  size?: number;
}

interface SignpostState {
  [key: string]: unknown;
  size: number;
  grid: number[];
  arrows: number[];
  fixed: boolean[];
  moves: number;
  solved: boolean;
}

const DIR_OFFSETS: [number, number][] = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];

export class SignpostGame extends BaseGame {
  readonly name = 'Signpost';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SignpostState {
    const cfg = this.config as SignpostConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 4, 7));
    const total = size * size;

    const path: number[] = [];
    const visited = new Set<number>();
    const start = Math.floor(Math.random() * total);
    let current = start;
    path.push(current);
    visited.add(current);

    while (path.length < total) {
      const row = Math.floor(current / size);
      const col = current % size;
      const neighbors: number[] = [];

      for (const [dr, dc] of DIR_OFFSETS) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < size && c >= 0 && c < size) {
          const idx = r * size + c;
          if (!visited.has(idx)) neighbors.push(idx);
          r += dr;
          c += dc;
        }
      }

      if (neighbors.length === 0) break;
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      path.push(next);
      visited.add(next);
      current = next;
    }

    if (path.length < total) {
      for (let i = 0; i < total; i++) {
        if (!visited.has(i)) path.push(i);
      }
    }

    const grid = new Array(total).fill(0);
    const arrows = new Array(total).fill(0);

    for (let i = 0; i < path.length; i++) {
      grid[path[i]] = i + 1;
      if (i < path.length - 1) {
        const r1 = Math.floor(path[i] / size);
        const c1 = path[i] % size;
        const r2 = Math.floor(path[i + 1] / size);
        const c2 = path[i + 1] % size;
        const dr = Math.sign(r2 - r1);
        const dc = Math.sign(c2 - c1);
        arrows[path[i]] = DIR_OFFSETS.findIndex(([or, oc]) => or === dr && oc === dc);
      } else {
        arrows[path[i]] = -1;
      }
    }

    const playerGrid = new Array(total).fill(0);
    const fixed = new Array(total).fill(false);

    playerGrid[path[0]] = 1;
    fixed[path[0]] = true;
    playerGrid[path[path.length - 1]] = total;
    fixed[path[path.length - 1]] = true;

    const extraFixed = Math.floor(total * 0.25);
    const indices = Array.from({ length: total }, (_, i) => i).filter((i) => !fixed[i]);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < extraFixed && i < indices.length; i++) {
      playerGrid[indices[i]] = grid[indices[i]];
      fixed[indices[i]] = true;
    }

    return {
      size,
      grid: playerGrid,
      arrows,
      fixed,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: SignpostState): boolean {
    const { size, grid, arrows } = data;
    const total = size * size;

    for (let i = 0; i < total; i++) {
      if (grid[i] === 0) return false;
    }

    const seen = new Set<number>();
    for (let i = 0; i < total; i++) {
      if (seen.has(grid[i])) return false;
      seen.add(grid[i]);
    }

    for (let i = 0; i < total; i++) {
      if (grid[i] === total) continue;
      const nextVal = grid[i] + 1;
      let nextCell = -1;
      for (let j = 0; j < total; j++) {
        if (grid[j] === nextVal) {
          nextCell = j;
          break;
        }
      }
      if (nextCell === -1) return false;

      if (arrows[i] >= 0) {
        const [dr, dc] = DIR_OFFSETS[arrows[i]];
        const r1 = Math.floor(i / size);
        const c1 = i % size;
        const r2 = Math.floor(nextCell / size);
        const c2 = nextCell % size;
        const actualDr = Math.sign(r2 - r1);
        const actualDc = Math.sign(c2 - c1);
        if (dr !== actualDr || dc !== actualDc) return false;
      }
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SignpostState>();

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
        if (value < 0 || value > data.size * data.size) {
          return { success: false, error: 'Invalid value' };
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
    return this.getData<SignpostState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SignpostState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }
}

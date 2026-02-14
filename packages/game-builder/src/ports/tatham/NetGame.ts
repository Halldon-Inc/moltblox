/**
 * NetGame: Rotate pipe tiles to connect all endpoints to center
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface NetConfig {
  size?: number;
}

// Directions: 0=up, 1=right, 2=down, 3=left (bitmask)
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

interface NetState {
  [key: string]: unknown;
  size: number;
  tiles: number[];
  solution: number[];
  moves: number;
  solved: boolean;
}

export class NetGame extends BaseGame {
  readonly name = 'Net';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private rotateTile(tile: number, times: number): number {
    let t = tile;
    for (let i = 0; i < times % 4; i++) {
      let rotated = 0;
      if (t & UP) rotated |= RIGHT;
      if (t & RIGHT) rotated |= DOWN;
      if (t & DOWN) rotated |= LEFT;
      if (t & LEFT) rotated |= UP;
      t = rotated;
    }
    return t;
  }

  private checkConnected(tiles: number[], size: number): boolean {
    const total = size * size;
    const visited = new Set<number>();
    const center = Math.floor(size / 2) * size + Math.floor(size / 2);
    const stack = [center];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx)) continue;
      visited.add(idx);

      const row = Math.floor(idx / size);
      const col = idx % size;
      const tile = tiles[idx];

      if (tile & UP && row > 0) {
        const n = (row - 1) * size + col;
        if (tiles[n] & DOWN && !visited.has(n)) stack.push(n);
      }
      if (tile & DOWN && row < size - 1) {
        const n = (row + 1) * size + col;
        if (tiles[n] & UP && !visited.has(n)) stack.push(n);
      }
      if (tile & LEFT && col > 0) {
        const n = row * size + col - 1;
        if (tiles[n] & RIGHT && !visited.has(n)) stack.push(n);
      }
      if (tile & RIGHT && col < size - 1) {
        const n = row * size + col + 1;
        if (tiles[n] & LEFT && !visited.has(n)) stack.push(n);
      }
    }

    for (let i = 0; i < total; i++) {
      if (tiles[i] !== 0 && !visited.has(i)) return false;
    }
    return true;
  }

  protected initializeState(_playerIds: string[]): NetState {
    const cfg = this.config as NetConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 5, 10));
    const total = size * size;

    const solution: number[] = new Array(total).fill(0);
    const visited = new Set<number>();
    const center = Math.floor(size / 2) * size + Math.floor(size / 2);
    const buildStack = [center];
    visited.add(center);

    while (buildStack.length > 0) {
      const idx = buildStack[buildStack.length - 1];
      const row = Math.floor(idx / size);
      const col = idx % size;

      const neighbors: [number, number, number][] = [];
      if (row > 0 && !visited.has((row - 1) * size + col))
        neighbors.push([(row - 1) * size + col, UP, DOWN]);
      if (row < size - 1 && !visited.has((row + 1) * size + col))
        neighbors.push([(row + 1) * size + col, DOWN, UP]);
      if (col > 0 && !visited.has(row * size + col - 1))
        neighbors.push([row * size + col - 1, LEFT, RIGHT]);
      if (col < size - 1 && !visited.has(row * size + col + 1))
        neighbors.push([row * size + col + 1, RIGHT, LEFT]);

      if (neighbors.length === 0) {
        buildStack.pop();
        continue;
      }

      const [nIdx, fromDir, toDir] = neighbors[Math.floor(Math.random() * neighbors.length)];
      solution[idx] |= fromDir;
      solution[nIdx] |= toDir;
      visited.add(nIdx);
      buildStack.push(nIdx);
    }

    const tiles = solution.map((t) => this.rotateTile(t, Math.floor(Math.random() * 4)));

    return {
      size,
      tiles,
      solution,
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<NetState>();

    switch (action.type) {
      case 'rotate': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid tile index' };
        }

        data.tiles[index] = this.rotateTile(data.tiles[index], 1);
        data.moves++;

        if (this.checkConnected(data.tiles, data.size)) {
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
    return this.getData<NetState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<NetState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const total = data.size * data.size;
    const score = Math.max(0, 1000 - (data.moves - total) * 15);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as NetState;
    return {
      ...state,
      data: { ...data, solution: [] },
    };
  }
}

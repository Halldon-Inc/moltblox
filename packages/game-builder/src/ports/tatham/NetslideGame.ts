/**
 * NetslideGame: Slide rows/columns of pipe tiles to connect network
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface NetslideConfig {
  size?: number;
}

const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

interface NetslideState {
  [key: string]: unknown;
  size: number;
  tiles: number[];
  moves: number;
  solved: boolean;
}

export class NetslideGame extends BaseGame {
  readonly name = 'Netslide';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

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

  protected initializeState(_playerIds: string[]): NetslideState {
    const cfg = this.config as NetslideConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 4, 7));
    const total = size * size;

    const tiles: number[] = new Array(total).fill(0);
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
      tiles[idx] |= fromDir;
      tiles[nIdx] |= toDir;
      visited.add(nIdx);
      buildStack.push(nIdx);
    }

    const scrambles = size * 3;
    for (let s = 0; s < scrambles; s++) {
      if (Math.random() < 0.5) {
        const row = Math.floor(Math.random() * size);
        const saved = tiles[row * size];
        for (let c = 0; c < size - 1; c++) {
          tiles[row * size + c] = tiles[row * size + c + 1];
        }
        tiles[row * size + size - 1] = saved;
      } else {
        const col = Math.floor(Math.random() * size);
        const saved = tiles[col];
        for (let r = 0; r < size - 1; r++) {
          tiles[r * size + col] = tiles[(r + 1) * size + col];
        }
        tiles[(size - 1) * size + col] = saved;
      }
    }

    return { size, tiles, moves: 0, solved: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<NetslideState>();

    switch (action.type) {
      case 'slide_row': {
        const row = Number(action.payload.row);
        const dir = Number(action.payload.direction);
        if (row < 0 || row >= data.size) return { success: false, error: 'Invalid row' };

        if (dir > 0) {
          const saved = data.tiles[row * data.size + data.size - 1];
          for (let c = data.size - 1; c > 0; c--) {
            data.tiles[row * data.size + c] = data.tiles[row * data.size + c - 1];
          }
          data.tiles[row * data.size] = saved;
        } else {
          const saved = data.tiles[row * data.size];
          for (let c = 0; c < data.size - 1; c++) {
            data.tiles[row * data.size + c] = data.tiles[row * data.size + c + 1];
          }
          data.tiles[row * data.size + data.size - 1] = saved;
        }

        data.moves++;
        if (this.checkConnected(data.tiles, data.size)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'slide_col': {
        const col = Number(action.payload.col);
        const dir = Number(action.payload.direction);
        if (col < 0 || col >= data.size) return { success: false, error: 'Invalid column' };

        if (dir > 0) {
          const saved = data.tiles[(data.size - 1) * data.size + col];
          for (let r = data.size - 1; r > 0; r--) {
            data.tiles[r * data.size + col] = data.tiles[(r - 1) * data.size + col];
          }
          data.tiles[col] = saved;
        } else {
          const saved = data.tiles[col];
          for (let r = 0; r < data.size - 1; r++) {
            data.tiles[r * data.size + col] = data.tiles[(r + 1) * data.size + col];
          }
          data.tiles[(data.size - 1) * data.size + col] = saved;
        }

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
    return this.getData<NetslideState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<NetslideState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 20);
    return { [playerId]: score };
  }
}

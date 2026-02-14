/**
 * FloodGame: Change color of top-left region, fill entire board in limited moves
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface FloodConfig {
  size?: number;
  numColors?: number;
}

interface FloodState {
  [key: string]: unknown;
  grid: number[];
  size: number;
  numColors: number;
  moves: number;
  maxMoves: number;
  solved: boolean;
  lost: boolean;
}

export class FloodGame extends BaseGame {
  readonly name = 'Flood';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): FloodState {
    const cfg = this.config as FloodConfig;
    const size = Math.max(4, Math.min(cfg.size ?? 8, 16));
    const numColors = Math.max(3, Math.min(cfg.numColors ?? 6, 8));
    const total = size * size;

    const grid: number[] = [];
    for (let i = 0; i < total; i++) {
      grid.push(Math.floor(Math.random() * numColors));
    }

    const maxMoves = Math.floor(size * numColors * 0.4) + 2;

    return {
      grid,
      size,
      numColors,
      moves: 0,
      maxMoves,
      solved: false,
      lost: false,
    };
  }

  private floodFill(data: FloodState, newColor: number): void {
    const oldColor = data.grid[0];
    if (oldColor === newColor) return;

    const visited = new Set<number>();
    const stack = [0];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx)) continue;
      if (data.grid[idx] !== oldColor) continue;

      visited.add(idx);
      data.grid[idx] = newColor;

      const row = Math.floor(idx / data.size);
      const col = idx % data.size;

      if (row > 0) stack.push((row - 1) * data.size + col);
      if (row < data.size - 1) stack.push((row + 1) * data.size + col);
      if (col > 0) stack.push(row * data.size + col - 1);
      if (col < data.size - 1) stack.push(row * data.size + col + 1);
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FloodState>();

    switch (action.type) {
      case 'flood': {
        const color = Number(action.payload.color);
        if (color < 0 || color >= data.numColors) {
          return { success: false, error: 'Invalid color' };
        }
        if (color === data.grid[0]) {
          return { success: false, error: 'Same color as current region' };
        }

        this.floodFill(data, color);
        data.moves++;

        const allSame = data.grid.every((c) => c === data.grid[0]);
        if (allSame) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        } else if (data.moves >= data.maxMoves) {
          data.lost = true;
          this.emitEvent('out_of_moves', playerId, {});
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FloodState>();
    return data.solved || data.lost;
  }

  protected determineWinner(): string | null {
    return this.getData<FloodState>().solved ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FloodState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - (data.moves / data.maxMoves) * 500);
    return { [playerId]: Math.round(score) };
  }
}

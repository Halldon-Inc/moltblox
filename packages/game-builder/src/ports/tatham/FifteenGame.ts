/**
 * FifteenGame: Sliding puzzle (4x4 grid, slide tiles to order)
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface FifteenConfig {
  size?: number;
}

interface FifteenState {
  [key: string]: unknown;
  grid: number[];
  size: number;
  emptyIndex: number;
  moves: number;
  solved: boolean;
}

export class FifteenGame extends BaseGame {
  readonly name = 'Fifteen Puzzle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private isSolvable(grid: number[], size: number): boolean {
    let inversions = 0;
    const flat = grid.filter((v) => v !== 0);
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i] > flat[j]) inversions++;
      }
    }
    const emptyRow = Math.floor(grid.indexOf(0) / size);
    if (size % 2 === 1) return inversions % 2 === 0;
    return (inversions + emptyRow) % 2 === 1;
  }

  protected initializeState(_playerIds: string[]): FifteenState {
    const cfg = this.config as FifteenConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 4, 6));
    const total = size * size;

    let grid: number[];
    do {
      grid = Array.from({ length: total - 1 }, (_, i) => i + 1);
      grid.push(0);
      for (let i = grid.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [grid[i], grid[j]] = [grid[j], grid[i]];
      }
    } while (!this.isSolvable(grid, size));

    return {
      grid,
      size,
      emptyIndex: grid.indexOf(0),
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FifteenState>();

    switch (action.type) {
      case 'slide': {
        const tileIndex = Number(action.payload.index);
        if (tileIndex < 0 || tileIndex >= data.grid.length) {
          return { success: false, error: 'Invalid tile index' };
        }

        const tileRow = Math.floor(tileIndex / data.size);
        const tileCol = tileIndex % data.size;
        const emptyRow = Math.floor(data.emptyIndex / data.size);
        const emptyCol = data.emptyIndex % data.size;

        const dist = Math.abs(tileRow - emptyRow) + Math.abs(tileCol - emptyCol);
        if (dist !== 1) {
          return { success: false, error: 'Tile must be adjacent to empty space' };
        }

        data.grid[data.emptyIndex] = data.grid[tileIndex];
        data.grid[tileIndex] = 0;
        data.emptyIndex = tileIndex;
        data.moves++;

        let solved = true;
        for (let i = 0; i < data.grid.length - 1; i++) {
          if (data.grid[i] !== i + 1) {
            solved = false;
            break;
          }
        }
        data.solved = solved;

        if (solved) {
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
    return this.getData<FifteenState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FifteenState>();
    const playerId = this.getPlayers()[0];
    const optimal = data.size * data.size * 2;
    const score = Math.max(0, 1000 - Math.max(0, data.moves - optimal) * 5);
    return { [playerId]: score };
  }
}

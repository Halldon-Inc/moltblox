/**
 * FlipGame: Toggle grid cells, each flip affects neighbors, make all same
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface FlipConfig {
  size?: number;
}

interface FlipState {
  [key: string]: unknown;
  grid: boolean[];
  size: number;
  moves: number;
  solved: boolean;
}

export class FlipGame extends BaseGame {
  readonly name = 'Flip';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): FlipState {
    const cfg = this.config as FlipConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 5, 8));
    const total = size * size;

    const grid = new Array(total).fill(false);
    const numFlips = Math.floor(Math.random() * (size * 2)) + size;
    for (let f = 0; f < numFlips; f++) {
      const idx = Math.floor(Math.random() * total);
      const row = Math.floor(idx / size);
      const col = idx % size;
      grid[idx] = !grid[idx];
      if (row > 0) grid[(row - 1) * size + col] = !grid[(row - 1) * size + col];
      if (row < size - 1) grid[(row + 1) * size + col] = !grid[(row + 1) * size + col];
      if (col > 0) grid[row * size + col - 1] = !grid[row * size + col - 1];
      if (col < size - 1) grid[row * size + col + 1] = !grid[row * size + col + 1];
    }

    return { grid, size, moves: 0, solved: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FlipState>();

    switch (action.type) {
      case 'flip': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.grid.length) {
          return { success: false, error: 'Invalid cell index' };
        }

        const row = Math.floor(index / data.size);
        const col = index % data.size;
        data.grid[index] = !data.grid[index];
        if (row > 0)
          data.grid[(row - 1) * data.size + col] = !data.grid[(row - 1) * data.size + col];
        if (row < data.size - 1)
          data.grid[(row + 1) * data.size + col] = !data.grid[(row + 1) * data.size + col];
        if (col > 0) data.grid[row * data.size + col - 1] = !data.grid[row * data.size + col - 1];
        if (col < data.size - 1)
          data.grid[row * data.size + col + 1] = !data.grid[row * data.size + col + 1];

        data.moves++;

        const allSame = data.grid.every((v) => v === data.grid[0]);
        data.solved = allSame;

        if (allSame) {
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
    return this.getData<FlipState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FlipState>();
    const playerId = this.getPlayers()[0];
    const score = Math.max(0, 1000 - data.moves * 30);
    return { [playerId]: score };
  }
}

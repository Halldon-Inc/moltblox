/**
 * TwiddleGame: Rotate 2x2 blocks to sort numbered grid
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TwiddleConfig {
  width?: number;
  height?: number;
}

interface TwiddleState {
  [key: string]: unknown;
  width: number;
  height: number;
  grid: number[];
  moves: number;
  solved: boolean;
}

export class TwiddleGame extends BaseGame {
  readonly name = 'Twiddle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): TwiddleState {
    const cfg = this.config as TwiddleConfig;
    const width = Math.max(3, Math.min(cfg.width ?? 4, 8));
    const height = Math.max(3, Math.min(cfg.height ?? 4, 8));
    const total = width * height;

    const grid = Array.from({ length: total }, (_, i) => i + 1);

    const scrambles = total * 3;
    for (let s = 0; s < scrambles; s++) {
      const r = Math.floor(Math.random() * (height - 1));
      const c = Math.floor(Math.random() * (width - 1));
      const clockwise = Math.random() < 0.5;

      const tl = r * width + c;
      const tr = r * width + c + 1;
      const bl = (r + 1) * width + c;
      const br = (r + 1) * width + c + 1;

      if (clockwise) {
        const temp = grid[tl];
        grid[tl] = grid[bl];
        grid[bl] = grid[br];
        grid[br] = grid[tr];
        grid[tr] = temp;
      } else {
        const temp = grid[tl];
        grid[tl] = grid[tr];
        grid[tr] = grid[br];
        grid[br] = grid[bl];
        grid[bl] = temp;
      }
    }

    return { width, height, grid, moves: 0, solved: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TwiddleState>();

    switch (action.type) {
      case 'rotate': {
        const row = Number(action.payload.row);
        const col = Number(action.payload.col);
        const clockwise = action.payload.clockwise !== false;

        if (row < 0 || row >= data.height - 1 || col < 0 || col >= data.width - 1) {
          return { success: false, error: 'Invalid position (must be top-left of 2x2 block)' };
        }

        const tl = row * data.width + col;
        const tr = row * data.width + col + 1;
        const bl = (row + 1) * data.width + col;
        const br = (row + 1) * data.width + col + 1;

        if (clockwise) {
          const temp = data.grid[tl];
          data.grid[tl] = data.grid[bl];
          data.grid[bl] = data.grid[br];
          data.grid[br] = data.grid[tr];
          data.grid[tr] = temp;
        } else {
          const temp = data.grid[tl];
          data.grid[tl] = data.grid[tr];
          data.grid[tr] = data.grid[br];
          data.grid[br] = data.grid[bl];
          data.grid[bl] = temp;
        }

        data.moves++;

        let solved = true;
        for (let i = 0; i < data.grid.length; i++) {
          if (data.grid[i] !== i + 1) {
            solved = false;
            break;
          }
        }
        data.solved = solved;
        if (solved) this.emitEvent('puzzle_solved', playerId, { moves: data.moves });

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<TwiddleState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TwiddleState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

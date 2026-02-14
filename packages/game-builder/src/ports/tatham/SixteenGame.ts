/**
 * SixteenGame: Like Fifteen but tiles wrap around edges
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SixteenConfig {
  size?: number;
}

interface SixteenState {
  [key: string]: unknown;
  grid: number[];
  size: number;
  moves: number;
  solved: boolean;
}

export class SixteenGame extends BaseGame {
  readonly name = 'Sixteen';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SixteenState {
    const cfg = this.config as SixteenConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 4, 6));
    const total = size * size;
    const goal = Array.from({ length: total }, (_, i) => i + 1);

    const grid = [...goal];
    const scrambles = size * size * 4;
    for (let s = 0; s < scrambles; s++) {
      if (Math.random() < 0.5) {
        const row = Math.floor(Math.random() * size);
        if (Math.random() < 0.5) {
          const saved = grid[row * size + size - 1];
          for (let c = size - 1; c > 0; c--) grid[row * size + c] = grid[row * size + c - 1];
          grid[row * size] = saved;
        } else {
          const saved = grid[row * size];
          for (let c = 0; c < size - 1; c++) grid[row * size + c] = grid[row * size + c + 1];
          grid[row * size + size - 1] = saved;
        }
      } else {
        const col = Math.floor(Math.random() * size);
        if (Math.random() < 0.5) {
          const saved = grid[(size - 1) * size + col];
          for (let r = size - 1; r > 0; r--) grid[r * size + col] = grid[(r - 1) * size + col];
          grid[col] = saved;
        } else {
          const saved = grid[col];
          for (let r = 0; r < size - 1; r++) grid[r * size + col] = grid[(r + 1) * size + col];
          grid[(size - 1) * size + col] = saved;
        }
      }
    }

    return { grid, size, moves: 0, solved: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SixteenState>();

    switch (action.type) {
      case 'slide_row': {
        const row = Number(action.payload.row);
        const dir = Number(action.payload.direction);
        if (row < 0 || row >= data.size) return { success: false, error: 'Invalid row' };

        if (dir > 0) {
          const saved = data.grid[row * data.size + data.size - 1];
          for (let c = data.size - 1; c > 0; c--)
            data.grid[row * data.size + c] = data.grid[row * data.size + c - 1];
          data.grid[row * data.size] = saved;
        } else {
          const saved = data.grid[row * data.size];
          for (let c = 0; c < data.size - 1; c++)
            data.grid[row * data.size + c] = data.grid[row * data.size + c + 1];
          data.grid[row * data.size + data.size - 1] = saved;
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

      case 'slide_col': {
        const col = Number(action.payload.col);
        const dir = Number(action.payload.direction);
        if (col < 0 || col >= data.size) return { success: false, error: 'Invalid column' };

        if (dir > 0) {
          const saved = data.grid[(data.size - 1) * data.size + col];
          for (let r = data.size - 1; r > 0; r--)
            data.grid[r * data.size + col] = data.grid[(r - 1) * data.size + col];
          data.grid[col] = saved;
        } else {
          const saved = data.grid[col];
          for (let r = 0; r < data.size - 1; r++)
            data.grid[r * data.size + col] = data.grid[(r + 1) * data.size + col];
          data.grid[(data.size - 1) * data.size + col] = saved;
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
    return this.getData<SixteenState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SixteenState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

/**
 * MosaicGame: Fill grid based on number clues about 3x3 neighborhoods
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MosaicConfig {
  size?: number;
}

interface MosaicState {
  [key: string]: unknown;
  size: number;
  clues: (number | null)[];
  cells: (boolean | null)[];
  solution: boolean[];
  moves: number;
  solved: boolean;
}

export class MosaicGame extends BaseGame {
  readonly name = 'Mosaic';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private countNeighborhood(grid: boolean[], size: number, row: number, col: number): number {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < size && c >= 0 && c < size) {
          if (grid[r * size + c]) count++;
        }
      }
    }
    return count;
  }

  protected initializeState(_playerIds: string[]): MosaicState {
    const cfg = this.config as MosaicConfig;
    const size = Math.max(4, Math.min(cfg.size ?? 7, 12));
    const total = size * size;

    const solution: boolean[] = [];
    for (let i = 0; i < total; i++) {
      solution.push(Math.random() < 0.5);
    }

    const clues: (number | null)[] = new Array(total).fill(null);
    for (let i = 0; i < total; i++) {
      if (Math.random() < 0.5) {
        const row = Math.floor(i / size);
        const col = i % size;
        clues[i] = this.countNeighborhood(solution, size, row, col);
      }
    }

    return {
      size,
      clues,
      cells: new Array(total).fill(null),
      solution,
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MosaicState>();

    switch (action.type) {
      case 'fill': {
        const index = Number(action.payload.index);
        const filled = action.payload.filled as boolean | null;
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }

        data.cells[index] = filled;
        data.moves++;

        let allFilled = true;
        for (let i = 0; i < data.cells.length; i++) {
          if (data.cells[i] === null) {
            allFilled = false;
            break;
          }
        }

        if (allFilled) {
          let correct = true;
          for (let i = 0; i < data.clues.length; i++) {
            if (data.clues[i] !== null) {
              const row = Math.floor(i / data.size);
              const col = i % data.size;
              const boolCells = data.cells.map((c) => c === true);
              const count = this.countNeighborhood(boolCells, data.size, row, col);
              if (count !== data.clues[i]) {
                correct = false;
                break;
              }
            }
          }
          if (correct) {
            data.solved = true;
            this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
          }
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<MosaicState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MosaicState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as MosaicState;
    return {
      ...state,
      data: { ...data, solution: [] },
    };
  }
}

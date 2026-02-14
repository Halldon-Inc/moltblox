/**
 * SlantGame: Place / or \\ diagonals, numbers show meeting diagonals at intersections
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SlantConfig {
  width?: number;
  height?: number;
}

type SlantValue = '/' | '\\' | null;

interface SlantState {
  [key: string]: unknown;
  width: number;
  height: number;
  clues: (number | null)[];
  cells: SlantValue[];
  moves: number;
  solved: boolean;
}

export class SlantGame extends BaseGame {
  readonly name = 'Slant';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private countAtVertex(
    cells: SlantValue[],
    width: number,
    height: number,
    vr: number,
    vc: number,
  ): number {
    let count = 0;
    if (vr > 0 && vc > 0 && cells[(vr - 1) * width + vc - 1] === '\\') count++;
    if (vr > 0 && vc < width && cells[(vr - 1) * width + vc] === '/') count++;
    if (vr < height && vc > 0 && cells[vr * width + vc - 1] === '/') count++;
    if (vr < height && vc < width && cells[vr * width + vc] === '\\') count++;
    return count;
  }

  protected initializeState(_playerIds: string[]): SlantState {
    const cfg = this.config as SlantConfig;
    const width = Math.max(3, Math.min(cfg.width ?? 5, 10));
    const height = Math.max(3, Math.min(cfg.height ?? 5, 10));
    const total = width * height;

    const solution: SlantValue[] = [];
    for (let i = 0; i < total; i++) {
      solution.push(Math.random() < 0.5 ? '/' : '\\');
    }

    const clues: (number | null)[] = new Array((width + 1) * (height + 1)).fill(null);
    for (let vr = 0; vr <= height; vr++) {
      for (let vc = 0; vc <= width; vc++) {
        if (Math.random() < 0.4) {
          clues[vr * (width + 1) + vc] = this.countAtVertex(solution, width, height, vr, vc);
        }
      }
    }

    return {
      width,
      height,
      clues,
      cells: new Array(total).fill(null),
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: SlantState): boolean {
    const { width, height, clues, cells } = data;

    for (let i = 0; i < width * height; i++) {
      if (cells[i] === null) return false;
    }

    for (let vr = 0; vr <= height; vr++) {
      for (let vc = 0; vc <= width; vc++) {
        const clue = clues[vr * (width + 1) + vc];
        if (clue !== null) {
          if (this.countAtVertex(cells, width, height, vr, vc) !== clue) return false;
        }
      }
    }

    const parent = Array.from({ length: (width + 1) * (height + 1) }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const union = (a: number, b: number) => {
      parent[find(a)] = find(b);
    };

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (cells[r * width + c] === '\\') {
          union(r * (width + 1) + c, (r + 1) * (width + 1) + c + 1);
        } else {
          union(r * (width + 1) + c + 1, (r + 1) * (width + 1) + c);
        }
      }
    }

    const roots = new Set<number>();
    for (let i = 0; i < (width + 1) * (height + 1); i++) {
      roots.add(find(i));
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SlantState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = action.payload.value as SlantValue;
        if (index < 0 || index >= data.width * data.height) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (value !== '/' && value !== '\\' && value !== null) {
          return { success: false, error: 'Value must be /, \\, or null' };
        }

        data.cells[index] = value;
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
    return this.getData<SlantState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SlantState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 8);
    return { [playerId]: score };
  }
}

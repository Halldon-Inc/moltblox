/**
 * UnrulyGame: Fill grid with black/white, max 2 consecutive same color, equal counts
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface UnrulyConfig {
  width?: number;
  height?: number;
}

type UnrulyCell = 0 | 1 | null; // 0=white, 1=black, null=empty

interface UnrulyState {
  [key: string]: unknown;
  width: number;
  height: number;
  cells: UnrulyCell[];
  fixed: boolean[];
  solution: UnrulyCell[];
  moves: number;
  solved: boolean;
}

export class UnrulyGame extends BaseGame {
  readonly name = 'Unruly';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private isValidUnruly(cells: (0 | 1 | null)[], width: number, height: number): boolean {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width - 2; c++) {
        const a = cells[r * width + c];
        const b = cells[r * width + c + 1];
        const cc = cells[r * width + c + 2];
        if (a !== null && a === b && b === cc) return false;
      }
    }
    for (let c = 0; c < width; c++) {
      for (let r = 0; r < height - 2; r++) {
        const a = cells[r * width + c];
        const b = cells[(r + 1) * width + c];
        const cc = cells[(r + 2) * width + c];
        if (a !== null && a === b && b === cc) return false;
      }
    }
    return true;
  }

  protected initializeState(_playerIds: string[]): UnrulyState {
    const cfg = this.config as UnrulyConfig;
    let width = Math.max(4, Math.min(cfg.width ?? 8, 14));
    let height = Math.max(4, Math.min(cfg.height ?? 8, 14));
    if (width % 2 !== 0) width++;
    if (height % 2 !== 0) height++;
    const total = width * height;

    const solution: (0 | 1)[] = new Array(total).fill(0);

    for (let r = 0; r < height; r++) {
      let zeros = 0;
      let ones = 0;
      for (let c = 0; c < width; c++) {
        const choices: (0 | 1)[] = [];
        if (zeros < width / 2) choices.push(0);
        if (ones < width / 2) choices.push(1);
        if (choices.length === 0) choices.push(0);

        const val = choices[Math.floor(Math.random() * choices.length)];

        if (c >= 2) {
          const prev1 = solution[r * width + c - 1];
          const prev2 = solution[r * width + c - 2];
          if (prev1 === prev2 && prev1 === val && choices.length > 1) {
            solution[r * width + c] = val === 0 ? 1 : 0;
            if (val === 0) ones++;
            else zeros++;
            continue;
          }
        }

        solution[r * width + c] = val;
        if (val === 0) zeros++;
        else ones++;
      }
    }

    const cells: UnrulyCell[] = [...solution];
    const fixed = new Array(total).fill(true);
    const removals = Math.floor(total * 0.6);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < removals; i++) {
      cells[indices[i]] = null;
      fixed[indices[i]] = false;
    }

    return {
      width,
      height,
      cells,
      fixed,
      solution,
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<UnrulyState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = action.payload.value as UnrulyCell;
        if (index < 0 || index >= data.width * data.height) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.fixed[index]) {
          return { success: false, error: 'Cannot modify fixed cell' };
        }
        if (value !== 0 && value !== 1 && value !== null) {
          return { success: false, error: 'Value must be 0, 1, or null' };
        }

        data.cells[index] = value;
        data.moves++;

        let allFilled = true;
        for (const c of data.cells) {
          if (c === null) {
            allFilled = false;
            break;
          }
        }

        if (allFilled && this.isValidUnruly(data.cells, data.width, data.height)) {
          const { width, height } = data;
          let valid = true;
          for (let r = 0; r < height && valid; r++) {
            let z = 0;
            let o = 0;
            for (let c = 0; c < width; c++) {
              if (data.cells[r * width + c] === 0) z++;
              else o++;
            }
            if (z !== width / 2 || o !== width / 2) valid = false;
          }
          for (let c = 0; c < width && valid; c++) {
            let z = 0;
            let o = 0;
            for (let r = 0; r < height; r++) {
              if (data.cells[r * width + c] === 0) z++;
              else o++;
            }
            if (z !== height / 2 || o !== height / 2) valid = false;
          }
          if (valid) {
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
    return this.getData<UnrulyState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<UnrulyState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as UnrulyState;
    return {
      ...state,
      data: { ...data, solution: [] },
    };
  }
}

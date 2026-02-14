/**
 * PegsGame (Peg solitaire): Jump pegs to remove them, leave one.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PegsConfig {
  boardType?: 'english' | 'cross' | 'diamond';
}

interface PegsState {
  [key: string]: unknown;
  width: number;
  height: number;
  pegs: boolean[];
  valid: boolean[];
  pegCount: number;
  moves: number;
  gameOver: boolean;
}

export class PegsGame extends BaseGame {
  readonly name = 'Pegs';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): PegsState {
    const cfg = this.config as PegsConfig;
    const boardType = cfg.boardType ?? 'english';

    let width: number;
    let height: number;
    let valid: boolean[];

    if (boardType === 'english') {
      width = 7;
      height = 7;
      valid = new Array(49).fill(false);
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if ((r >= 2 && r <= 4) || (c >= 2 && c <= 4)) {
            valid[r * 7 + c] = true;
          }
        }
      }
    } else if (boardType === 'diamond') {
      width = 7;
      height = 7;
      valid = new Array(49).fill(false);
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (Math.abs(r - 3) + Math.abs(c - 3) <= 3) {
            valid[r * 7 + c] = true;
          }
        }
      }
    } else {
      width = 5;
      height = 5;
      valid = new Array(25).fill(true);
    }

    const pegs = valid.map((v) => v);
    const center = Math.floor(height / 2) * width + Math.floor(width / 2);
    pegs[center] = false;

    const pegCount = pegs.filter(Boolean).length;

    return {
      width,
      height,
      pegs,
      valid,
      pegCount,
      moves: 0,
      gameOver: false,
    };
  }

  private hasValidMoves(data: PegsState): boolean {
    const { width, height, pegs, valid } = data;
    const dirs: [number, number][] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!pegs[r * width + c]) continue;
        for (const [dr, dc] of dirs) {
          const mr = r + dr;
          const mc = c + dc;
          const tr = r + 2 * dr;
          const tc = c + 2 * dc;
          if (tr >= 0 && tr < height && tc >= 0 && tc < width) {
            if (pegs[mr * width + mc] && !pegs[tr * width + tc] && valid[tr * width + tc]) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PegsState>();

    switch (action.type) {
      case 'jump': {
        const from = Number(action.payload.from);
        const to = Number(action.payload.to);
        const { width, height, pegs, valid } = data;

        if (from < 0 || from >= width * height || to < 0 || to >= width * height) {
          return { success: false, error: 'Invalid position' };
        }
        if (!pegs[from]) return { success: false, error: 'No peg at source' };
        if (pegs[to]) return { success: false, error: 'Target not empty' };
        if (!valid[to]) return { success: false, error: 'Target not valid' };

        const fr = Math.floor(from / width);
        const fc = from % width;
        const tr = Math.floor(to / width);
        const tc = to % width;

        if (Math.abs(fr - tr) + Math.abs(fc - tc) !== 2) {
          return { success: false, error: 'Must jump exactly 2 cells' };
        }
        if (fr !== tr && fc !== tc) {
          return { success: false, error: 'Must jump in cardinal direction' };
        }

        const mr = (fr + tr) / 2;
        const mc = (fc + tc) / 2;
        const midIdx = mr * width + mc;
        if (!pegs[midIdx]) return { success: false, error: 'No peg to jump over' };

        data.pegs[from] = false;
        data.pegs[midIdx] = false;
        data.pegs[to] = true;
        data.pegCount--;
        data.moves++;

        if (!this.hasValidMoves(data)) {
          data.gameOver = true;
          if (data.pegCount === 1) {
            this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
          } else {
            this.emitEvent('no_moves_left', playerId, { pegsRemaining: data.pegCount });
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
    return this.getData<PegsState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.getData<PegsState>().pegCount === 1 ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PegsState>();
    const playerId = this.getPlayers()[0];
    const totalPegs = data.valid.filter(Boolean).length - 1;
    const removed = totalPegs - data.pegCount;
    const score = data.pegCount === 1 ? 1000 : removed * 50;
    return { [playerId]: score };
  }
}

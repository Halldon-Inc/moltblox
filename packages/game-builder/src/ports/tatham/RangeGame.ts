/**
 * RangeGame (Kuromasu): Place black cells.
 * Numbers see that many white cells in cardinal lines (including themselves).
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface RangeConfig {
  size?: number;
}

interface RangeState {
  [key: string]: unknown;
  size: number;
  clues: (number | null)[];
  black: boolean[];
  moves: number;
  solved: boolean;
}

export class RangeGame extends BaseGame {
  readonly name = 'Range';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private visibleCount(black: boolean[], size: number, row: number, col: number): number {
    let count = 1;
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < size && c >= 0 && c < size && !black[r * size + c]) {
        count++;
        r += dr;
        c += dc;
      }
    }
    return count;
  }

  protected initializeState(_playerIds: string[]): RangeState {
    const cfg = this.config as RangeConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 7, 12));
    const total = size * size;

    const solutionBlack = new Array(total).fill(false);
    const numBlack = Math.floor(total * 0.15);

    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < numBlack; i++) {
      solutionBlack[indices[i]] = true;
    }

    const clues: (number | null)[] = new Array(total).fill(null);
    for (let i = 0; i < total; i++) {
      if (solutionBlack[i]) continue;
      if (Math.random() < 0.3) {
        const row = Math.floor(i / size);
        const col = i % size;
        clues[i] = this.visibleCount(solutionBlack, size, row, col);
      }
    }

    return {
      size,
      clues,
      black: new Array(total).fill(false),
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: RangeState): boolean {
    const { size, clues, black } = data;
    const total = size * size;

    for (let i = 0; i < total; i++) {
      if (clues[i] !== null) {
        if (black[i]) return false;
        const row = Math.floor(i / size);
        const col = i % size;
        if (this.visibleCount(black, size, row, col) !== clues[i]) return false;
      }
    }

    for (let i = 0; i < total; i++) {
      if (black[i]) {
        const row = Math.floor(i / size);
        const col = i % size;
        const neighbors = [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1],
        ];
        for (const [r, c] of neighbors) {
          if (r >= 0 && r < size && c >= 0 && c < size && black[r * size + c]) {
            return false;
          }
        }
      }
    }

    const whiteVisited = new Set<number>();
    let firstWhite = -1;
    for (let i = 0; i < total; i++) {
      if (!black[i]) {
        firstWhite = i;
        break;
      }
    }
    if (firstWhite === -1) return false;

    const stack = [firstWhite];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (whiteVisited.has(idx)) continue;
      if (black[idx]) continue;
      whiteVisited.add(idx);
      const row = Math.floor(idx / size);
      const col = idx % size;
      if (row > 0) stack.push((row - 1) * size + col);
      if (row < size - 1) stack.push((row + 1) * size + col);
      if (col > 0) stack.push(row * size + col - 1);
      if (col < size - 1) stack.push(row * size + col + 1);
    }

    const totalWhite = total - black.filter(Boolean).length;
    return whiteVisited.size === totalWhite;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RangeState>();

    switch (action.type) {
      case 'toggle': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.clues[index] !== null) {
          return { success: false, error: 'Cannot place black cell on clue' };
        }

        data.black[index] = !data.black[index];
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
    return this.getData<RangeState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<RangeState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

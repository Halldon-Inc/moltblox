/**
 * SameGameGame: Remove groups of 2+ adjacent same-colored cells, cascade
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SameGameConfig {
  width?: number;
  height?: number;
  numColors?: number;
}

interface SameGameState {
  [key: string]: unknown;
  width: number;
  height: number;
  numColors: number;
  grid: (number | null)[];
  score: number;
  moves: number;
  gameOver: boolean;
}

export class SameGameGame extends BaseGame {
  readonly name = 'Same Game';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SameGameState {
    const cfg = this.config as SameGameConfig;
    const width = Math.max(5, Math.min(cfg.width ?? 10, 20));
    const height = Math.max(5, Math.min(cfg.height ?? 10, 16));
    const numColors = Math.max(2, Math.min(cfg.numColors ?? 4, 6));
    const total = width * height;

    const grid: (number | null)[] = [];
    for (let i = 0; i < total; i++) {
      grid.push(Math.floor(Math.random() * numColors));
    }

    return {
      width,
      height,
      numColors,
      grid,
      score: 0,
      moves: 0,
      gameOver: false,
    };
  }

  private getGroup(
    grid: (number | null)[],
    width: number,
    height: number,
    index: number,
  ): number[] {
    const color = grid[index];
    if (color === null) return [];

    const visited = new Set<number>();
    const stack = [index];
    const group: number[] = [];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx)) continue;
      if (grid[idx] !== color) continue;
      visited.add(idx);
      group.push(idx);

      const row = Math.floor(idx / width);
      const col = idx % width;
      if (row > 0) stack.push((row - 1) * width + col);
      if (row < height - 1) stack.push((row + 1) * width + col);
      if (col > 0) stack.push(row * width + col - 1);
      if (col < width - 1) stack.push(row * width + col + 1);
    }

    return group;
  }

  private applyGravity(data: SameGameState): void {
    const { width, height, grid } = data;

    for (let c = 0; c < width; c++) {
      const column: (number | null)[] = [];
      for (let r = 0; r < height; r++) {
        const val = grid[r * width + c];
        if (val !== null) column.push(val);
      }
      const empties = height - column.length;
      for (let r = 0; r < empties; r++) {
        grid[r * width + c] = null;
      }
      for (let r = 0; r < column.length; r++) {
        grid[(empties + r) * width + c] = column[r];
      }
    }

    let writeCol = 0;
    for (let c = 0; c < width; c++) {
      let isEmpty = true;
      for (let r = 0; r < height; r++) {
        if (grid[r * width + c] !== null) {
          isEmpty = false;
          break;
        }
      }
      if (!isEmpty) {
        if (writeCol !== c) {
          for (let r = 0; r < height; r++) {
            grid[r * width + writeCol] = grid[r * width + c];
            grid[r * width + c] = null;
          }
        }
        writeCol++;
      }
    }
  }

  private hasValidMoves(data: SameGameState): boolean {
    const { width, height, grid } = data;
    for (let i = 0; i < width * height; i++) {
      if (grid[i] === null) continue;
      const group = this.getGroup(grid, width, height, i);
      if (group.length >= 2) return true;
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SameGameState>();
    if (data.gameOver) return { success: false, error: 'Game is over' };

    switch (action.type) {
      case 'remove': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.width * data.height) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.grid[index] === null) {
          return { success: false, error: 'Cell is empty' };
        }

        const group = this.getGroup(data.grid, data.width, data.height, index);
        if (group.length < 2) {
          return { success: false, error: 'Group must have 2 or more cells' };
        }

        const points = (group.length - 2) * (group.length - 2);
        data.score += points;
        data.moves++;

        for (const idx of group) {
          data.grid[idx] = null;
        }

        this.applyGravity(data);

        this.emitEvent('group_removed', playerId, { size: group.length, points });

        if (!this.hasValidMoves(data)) {
          data.gameOver = true;
          const remaining = data.grid.filter((c) => c !== null).length;
          if (remaining === 0) {
            data.score += 1000;
          }
          this.emitEvent('game_over', playerId, { score: data.score, remaining });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<SameGameState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SameGameState>();
    const playerId = this.getPlayers()[0];
    return { [playerId]: data.score };
  }
}

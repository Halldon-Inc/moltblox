/**
 * PalisadeGame: Divide grid into regions of given sizes
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PalisadeConfig {
  width?: number;
  height?: number;
  regionSize?: number;
}

interface PalisadeState {
  [key: string]: unknown;
  width: number;
  height: number;
  regionSize: number;
  clues: (number | null)[];
  borders: { right: boolean[]; bottom: boolean[] };
  moves: number;
  solved: boolean;
}

export class PalisadeGame extends BaseGame {
  readonly name = 'Palisade';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): PalisadeState {
    const cfg = this.config as PalisadeConfig;
    const width = Math.max(4, Math.min(cfg.width ?? 6, 10));
    const height = Math.max(4, Math.min(cfg.height ?? 6, 10));
    const regionSize = Math.max(2, Math.min(cfg.regionSize ?? 4, 6));
    const total = width * height;

    const regionOf = new Array(total).fill(-1);
    let regionId = 0;
    const unassigned: number[] = [];
    for (let i = 0; i < total; i++) unassigned.push(i);

    for (let i = unassigned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unassigned[i], unassigned[j]] = [unassigned[j], unassigned[i]];
    }

    for (const start of unassigned) {
      if (regionOf[start] !== -1) continue;
      const region: number[] = [start];
      regionOf[start] = regionId;
      let attempts = 0;

      while (region.length < regionSize && attempts < 100) {
        const cell = region[Math.floor(Math.random() * region.length)];
        const row = Math.floor(cell / width);
        const col = cell % width;
        const neighbors: number[] = [];
        if (row > 0 && regionOf[(row - 1) * width + col] === -1)
          neighbors.push((row - 1) * width + col);
        if (row < height - 1 && regionOf[(row + 1) * width + col] === -1)
          neighbors.push((row + 1) * width + col);
        if (col > 0 && regionOf[row * width + col - 1] === -1)
          neighbors.push(row * width + col - 1);
        if (col < width - 1 && regionOf[row * width + col + 1] === -1)
          neighbors.push(row * width + col + 1);
        if (neighbors.length > 0) {
          const n = neighbors[Math.floor(Math.random() * neighbors.length)];
          regionOf[n] = regionId;
          region.push(n);
        }
        attempts++;
      }
      regionId++;
    }

    const clues: (number | null)[] = new Array(total).fill(null);
    for (let i = 0; i < total; i++) {
      if (Math.random() < 0.35) {
        const row = Math.floor(i / width);
        const col = i % width;
        let borderCount = 0;
        if (row === 0 || regionOf[i] !== regionOf[(row - 1) * width + col]) borderCount++;
        if (row === height - 1 || regionOf[i] !== regionOf[(row + 1) * width + col]) borderCount++;
        if (col === 0 || regionOf[i] !== regionOf[row * width + col - 1]) borderCount++;
        if (col === width - 1 || regionOf[i] !== regionOf[row * width + col + 1]) borderCount++;
        clues[i] = borderCount;
      }
    }

    const rightBorders = new Array((width - 1) * height).fill(false);
    const bottomBorders = new Array(width * (height - 1)).fill(false);

    return {
      width,
      height,
      regionSize,
      clues,
      borders: { right: rightBorders, bottom: bottomBorders },
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: PalisadeState): boolean {
    const { width, height, borders, clues, regionSize } = data;
    const total = width * height;

    const regionOf = new Array(total).fill(-1);
    let regionId = 0;

    for (let i = 0; i < total; i++) {
      if (regionOf[i] !== -1) continue;
      const stack = [i];
      const region: number[] = [];
      regionOf[i] = regionId;

      while (stack.length > 0) {
        const cell = stack.pop()!;
        region.push(cell);
        const row = Math.floor(cell / width);
        const col = cell % width;

        if (
          col < width - 1 &&
          !borders.right[row * (width - 1) + col] &&
          regionOf[cell + 1] === -1
        ) {
          regionOf[cell + 1] = regionId;
          stack.push(cell + 1);
        }
        if (col > 0 && !borders.right[row * (width - 1) + col - 1] && regionOf[cell - 1] === -1) {
          regionOf[cell - 1] = regionId;
          stack.push(cell - 1);
        }
        if (
          row < height - 1 &&
          !borders.bottom[row * width + col] &&
          regionOf[cell + width] === -1
        ) {
          regionOf[cell + width] = regionId;
          stack.push(cell + width);
        }
        if (row > 0 && !borders.bottom[(row - 1) * width + col] && regionOf[cell - width] === -1) {
          regionOf[cell - width] = regionId;
          stack.push(cell - width);
        }
      }

      if (region.length !== regionSize) return false;
      regionId++;
    }

    for (let i = 0; i < total; i++) {
      if (clues[i] !== null) {
        const row = Math.floor(i / width);
        const col = i % width;
        let borderCount = 0;
        if (row === 0 || regionOf[i] !== regionOf[(row - 1) * width + col]) borderCount++;
        if (row === height - 1 || regionOf[i] !== regionOf[(row + 1) * width + col]) borderCount++;
        if (col === 0 || regionOf[i] !== regionOf[row * width + col - 1]) borderCount++;
        if (col === width - 1 || regionOf[i] !== regionOf[row * width + col + 1]) borderCount++;
        if (borderCount !== clues[i]) return false;
      }
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PalisadeState>();

    switch (action.type) {
      case 'toggle_border': {
        const orientation = action.payload.orientation as string;
        const index = Number(action.payload.index);

        if (orientation === 'right') {
          if (index < 0 || index >= (data.width - 1) * data.height) {
            return { success: false, error: 'Invalid border index' };
          }
          data.borders.right[index] = !data.borders.right[index];
        } else if (orientation === 'bottom') {
          if (index < 0 || index >= data.width * (data.height - 1)) {
            return { success: false, error: 'Invalid border index' };
          }
          data.borders.bottom[index] = !data.borders.bottom[index];
        } else {
          return { success: false, error: 'Orientation must be right or bottom' };
        }

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
    return this.getData<PalisadeState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PalisadeState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

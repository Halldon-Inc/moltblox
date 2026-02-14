/**
 * LightUpGame (Akari): Place lights to illuminate all cells.
 * Numbers on walls indicate how many adjacent lights.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface LightUpConfig {
  size?: number;
}

interface LightUpState {
  [key: string]: unknown;
  size: number;
  walls: boolean[];
  wallNumbers: (number | null)[];
  lights: boolean[];
  lit: boolean[];
  moves: number;
  solved: boolean;
}

export class LightUpGame extends BaseGame {
  readonly name = 'Light Up';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): LightUpState {
    const cfg = this.config as LightUpConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 7, 14));
    const total = size * size;

    const walls = new Array(total).fill(false);
    const wallNumbers: (number | null)[] = new Array(total).fill(null);

    const wallCount = Math.floor(total * 0.2);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let w = 0; w < wallCount; w++) {
      walls[indices[w]] = true;
    }

    const solution = new Array(total).fill(false);
    for (let i = 0; i < total; i++) {
      if (walls[i]) continue;
      if (Math.random() < 0.15) {
        solution[i] = true;
      }
    }

    for (let i = 0; i < total; i++) {
      if (!walls[i]) continue;
      const row = Math.floor(i / size);
      const col = i % size;
      let adjacentLights = 0;
      const neighbors = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];
      for (const [r, c] of neighbors) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          if (solution[r * size + c]) adjacentLights++;
        }
      }
      if (Math.random() < 0.5) {
        wallNumbers[i] = adjacentLights;
      }
    }

    return {
      size,
      walls,
      wallNumbers,
      lights: new Array(total).fill(false),
      lit: new Array(total).fill(false),
      moves: 0,
      solved: false,
    };
  }

  private recalculateLit(data: LightUpState): void {
    const { size, walls, lights, lit } = data;
    lit.fill(false);

    for (let i = 0; i < size * size; i++) {
      if (!lights[i]) continue;
      lit[i] = true;
      const row = Math.floor(i / size);
      const col = i % size;

      const dirs = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < size && c >= 0 && c < size) {
          const idx = r * size + c;
          if (walls[idx]) break;
          lit[idx] = true;
          r += dr;
          c += dc;
        }
      }
    }
  }

  private checkSolved(data: LightUpState): boolean {
    const { size, walls, wallNumbers, lights, lit } = data;
    const total = size * size;

    for (let i = 0; i < total; i++) {
      if (!walls[i] && !lit[i]) return false;
    }

    for (let i = 0; i < total; i++) {
      if (lights[i]) {
        const row = Math.floor(i / size);
        const col = i % size;
        const dirs = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        for (const [dr, dc] of dirs) {
          let r = row + dr;
          let c = col + dc;
          while (r >= 0 && r < size && c >= 0 && c < size) {
            const idx = r * size + c;
            if (walls[idx]) break;
            if (lights[idx]) return false;
            r += dr;
            c += dc;
          }
        }
      }
    }

    for (let i = 0; i < total; i++) {
      if (wallNumbers[i] !== null) {
        const row = Math.floor(i / size);
        const col = i % size;
        let count = 0;
        const neighbors = [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1],
        ];
        for (const [r, c] of neighbors) {
          if (r >= 0 && r < size && c >= 0 && c < size) {
            if (lights[r * size + c]) count++;
          }
        }
        if (count !== wallNumbers[i]) return false;
      }
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LightUpState>();

    switch (action.type) {
      case 'toggle_light': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.walls[index]) {
          return { success: false, error: 'Cannot place light on wall' };
        }

        data.lights[index] = !data.lights[index];
        data.moves++;
        this.recalculateLit(data);

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
    return this.getData<LightUpState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<LightUpState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 15);
    return { [playerId]: score };
  }
}

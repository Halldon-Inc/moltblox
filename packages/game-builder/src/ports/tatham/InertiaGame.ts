/**
 * InertiaGame: Slide on ice. Move in direction until hitting wall/gem/mine.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface InertiaConfig {
  size?: number;
}

type CellType = 'empty' | 'wall' | 'gem' | 'mine' | 'stop';

interface InertiaState {
  [key: string]: unknown;
  size: number;
  grid: CellType[];
  playerPos: number;
  gemsCollected: number;
  totalGems: number;
  moves: number;
  gameOver: boolean;
  won: boolean;
}

export class InertiaGame extends BaseGame {
  readonly name = 'Inertia';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): InertiaState {
    const cfg = this.config as InertiaConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 8, 15));
    const total = size * size;

    const grid: CellType[] = new Array(total).fill('empty');

    const wallCount = Math.floor(total * 0.1);
    const gemCount = Math.floor(total * 0.1);
    const mineCount = Math.floor(total * 0.05);

    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    let idx = 0;
    const playerPos = indices[idx++];
    for (let w = 0; w < wallCount && idx < indices.length; w++) {
      grid[indices[idx++]] = 'wall';
    }
    for (let g = 0; g < gemCount && idx < indices.length; g++) {
      grid[indices[idx++]] = 'gem';
    }
    for (let m = 0; m < mineCount && idx < indices.length; m++) {
      grid[indices[idx++]] = 'mine';
    }

    const stopCount = Math.floor(total * 0.05);
    for (let s = 0; s < stopCount && idx < indices.length; s++) {
      grid[indices[idx++]] = 'stop';
    }

    return {
      size,
      grid,
      playerPos,
      gemsCollected: 0,
      totalGems: gemCount,
      moves: 0,
      gameOver: false,
      won: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<InertiaState>();
    if (data.gameOver) return { success: false, error: 'Game is over' };

    switch (action.type) {
      case 'move': {
        const dir = action.payload.direction as string;
        const dirMap: Record<string, [number, number]> = {
          up: [-1, 0],
          down: [1, 0],
          left: [0, -1],
          right: [0, 1],
          upleft: [-1, -1],
          upright: [-1, 1],
          downleft: [1, -1],
          downright: [1, 1],
        };

        if (!dirMap[dir]) return { success: false, error: 'Invalid direction' };
        const [dr, dc] = dirMap[dir];

        let row = Math.floor(data.playerPos / data.size);
        let col = data.playerPos % data.size;

        let moving = true;
        while (moving) {
          const nr = row + dr;
          const nc = col + dc;

          if (nr < 0 || nr >= data.size || nc < 0 || nc >= data.size) {
            moving = false;
            break;
          }

          const idx = nr * data.size + nc;
          if (data.grid[idx] === 'wall') {
            moving = false;
            break;
          }

          row = nr;
          col = nc;

          if (data.grid[idx] === 'gem') {
            data.gemsCollected++;
            data.grid[idx] = 'empty';
            moving = false;
          } else if (data.grid[idx] === 'mine') {
            data.gameOver = true;
            data.won = false;
            this.emitEvent('mine_hit', playerId, { position: idx });
            moving = false;
          } else if (data.grid[idx] === 'stop') {
            moving = false;
          }
        }

        data.playerPos = row * data.size + col;
        data.moves++;

        if (data.gemsCollected >= data.totalGems && !data.gameOver) {
          data.gameOver = true;
          data.won = true;
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
    return this.getData<InertiaState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.getData<InertiaState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<InertiaState>();
    const playerId = this.getPlayers()[0];
    if (!data.won) return { [playerId]: data.gemsCollected * 50 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

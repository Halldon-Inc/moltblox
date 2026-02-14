/**
 * CubeGame: Roll cube on grid painting faces, match target pattern
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface CubeConfig {
  size?: number;
}

interface CubeState {
  [key: string]: unknown;
  size: number;
  grid: boolean[];
  target: boolean[];
  cubePos: number;
  cubeFaces: boolean[];
  moves: number;
  solved: boolean;
}

export class CubeGame extends BaseGame {
  readonly name = 'Cube';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  // Cube faces: 0=top, 1=front, 2=right, 3=back, 4=left, 5=bottom
  private rollCube(faces: boolean[], direction: string): boolean[] {
    const f = [...faces];
    switch (direction) {
      case 'up':
        return [f[1], f[5], f[2], f[0], f[4], f[3]];
      case 'down':
        return [f[3], f[0], f[2], f[5], f[4], f[1]];
      case 'left':
        return [f[2], f[1], f[5], f[3], f[0], f[4]];
      case 'right':
        return [f[4], f[1], f[0], f[3], f[5], f[2]];
      default:
        return f;
    }
  }

  protected initializeState(_playerIds: string[]): CubeState {
    const cfg = this.config as CubeConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 4, 8));
    const total = size * size;

    const target: boolean[] = [];
    for (let i = 0; i < total; i++) {
      target.push(Math.random() < 0.4);
    }

    const startPos = Math.floor(Math.random() * total);

    return {
      size,
      grid: new Array(total).fill(false),
      target,
      cubePos: startPos,
      cubeFaces: [false, false, false, false, false, true],
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CubeState>();

    switch (action.type) {
      case 'roll': {
        const dir = action.payload.direction as string;
        if (!['up', 'down', 'left', 'right'].includes(dir)) {
          return { success: false, error: 'Direction must be up, down, left, or right' };
        }

        const row = Math.floor(data.cubePos / data.size);
        const col = data.cubePos % data.size;

        let nr = row;
        let nc = col;
        if (dir === 'up') nr--;
        if (dir === 'down') nr++;
        if (dir === 'left') nc--;
        if (dir === 'right') nc++;

        if (nr < 0 || nr >= data.size || nc < 0 || nc >= data.size) {
          return { success: false, error: 'Cannot roll off grid' };
        }

        data.cubeFaces = this.rollCube(data.cubeFaces, dir);
        data.cubePos = nr * data.size + nc;
        data.moves++;

        // Bottom face paints the grid cell
        if (data.cubeFaces[5]) {
          data.grid[data.cubePos] = !data.grid[data.cubePos];
        }

        let solved = true;
        for (let i = 0; i < data.target.length; i++) {
          if (data.grid[i] !== data.target[i]) {
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
    return this.getData<CubeState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CubeState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

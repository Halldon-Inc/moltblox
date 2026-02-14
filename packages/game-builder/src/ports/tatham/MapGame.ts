/**
 * MapGame: Four-coloring puzzle. Color regions so no adjacent regions share a color.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MapConfig {
  regionCount?: number;
}

interface MapState {
  [key: string]: unknown;
  regionCount: number;
  adjacency: boolean[][];
  colors: (number | null)[];
  numColors: number;
  moves: number;
  solved: boolean;
}

export class MapGame extends BaseGame {
  readonly name = 'Map';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MapState {
    const cfg = this.config as MapConfig;
    const regionCount = Math.max(4, Math.min(cfg.regionCount ?? 12, 30));

    const adjacency: boolean[][] = Array.from({ length: regionCount }, () =>
      new Array(regionCount).fill(false),
    );

    for (let i = 0; i < regionCount; i++) {
      const edgeCount = Math.floor(Math.random() * 3) + 1;
      for (let e = 0; e < edgeCount; e++) {
        const j = Math.floor(Math.random() * regionCount);
        if (j !== i && !adjacency[i][j]) {
          adjacency[i][j] = true;
          adjacency[j][i] = true;
        }
      }
    }

    for (let i = 1; i < regionCount; i++) {
      let hasEdge = false;
      for (let j = 0; j < i; j++) {
        if (adjacency[i][j]) {
          hasEdge = true;
          break;
        }
      }
      if (!hasEdge) {
        const j = Math.floor(Math.random() * i);
        adjacency[i][j] = true;
        adjacency[j][i] = true;
      }
    }

    return {
      regionCount,
      adjacency,
      colors: new Array(regionCount).fill(null),
      numColors: 4,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: MapState): boolean {
    for (let i = 0; i < data.regionCount; i++) {
      if (data.colors[i] === null) return false;
    }
    for (let i = 0; i < data.regionCount; i++) {
      for (let j = i + 1; j < data.regionCount; j++) {
        if (data.adjacency[i][j] && data.colors[i] === data.colors[j]) return false;
      }
    }
    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MapState>();

    switch (action.type) {
      case 'color': {
        const region = Number(action.payload.region);
        const color = Number(action.payload.color);
        if (region < 0 || region >= data.regionCount) {
          return { success: false, error: 'Invalid region' };
        }
        if (color < 0 || color >= data.numColors) {
          return { success: false, error: 'Invalid color (0-3)' };
        }

        data.colors[region] = color;
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'clear': {
        const region = Number(action.payload.region);
        if (region < 0 || region >= data.regionCount) {
          return { success: false, error: 'Invalid region' };
        }
        data.colors[region] = null;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<MapState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MapState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

/**
 * RectanglesGame (Shikaku): Divide grid into rectangles each containing exactly one number
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface RectanglesConfig {
  width?: number;
  height?: number;
}

interface Rect {
  r: number;
  c: number;
  w: number;
  h: number;
}

interface RectanglesState {
  [key: string]: unknown;
  width: number;
  height: number;
  clues: (number | null)[];
  rectangles: Rect[];
  moves: number;
  solved: boolean;
}

export class RectanglesGame extends BaseGame {
  readonly name = 'Rectangles';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): RectanglesState {
    const cfg = this.config as RectanglesConfig;
    const width = Math.max(4, Math.min(cfg.width ?? 7, 12));
    const height = Math.max(4, Math.min(cfg.height ?? 7, 12));
    const total = width * height;

    const assigned = new Array(total).fill(-1);
    const solutionRects: Rect[] = [];
    let rectId = 0;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (assigned[r * width + c] !== -1) continue;
        let maxW = 1;
        while (c + maxW < width && assigned[r * width + c + maxW] === -1) maxW++;
        let maxH = 1;
        while (r + maxH < height) {
          let rowFree = true;
          for (let cc = c; cc < c + maxW; cc++) {
            if (assigned[(r + maxH) * width + cc] !== -1) {
              rowFree = false;
              break;
            }
          }
          if (!rowFree) break;
          maxH++;
        }

        const rw = Math.min(Math.floor(Math.random() * maxW) + 1, maxW);
        const rh = Math.min(Math.floor(Math.random() * maxH) + 1, maxH);

        for (let dr = 0; dr < rh; dr++) {
          for (let dc = 0; dc < rw; dc++) {
            assigned[(r + dr) * width + (c + dc)] = rectId;
          }
        }

        solutionRects.push({ r, c, w: rw, h: rh });
        rectId++;
      }
    }

    const clues: (number | null)[] = new Array(total).fill(null);
    for (const rect of solutionRects) {
      const area = rect.w * rect.h;
      const cellR = rect.r + Math.floor(Math.random() * rect.h);
      const cellC = rect.c + Math.floor(Math.random() * rect.w);
      clues[cellR * width + cellC] = area;
    }

    return {
      width,
      height,
      clues,
      rectangles: [],
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: RectanglesState): boolean {
    const { width, height, clues, rectangles } = data;
    const total = width * height;
    const covered = new Array(total).fill(-1);

    for (let i = 0; i < rectangles.length; i++) {
      const rect = rectangles[i];
      if (rect.r < 0 || rect.c < 0 || rect.r + rect.h > height || rect.c + rect.w > width)
        return false;

      for (let dr = 0; dr < rect.h; dr++) {
        for (let dc = 0; dc < rect.w; dc++) {
          const idx = (rect.r + dr) * width + (rect.c + dc);
          if (covered[idx] !== -1) return false;
          covered[idx] = i;
        }
      }
    }

    for (let i = 0; i < total; i++) {
      if (covered[i] === -1) return false;
    }

    for (let i = 0; i < rectangles.length; i++) {
      const rect = rectangles[i];
      const area = rect.w * rect.h;
      let clueCount = 0;
      let clueValue = 0;
      for (let dr = 0; dr < rect.h; dr++) {
        for (let dc = 0; dc < rect.w; dc++) {
          const idx = (rect.r + dr) * width + (rect.c + dc);
          if (clues[idx] !== null) {
            clueCount++;
            clueValue = clues[idx]!;
          }
        }
      }
      if (clueCount !== 1 || clueValue !== area) return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RectanglesState>();

    switch (action.type) {
      case 'place_rect': {
        const r = Number(action.payload.row);
        const c = Number(action.payload.col);
        const w = Number(action.payload.width);
        const h = Number(action.payload.height);

        if (r < 0 || c < 0 || r + h > data.height || c + w > data.width || w < 1 || h < 1) {
          return { success: false, error: 'Invalid rectangle' };
        }

        data.rectangles.push({ r, c, w, h });
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'remove_rect': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.rectangles.length) {
          return { success: false, error: 'Invalid rectangle index' };
        }
        data.rectangles.splice(index, 1);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'clear': {
        data.rectangles = [];
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<RectanglesState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<RectanglesState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

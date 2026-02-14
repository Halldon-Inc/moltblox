import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface STile {
  id: number;
  type: string;
  layer: number;
  row: number;
  col: number;
  removed: boolean;
}

interface ShanghaiState {
  [key: string]: unknown;
  tiles: STile[];
  selected: number | null;
  score: number;
  stuck: boolean;
}

export class ShanghaiGame extends BaseGame {
  readonly name = 'Shanghai';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): ShanghaiState {
    const types = [
      'dragon_r',
      'dragon_g',
      'dragon_w',
      'flower',
      'season',
      'dot1',
      'dot2',
      'dot3',
      'bam1',
      'bam2',
    ];
    const tiles: STile[] = [];
    let id = 0;
    // Pyramid layout: layer 0 has 4x4, layer 1 has 2x2
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const ti = (r * 4 + c) % types.length;
        tiles.push({ id: id++, type: types[ti], layer: 0, row: r, col: c, removed: false });
      }
    // Duplicate types for matching
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const ti = (r * 4 + c) % types.length;
        tiles.push({ id: id++, type: types[ti], layer: 0, row: r, col: c + 5, removed: false });
      }
    return { tiles, selected: null, score: 0, stuck: false };
  }

  private isFree(tile: STile, tiles: STile[]): boolean {
    if (tile.removed) return false;
    const hasTop = tiles.some(
      (t) =>
        !t.removed &&
        t.layer > tile.layer &&
        Math.abs(t.row - tile.row) <= 1 &&
        Math.abs(t.col - tile.col) <= 1,
    );
    if (hasTop) return false;
    const leftBlocked = tiles.some(
      (t) => !t.removed && t.layer === tile.layer && t.row === tile.row && t.col === tile.col - 1,
    );
    const rightBlocked = tiles.some(
      (t) => !t.removed && t.layer === tile.layer && t.row === tile.row && t.col === tile.col + 1,
    );
    return !leftBlocked || !rightBlocked;
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'select') return { success: false, error: 'Use select action' };
    const d = this.getData<ShanghaiState>();
    const tileId = Number(action.payload.tileId);
    const tile = d.tiles.find((t) => t.id === tileId);
    if (!tile || tile.removed) return { success: false, error: 'Invalid tile' };
    if (!this.isFree(tile, d.tiles)) return { success: false, error: 'Tile not free' };

    if (d.selected === null) {
      d.selected = tileId;
    } else {
      const prev = d.tiles.find((t) => t.id === d.selected)!;
      if (prev.type === tile.type && prev.id !== tile.id) {
        prev.removed = true;
        tile.removed = true;
        d.score += 10;
      }
      d.selected = null;
    }

    const freeTiles = d.tiles.filter((t) => !t.removed && this.isFree(t, d.tiles));
    const tc: Record<string, number> = {};
    for (const t of freeTiles) tc[t.type] = (tc[t.type] || 0) + 1;
    if (!Object.values(tc).some((c) => c >= 2) && d.tiles.some((t) => !t.removed)) d.stuck = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<ShanghaiState>();
    return d.stuck || d.tiles.every((t) => t.removed);
  }

  protected determineWinner(): string | null {
    return this.getData<ShanghaiState>().tiles.every((t) => t.removed)
      ? this.getPlayers()[0]
      : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<ShanghaiState>().score };
  }
}

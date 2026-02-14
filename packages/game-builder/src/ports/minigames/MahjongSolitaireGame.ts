import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Tile {
  id: number;
  type: string;
  layer: number;
  row: number;
  col: number;
  removed: boolean;
}

interface MahjongSolitaireState {
  [key: string]: unknown;
  tiles: Tile[];
  selected: number | null;
  score: number;
  stuck: boolean;
}

export class MahjongSolitaireGame extends BaseGame {
  readonly name = 'Mahjong Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): MahjongSolitaireState {
    const types = [
      'bamboo1',
      'bamboo2',
      'bamboo3',
      'circle1',
      'circle2',
      'circle3',
      'char1',
      'char2',
      'char3',
      'wind_n',
      'wind_s',
      'wind_e',
    ];
    const tiles: Tile[] = [];
    let id = 0;
    // Create pairs of each type in a simple layout
    for (let i = 0; i < types.length; i++) {
      const row = Math.floor(i / 4);
      const col = (i % 4) * 2;
      tiles.push({ id: id++, type: types[i], layer: 0, row, col, removed: false });
      tiles.push({ id: id++, type: types[i], layer: 0, row, col: col + 1, removed: false });
    }
    return { tiles, selected: null, score: 0, stuck: false };
  }

  private isFree(tile: Tile, tiles: Tile[]): boolean {
    if (tile.removed) return false;
    // Free if no tile on top and at least one side open
    const hasTop = tiles.some(
      (t) =>
        !t.removed &&
        t.layer > tile.layer &&
        Math.abs(t.row - tile.row) < 1 &&
        Math.abs(t.col - tile.col) < 1,
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
    const d = this.getData<MahjongSolitaireState>();
    const tileId = Number(action.payload.tileId);
    const tile = d.tiles.find((t) => t.id === tileId);
    if (!tile || tile.removed) return { success: false, error: 'Invalid tile' };
    if (!this.isFree(tile, d.tiles)) return { success: false, error: 'Tile is not free' };

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

    // Check if stuck
    const freeTiles = d.tiles.filter((t) => !t.removed && this.isFree(t, d.tiles));
    const typeCount: Record<string, number> = {};
    for (const t of freeTiles) typeCount[t.type] = (typeCount[t.type] || 0) + 1;
    const hasPair = Object.values(typeCount).some((c) => c >= 2);
    if (!hasPair && d.tiles.some((t) => !t.removed)) d.stuck = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<MahjongSolitaireState>();
    return d.stuck || d.tiles.every((t) => t.removed);
  }

  protected determineWinner(): string | null {
    const d = this.getData<MahjongSolitaireState>();
    return d.tiles.every((t) => t.removed) ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<MahjongSolitaireState>().score };
  }
}

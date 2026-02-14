import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface CarcassonneConfig {
  maxMeeples?: number;
}

/**
 * Carcassonne: Tile-laying game. Players draw tiles, place them adjacent to
 * existing tiles matching edges, optionally place a meeple on a feature.
 * Score completed cities, roads, monasteries. Final scoring at game end.
 *
 * Simplified: tiles have 4 edges (N, E, S, W) each being 'city', 'road', or 'field'.
 * Tiles may have a monastery center.
 */

type EdgeType = 'city' | 'road' | 'field';
type Dir = 'N' | 'E' | 'S' | 'W';

interface Tile {
  id: number;
  edges: Record<Dir, EdgeType>;
  hasMonastery: boolean;
  hasShield: boolean;
}

interface PlacedTile {
  tile: Tile;
  row: number;
  col: number;
  meeple: { owner: string; feature: string } | null;
}

interface CarcassonneState {
  [key: string]: unknown;
  board: Record<string, PlacedTile>; // key = "row,col"
  tileStack: Tile[];
  currentTile: Tile | null;
  meeples: Record<string, number>;
  scores: Record<string, number>;
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
}

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIR_OFFSET: Record<Dir, [number, number]> = {
  N: [-1, 0],
  S: [1, 0],
  E: [0, 1],
  W: [0, -1],
};
const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

function generateTiles(): Tile[] {
  let id = 1;
  const tiles: Tile[] = [];
  const add = (count: number, edges: Record<Dir, EdgeType>, mon: boolean, shield: boolean) => {
    for (let i = 0; i < count; i++) {
      tiles.push({ id: id++, edges: { ...edges }, hasMonastery: mon, hasShield: shield });
    }
  };

  // Standard Carcassonne tile distribution (simplified)
  add(4, { N: 'road', E: 'field', S: 'road', W: 'field' }, false, false); // straight road
  add(8, { N: 'road', E: 'road', S: 'field', W: 'field' }, false, false); // road curve
  add(4, { N: 'road', E: 'road', S: 'road', W: 'field' }, false, false); // 3-way road
  add(1, { N: 'road', E: 'road', S: 'road', W: 'road' }, false, false); // 4-way road
  add(5, { N: 'city', E: 'field', S: 'field', W: 'field' }, false, false); // city edge
  add(3, { N: 'city', E: 'city', S: 'field', W: 'field' }, false, false); // city corner
  add(3, { N: 'city', E: 'field', S: 'city', W: 'field' }, false, true); // city opposite + shield
  add(1, { N: 'city', E: 'city', S: 'city', W: 'city' }, false, true); // full city
  add(4, { N: 'field', E: 'field', S: 'field', W: 'field' }, true, false); // monastery
  add(2, { N: 'road', E: 'field', S: 'field', W: 'field' }, true, false); // monastery + road
  add(3, { N: 'city', E: 'road', S: 'road', W: 'field' }, false, false); // city + road
  add(3, { N: 'city', E: 'city', S: 'road', W: 'road' }, false, false); // city + roads
  add(2, { N: 'city', E: 'city', S: 'city', W: 'road' }, false, false); // 3 city + road

  // Shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export class CarcassonneGame extends BaseGame {
  readonly name = 'Carcassonne';
  readonly version = '1.0.0';
  readonly maxPlayers = 5;

  protected initializeState(playerIds: string[]): CarcassonneState {
    const maxMeeples = (this.config as CarcassonneConfig).maxMeeples ?? 7;
    const tileStack = generateTiles();
    // Place starting tile at 0,0
    const startTile: Tile = {
      id: 0,
      edges: { N: 'city', E: 'road', S: 'field', W: 'road' },
      hasMonastery: false,
      hasShield: false,
    };
    const board: Record<string, PlacedTile> = {};
    board['0,0'] = { tile: startTile, row: 0, col: 0, meeple: null };

    const meeples: Record<string, number> = {};
    const scores: Record<string, number> = {};
    for (const pid of playerIds) {
      meeples[pid] = maxMeeples;
      scores[pid] = 0;
    }

    return {
      board,
      tileStack,
      currentTile: tileStack.pop() ?? null,
      meeples,
      scores,
      currentPlayer: 0,
      winner: null,
      gameEnded: false,
    };
  }

  private key(r: number, c: number): string {
    return `${r},${c}`;
  }

  private fitsAt(board: Record<string, PlacedTile>, tile: Tile, row: number, col: number): boolean {
    let hasNeighbor = false;
    for (const dir of DIRS) {
      const [dr, dc] = DIR_OFFSET[dir];
      const nk = this.key(row + dr, col + dc);
      const neighbor = board[nk];
      if (neighbor) {
        hasNeighbor = true;
        if (neighbor.tile.edges[OPPOSITE[dir]] !== tile.edges[dir]) return false;
      }
    }
    return hasNeighbor;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CarcassonneState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type !== 'place_tile') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    if (!data.currentTile) {
      return { success: false, error: 'No tile to place' };
    }

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    const rotation = Number(action.payload.rotation ?? 0); // 0, 90, 180, 270
    const meepleFeature = action.payload.meeple as string | undefined; // 'N', 'E', 'S', 'W', 'monastery'

    if (isNaN(row) || isNaN(col)) {
      return { success: false, error: 'Invalid position' };
    }

    const k = this.key(row, col);
    if (data.board[k]) {
      return { success: false, error: 'Position already occupied' };
    }

    // Apply rotation
    const tile = { ...data.currentTile, edges: { ...data.currentTile.edges } };
    const rotSteps = Math.round((rotation % 360) / 90);
    for (let s = 0; s < rotSteps; s++) {
      const old = { ...tile.edges };
      tile.edges.N = old.W;
      tile.edges.E = old.N;
      tile.edges.S = old.E;
      tile.edges.W = old.S;
    }

    if (!this.fitsAt(data.board, tile, row, col)) {
      return { success: false, error: 'Tile does not match adjacent edges' };
    }

    const placed: PlacedTile = { tile, row, col, meeple: null };

    if (meepleFeature) {
      if (data.meeples[playerId] <= 0) {
        return { success: false, error: 'No meeples remaining' };
      }
      placed.meeple = { owner: playerId, feature: meepleFeature };
      data.meeples[playerId]--;
    }

    data.board[k] = placed;

    // Simple scoring: score completed roads and cities adjacent
    this.scoreCompletedFeatures(data);

    // Draw next tile
    data.currentTile = data.tileStack.pop() ?? null;
    if (data.currentTile === null) {
      // Game over: final scoring
      this.finalScoring(data);
      data.gameEnded = true;
      let best: string | null = null;
      let bestScore = -1;
      for (const pid of players) {
        if (data.scores[pid] > bestScore) {
          bestScore = data.scores[pid];
          best = pid;
        }
      }
      data.winner = best;
    }

    data.currentPlayer = (pIdx + 1) % players.length;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private scoreCompletedFeatures(data: CarcassonneState): void {
    // Score completed monasteries (surrounded on all 8 sides)
    for (const k of Object.keys(data.board)) {
      const pt = data.board[k];
      if (!pt.tile.hasMonastery || !pt.meeple || pt.meeple.feature !== 'monastery') continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (data.board[this.key(pt.row + dr, pt.col + dc)]) count++;
        }
      }
      if (count === 8) {
        data.scores[pt.meeple.owner] += 9;
        data.meeples[pt.meeple.owner]++;
        pt.meeple = null;
        this.emitEvent('monastery_complete', undefined, { row: pt.row, col: pt.col });
      }
    }
  }

  private finalScoring(data: CarcassonneState): void {
    // Return all meeples and give partial scores
    for (const k of Object.keys(data.board)) {
      const pt = data.board[k];
      if (!pt.meeple) continue;
      // Simple: 1 point per meeple on incomplete feature
      data.scores[pt.meeple.owner] += 1;
      data.meeples[pt.meeple.owner]++;
      pt.meeple = null;
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<CarcassonneState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<CarcassonneState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<CarcassonneState>().scores };
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface AzulConfig {
  playerCount?: number;
}

/**
 * Azul: Tile-drafting game. Players draft tiles from factories,
 * fill pattern lines, and score for wall placement.
 * 5 tile colors, 5x5 wall grid, 5 pattern lines (sizes 1-5).
 */

type TileColor = 0 | 1 | 2 | 3 | 4; // 5 colors
const NUM_COLORS = 5;
const WALL_SIZE = 5;

interface PlayerBoard {
  patternLines: (TileColor | null)[][]; // patternLines[i] has i+1 slots
  patternLineCounts: number[];
  patternLineColor: (TileColor | null)[];
  wall: boolean[][]; // 5x5, true = tile placed
  floorLine: number; // penalty tiles count
  score: number;
}

interface AzulState {
  [key: string]: unknown;
  factories: TileColor[][];
  center: TileColor[];
  playerBoards: Record<string, PlayerBoard>;
  currentPlayer: number;
  firstPlayerNext: string | null;
  round: number;
  bag: TileColor[];
  discard: TileColor[];
  winner: string | null;
  gameEnded: boolean;
}

// Wall pattern: each row has colors shifted
function wallColor(row: number, col: number): TileColor {
  return ((col + row) % NUM_COLORS) as TileColor;
}

export class AzulGame extends BaseGame {
  readonly name = 'Azul';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private createBag(): TileColor[] {
    const bag: TileColor[] = [];
    for (let color = 0; color < NUM_COLORS; color++) {
      for (let i = 0; i < 20; i++) bag.push(color as TileColor);
    }
    // Shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  private drawFromBag(bag: TileColor[], discard: TileColor[], count: number): TileColor[] {
    const drawn: TileColor[] = [];
    for (let i = 0; i < count; i++) {
      if (bag.length === 0) {
        // Refill from discard
        bag.push(...discard.splice(0, discard.length));
        for (let j = bag.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [bag[j], bag[k]] = [bag[k], bag[j]];
        }
      }
      if (bag.length === 0) break;
      drawn.push(bag.pop()!);
    }
    return drawn;
  }

  private createPlayerBoard(): PlayerBoard {
    return {
      patternLines: Array.from({ length: WALL_SIZE }, (_, i) => Array(i + 1).fill(null)),
      patternLineCounts: Array(WALL_SIZE).fill(0),
      patternLineColor: Array(WALL_SIZE).fill(null),
      wall: Array.from({ length: WALL_SIZE }, () => Array(WALL_SIZE).fill(false)),
      floorLine: 0,
      score: 0,
    };
  }

  private fillFactories(data: AzulState, playerCount: number): void {
    const numFactories = playerCount * 2 + 1;
    data.factories = [];
    for (let i = 0; i < numFactories; i++) {
      data.factories.push(this.drawFromBag(data.bag, data.discard, 4));
    }
    data.center = [];
  }

  protected initializeState(playerIds: string[]): AzulState {
    const bag = this.createBag();
    const discard: TileColor[] = [];
    const playerBoards: Record<string, PlayerBoard> = {};
    for (const pid of playerIds) playerBoards[pid] = this.createPlayerBoard();

    const data: AzulState = {
      factories: [],
      center: [],
      playerBoards,
      currentPlayer: 0,
      firstPlayerNext: null,
      round: 1,
      bag,
      discard,
      winner: null,
      gameEnded: false,
    };
    this.fillFactories(data, playerIds.length);
    return data;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<AzulState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type !== 'draft') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const sourceType = action.payload.source as string; // 'factory' or 'center'
    const sourceIdx = Number(action.payload.factoryIndex ?? 0);
    const color = Number(action.payload.color) as TileColor;
    const lineIdx = Number(action.payload.line); // 0-4, or -1 for floor

    if (color < 0 || color >= NUM_COLORS) {
      return { success: false, error: 'Invalid color' };
    }

    let tiles: TileColor[];
    let remainder: TileColor[];

    if (sourceType === 'factory') {
      if (sourceIdx < 0 || sourceIdx >= data.factories.length) {
        return { success: false, error: 'Invalid factory index' };
      }
      const factory = data.factories[sourceIdx];
      if (factory.length === 0) {
        return { success: false, error: 'Factory is empty' };
      }
      tiles = factory.filter((t) => t === color);
      if (tiles.length === 0) {
        return { success: false, error: 'Color not in factory' };
      }
      remainder = factory.filter((t) => t !== color);
      data.factories[sourceIdx] = [];
      data.center.push(...remainder);
    } else if (sourceType === 'center') {
      tiles = data.center.filter((t) => t === color);
      if (tiles.length === 0) {
        return { success: false, error: 'Color not in center' };
      }
      data.center = data.center.filter((t) => t !== color);
      if (data.firstPlayerNext === null) {
        data.firstPlayerNext = playerId;
        const pb = data.playerBoards[playerId];
        pb.floorLine++;
      }
    } else {
      return { success: false, error: 'Source must be factory or center' };
    }

    const pb = data.playerBoards[playerId];

    if (lineIdx >= 0 && lineIdx < WALL_SIZE) {
      // Check wall column for this color
      const wallCol = this.getWallCol(lineIdx, color);
      if (pb.wall[lineIdx][wallCol]) {
        return { success: false, error: 'Color already on wall in this row' };
      }
      if (pb.patternLineColor[lineIdx] !== null && pb.patternLineColor[lineIdx] !== color) {
        return { success: false, error: 'Pattern line has a different color' };
      }
      const capacity = lineIdx + 1;
      const space = capacity - pb.patternLineCounts[lineIdx];
      const placed = Math.min(tiles.length, space);
      pb.patternLineCounts[lineIdx] += placed;
      pb.patternLineColor[lineIdx] = color;
      // Overflow goes to floor
      pb.floorLine += tiles.length - placed;
    } else {
      // All to floor
      pb.floorLine += tiles.length;
    }

    // Check if round ends (all factories and center empty)
    const roundOver = data.factories.every((f) => f.length === 0) && data.center.length === 0;

    if (roundOver) {
      this.scoreRound(data, players);
      // Check end condition: any player has a completed row
      let ended = false;
      for (const pid of players) {
        for (let row = 0; row < WALL_SIZE; row++) {
          if (data.playerBoards[pid].wall[row].every(Boolean)) {
            ended = true;
            break;
          }
        }
        if (ended) break;
      }

      if (ended) {
        this.applyEndBonuses(data, players);
        data.gameEnded = true;
        let best: string | null = null;
        let bestScore = -1;
        for (const pid of players) {
          if (data.playerBoards[pid].score > bestScore) {
            bestScore = data.playerBoards[pid].score;
            best = pid;
          }
        }
        data.winner = best;
      } else {
        data.round++;
        this.fillFactories(data, players.length);
        if (data.firstPlayerNext) {
          data.currentPlayer = players.indexOf(data.firstPlayerNext);
        }
        data.firstPlayerNext = null;
      }
    } else {
      data.currentPlayer = (pIdx + 1) % players.length;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getWallCol(row: number, color: TileColor): number {
    for (let c = 0; c < WALL_SIZE; c++) {
      if (wallColor(row, c) === color) return c;
    }
    return 0;
  }

  private scoreRound(data: AzulState, players: string[]): void {
    const floorPenalties = [-1, -1, -2, -2, -2, -3, -3];
    for (const pid of players) {
      const pb = data.playerBoards[pid];
      for (let row = 0; row < WALL_SIZE; row++) {
        if (pb.patternLineCounts[row] === row + 1) {
          const color = pb.patternLineColor[row]!;
          const col = this.getWallCol(row, color);
          pb.wall[row][col] = true;
          // Score: count contiguous horizontal + vertical
          let points = 1;
          let h = 0;
          for (let c = col - 1; c >= 0 && pb.wall[row][c]; c--) h++;
          for (let c = col + 1; c < WALL_SIZE && pb.wall[row][c]; c++) h++;
          let v = 0;
          for (let r = row - 1; r >= 0 && pb.wall[r][col]; r--) v++;
          for (let r = row + 1; r < WALL_SIZE && pb.wall[r][col]; r++) v++;
          if (h > 0) points += h;
          if (v > 0) points += v;
          pb.score += points;
          // Clear pattern line
          pb.patternLineCounts[row] = 0;
          pb.patternLineColor[row] = null;
          // Move extra tiles to discard
          for (let i = 0; i < row; i++) data.discard.push(color);
        }
      }
      // Floor penalty
      let penalty = 0;
      for (let i = 0; i < Math.min(pb.floorLine, floorPenalties.length); i++) {
        penalty += floorPenalties[i];
      }
      pb.score = Math.max(0, pb.score + penalty);
      pb.floorLine = 0;
    }
  }

  private applyEndBonuses(data: AzulState, players: string[]): void {
    for (const pid of players) {
      const pb = data.playerBoards[pid];
      // Complete rows: +2 each
      for (let r = 0; r < WALL_SIZE; r++) {
        if (pb.wall[r].every(Boolean)) pb.score += 2;
      }
      // Complete columns: +7 each
      for (let c = 0; c < WALL_SIZE; c++) {
        let full = true;
        for (let r = 0; r < WALL_SIZE; r++) {
          if (!pb.wall[r][c]) {
            full = false;
            break;
          }
        }
        if (full) pb.score += 7;
      }
      // Complete colors: +10 each
      for (let color = 0; color < NUM_COLORS; color++) {
        let count = 0;
        for (let r = 0; r < WALL_SIZE; r++) {
          const col = this.getWallCol(r, color as TileColor);
          if (pb.wall[r][col]) count++;
        }
        if (count === WALL_SIZE) pb.score += 10;
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<AzulState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<AzulState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<AzulState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = data.playerBoards[p]?.score ?? 0;
    return scores;
  }
}

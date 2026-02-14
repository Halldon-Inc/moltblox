import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

/**
 * Chinese Checkers on a star-shaped board (6-pointed star).
 * Simplified hex representation: board is a 17x17 grid where valid cells form the star.
 * Players hop pieces across the board to reach the opposite triangle.
 */

interface ChineseCheckersState {
  [key: string]: unknown;
  board: (number | null)[][]; // null=invalid, -1=empty valid, 0-5=player index
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
  playerTriangles: Record<number, [number, number][]>; // start positions per player
  targetTriangles: Record<number, [number, number][]>; // goal positions per player
}

// Define the star board valid positions and triangles
const BOARD_SIZE = 17;

function isValidCell(r: number, c: number): boolean {
  // Center diamond: rows 4-12, with appropriate column ranges
  if (r >= 4 && r <= 12) {
    const minC = Math.max(0, 4 - (r - 4));
    const maxC = Math.min(16, 12 + (r - 4));
    if (r <= 8) {
      return c >= 8 - (r - 4) && c <= 8 + (r - 4) && (c + r) % 2 === 0;
    } else {
      return c >= 8 - (12 - r) && c <= 8 + (12 - r) && (c + r) % 2 === 0;
    }
  }
  // Top triangle (rows 0-3)
  if (r >= 0 && r <= 3) {
    return c >= 8 - r && c <= 8 + r && (c + r) % 2 === 0;
  }
  // Bottom triangle (rows 13-16)
  if (r >= 13 && r <= 16) {
    return c >= 8 - (16 - r) && c <= 8 + (16 - r) && (c + r) % 2 === 0;
  }
  return false;
}

function getTriangle(startRow: number, endRow: number, direction: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = startRow; direction > 0 ? r <= endRow : r >= endRow; r += direction) {
    const dist = direction > 0 ? r - startRow : startRow - r;
    for (let c = 8 - dist; c <= 8 + dist; c++) {
      if ((c + r) % 2 === 0) cells.push([r, c]);
    }
  }
  return cells;
}

export class ChineseCheckersGame extends BaseGame {
  readonly name = 'Chinese Checkers';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): ChineseCheckersState {
    const board: (number | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(null),
    );

    // Mark valid cells as empty
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isValidCell(r, c)) board[r][c] = -1;
      }
    }

    // Top triangle = player 0, bottom = player 1 (for 2 players)
    const topTriangle = getTriangle(0, 3, 1);
    const bottomTriangle = getTriangle(16, 13, -1);

    const playerTriangles: Record<number, [number, number][]> = {
      0: topTriangle,
      1: bottomTriangle,
    };
    const targetTriangles: Record<number, [number, number][]> = {
      0: bottomTriangle,
      1: topTriangle,
    };

    // Place pieces
    for (let i = 0; i < Math.min(playerIds.length, 2); i++) {
      for (const [r, c] of playerTriangles[i]) {
        board[r][c] = i;
      }
    }

    return {
      board,
      currentPlayer: 0,
      winner: null,
      gameEnded: false,
      playerTriangles,
      targetTriangles,
    };
  }

  private canHop(
    board: (number | null)[][],
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    const midR = (fromR + toR) / 2;
    const midC = (fromC + toC) / 2;
    if (!Number.isInteger(midR) || !Number.isInteger(midC)) return false;
    if (midR < 0 || midR >= BOARD_SIZE || midC < 0 || midC >= BOARD_SIZE) return false;
    if (toR < 0 || toR >= BOARD_SIZE || toC < 0 || toC >= BOARD_SIZE) return false;
    if (board[toR][toC] !== -1) return false; // destination must be empty
    if (board[midR][midC] === null || board[midR][midC] === -1) return false; // must hop over a piece
    return true;
  }

  private isAdjacent(fromR: number, fromC: number, toR: number, toC: number): boolean {
    const dr = Math.abs(toR - fromR);
    const dc = Math.abs(toC - fromC);
    return (dr === 1 && dc === 1) || (dr === 0 && dc === 2);
  }

  private canReach(
    board: (number | null)[][],
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    // BFS for hop chains
    if (this.isAdjacent(fromR, fromC, toR, toC) && board[toR][toC] === -1) return true;

    const visited = new Set<string>();
    const queue: [number, number][] = [[fromR, fromC]];
    visited.add(`${fromR},${fromC}`);

    const hopDirs = [
      [-2, -2],
      [-2, 0],
      [-2, 2],
      [0, -4],
      [0, 4],
      [2, -2],
      [2, 0],
      [2, 2],
    ];

    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      for (const [dr, dc] of hopDirs) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr === toR && nc === toC && this.canHop(board, cr, cc, nr, nc)) return true;
        if (
          nr >= 0 &&
          nr < BOARD_SIZE &&
          nc >= 0 &&
          nc < BOARD_SIZE &&
          !visited.has(`${nr},${nc}`)
        ) {
          if (this.canHop(board, cr, cc, nr, nc)) {
            visited.add(`${nr},${nc}`);
            queue.push([nr, nc]);
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ChineseCheckersState>();
    const players = this.getPlayers();
    const currentId = players[data.currentPlayer];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: 'Must move a piece' };

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);
    const pIdx = data.currentPlayer;

    if (data.board[fromR]?.[fromC] !== pIdx) {
      return { success: false, error: 'Not your piece' };
    }
    if (data.board[toR]?.[toC] !== -1) {
      return { success: false, error: 'Destination not empty' };
    }

    if (!this.canReach(data.board, fromR, fromC, toR, toC)) {
      return { success: false, error: 'Cannot reach destination' };
    }

    data.board[fromR][fromC] = -1;
    data.board[toR][toC] = pIdx;

    // Check if all pieces in target triangle
    const targets = data.targetTriangles[pIdx];
    if (targets) {
      const allInTarget = targets.every(([r, c]) => data.board[r][c] === pIdx);
      if (allInTarget) {
        data.gameEnded = true;
        data.winner = playerId;
      }
    }

    data.currentPlayer = (data.currentPlayer + 1) % players.length;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<ChineseCheckersState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<ChineseCheckersState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ChineseCheckersState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    for (let i = 0; i < players.length; i++) {
      const targets = data.targetTriangles[i] || [];
      const inTarget = targets.filter(([r, c]) => data.board[r][c] === i).length;
      scores[players[i]] = inTarget * 10;
    }
    return scores;
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TablutConfig {
  boardSize?: number;
}

/**
 * Tablut: Viking board game (Hnefatafl family).
 * 9x9 board. Defender (player 0) has a king + 8 defenders.
 * Attacker (player 1) has 16 pieces. King wins by reaching a corner.
 * Attackers win by surrounding the king on all 4 sides.
 * Pieces are captured by custodial capture (sandwiched between two enemies).
 * The throne (center, 4,4) and corners act as hostile squares.
 */

interface TablutState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  winner: string | null;
  kingPos: [number, number];
}

type Piece = 'K' | 'D' | 'A';

const SIZE = 9;
const CENTER: [number, number] = [4, 4];
const CORNERS: [number, number][] = [
  [0, 0],
  [0, 8],
  [8, 0],
  [8, 8],
];

function isCorner(r: number, c: number): boolean {
  return CORNERS.some(([cr, cc]) => cr === r && cc === c);
}

function isCenter(r: number, c: number): boolean {
  return r === CENTER[0] && c === CENTER[1];
}

function isHostile(r: number, c: number): boolean {
  return isCorner(r, c) || isCenter(r, c);
}

function initialBoard(): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  // King
  board[4][4] = 'K';
  // Defenders around king
  const defenders: [number, number][] = [
    [2, 4],
    [3, 4],
    [5, 4],
    [6, 4],
    [4, 2],
    [4, 3],
    [4, 5],
    [4, 6],
  ];
  for (const [r, c] of defenders) board[r][c] = 'D';
  // Attackers
  const attackers: [number, number][] = [
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 4],
    [8, 3],
    [8, 4],
    [8, 5],
    [7, 4],
    [3, 0],
    [4, 0],
    [5, 0],
    [4, 1],
    [3, 8],
    [4, 8],
    [5, 8],
    [4, 7],
  ];
  for (const [r, c] of attackers) board[r][c] = 'A';
  return board;
}

export class TablutGame extends BaseGame {
  readonly name = 'Tablut';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(_playerIds: string[]): TablutState {
    return {
      board: initialBoard(),
      currentPlayer: 0,
      winner: null,
      kingPos: [4, 4],
    };
  }

  private isOwnPiece(piece: string | null, playerIdx: number): boolean {
    if (piece === null) return false;
    if (playerIdx === 0) return piece === 'K' || piece === 'D';
    return piece === 'A';
  }

  private isEnemyOrHostile(
    board: (string | null)[][],
    r: number,
    c: number,
    playerIdx: number,
  ): boolean {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (isHostile(r, c) && board[r][c] === null) return true;
    const piece = board[r][c];
    if (piece === null) return false;
    return !this.isOwnPiece(piece, playerIdx);
  }

  private checkCaptures(data: TablutState, r: number, c: number, playerIdx: number): void {
    const dirs: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of dirs) {
      const er = r + dr;
      const ec = c + dc;
      if (er < 0 || er >= SIZE || ec < 0 || ec >= SIZE) continue;
      const enemy = data.board[er][ec];
      if (enemy === null || this.isOwnPiece(enemy, playerIdx)) continue;
      // Enemy piece found; check if sandwiched
      if (enemy === 'K') {
        // King requires surrounding on all 4 sides
        this.checkKingCapture(data, er, ec, playerIdx);
        continue;
      }
      const br = er + dr;
      const bc = ec + dc;
      if (this.isEnemyOrHostile(data.board, br, bc, 1 - playerIdx)) {
        data.board[er][ec] = null;
        this.emitEvent('capture', undefined, { row: er, col: ec, piece: enemy });
      }
    }
  }

  private checkKingCapture(data: TablutState, kr: number, kc: number, _attackerIdx: number): void {
    const dirs: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    let surrounded = true;
    for (const [dr, dc] of dirs) {
      const nr = kr + dr;
      const nc = kc + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      const adj = data.board[nr][nc];
      if (adj !== 'A' && !isHostile(nr, nc)) {
        surrounded = false;
        break;
      }
      if (isHostile(nr, nc) && adj !== null && adj !== 'A') {
        surrounded = false;
        break;
      }
    }
    if (surrounded) {
      data.board[kr][kc] = null;
      data.winner = this.getPlayers()[1]; // Attacker wins
      this.emitEvent('king_captured', undefined, { row: kr, col: kc });
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TablutState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'move') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v) || v < 0 || v >= SIZE)) {
      return { success: false, error: 'Invalid coordinates' };
    }

    const piece = data.board[fromR][fromC];
    if (!piece || !this.isOwnPiece(piece, pIdx)) {
      return { success: false, error: 'No valid piece at source' };
    }

    // Must move in a straight line (rook-like)
    if (fromR !== toR && fromC !== toC) {
      return { success: false, error: 'Must move in a straight line' };
    }
    if (fromR === toR && fromC === toC) {
      return { success: false, error: 'Must move to a different position' };
    }

    // Cannot land on occupied, corner (except king), or center (except king)
    if (data.board[toR][toC] !== null) {
      return { success: false, error: 'Destination occupied' };
    }
    if (isCorner(toR, toC) && piece !== 'K') {
      return { success: false, error: 'Only the king may enter corners' };
    }
    if (isCenter(toR, toC) && piece !== 'K') {
      return { success: false, error: 'Only the king may enter the throne' };
    }

    // Check path is clear
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let cr = fromR + dr;
    let cc = fromC + dc;
    while (cr !== toR || cc !== toC) {
      if (data.board[cr][cc] !== null) {
        return { success: false, error: 'Path is blocked' };
      }
      if (isCenter(cr, cc) && piece !== 'K') {
        return { success: false, error: 'Cannot pass through the throne' };
      }
      cr += dr;
      cc += dc;
    }

    // Execute move
    data.board[fromR][fromC] = null;
    data.board[toR][toC] = piece;

    if (piece === 'K') {
      data.kingPos = [toR, toC];
      // King reaches corner: defender wins
      if (isCorner(toR, toC)) {
        data.winner = players[0];
        this.emitEvent('king_escaped', playerId, { row: toR, col: toC });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
    }

    // Check captures
    this.checkCaptures(data, toR, toC, pIdx);

    data.currentPlayer = 1 - pIdx;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<TablutState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<TablutState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}

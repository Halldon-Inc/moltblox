import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  createEmptyBoard,
  inBounds,
  isPathClear,
} from './chessHelpers.js';

// Extended piece types for Capablanca chess
type CapaPieceType = PieceType | 'A' | 'C'; // A=Archbishop (B+N), C=Chancellor (R+N)

interface CapaPiece {
  type: CapaPieceType;
  owner: string;
  moved: boolean;
}

type CapaBoard = (CapaPiece | null)[][];

interface CapablancaState {
  [key: string]: unknown;
  board: CapaBoard;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class CapablancaChessGame extends BaseGame {
  readonly name = 'Capablanca Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private readonly COLS = 10;
  private readonly ROWS = 8;

  protected initializeState(playerIds: string[]): CapablancaState {
    // 10x8 board: R N A B Q K B C N R
    const board: CapaBoard = [];
    for (let r = 0; r < 8; r++) board.push(Array(10).fill(null));

    const backRow: CapaPieceType[] = ['R', 'N', 'A', 'B', 'Q', 'K', 'B', 'C', 'N', 'R'];
    for (let c = 0; c < 10; c++) {
      board[0][c] = { type: backRow[c], owner: playerIds[1], moved: false };
      board[1][c] = { type: 'P', owner: playerIds[1], moved: false };
      board[6][c] = { type: 'P', owner: playerIds[0], moved: false };
      board[7][c] = { type: backRow[c], owner: playerIds[0], moved: false };
    }

    return {
      board,
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
      halfMoveClock: 0,
      castlingRights: [
        { kingSide: true, queenSide: true },
        { kingSide: true, queenSide: true },
      ],
    };
  }

  private isPseudoLegal(
    board: CapaBoard,
    piece: CapaPiece,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    playerIdx: number,
    ep: [number, number] | null,
  ): boolean {
    if (!inBounds(toR, toC, this.ROWS, this.COLS)) return false;
    if (fromR === toR && fromC === toC) return false;
    const target = board[toR][toC];
    if (target && target.owner === piece.owner) return false;

    const dr = toR - fromR;
    const dc = toC - fromC;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    switch (piece.type) {
      case 'P': {
        const forward = playerIdx === 0 ? -1 : 1;
        if (dc === 0 && dr === forward && !target) return true;
        if (
          dc === 0 &&
          dr === 2 * forward &&
          !piece.moved &&
          !target &&
          !board[fromR + forward][fromC]
        )
          return true;
        if (absDc === 1 && dr === forward) {
          if (target && target.owner !== piece.owner) return true;
          if (ep && toR === ep[0] && toC === ep[1]) return true;
        }
        return false;
      }
      case 'N':
        return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
      case 'B':
        return absDr === absDc && isPathClear(board as Board, fromR, fromC, toR, toC);
      case 'R':
        return (dr === 0 || dc === 0) && isPathClear(board as Board, fromR, fromC, toR, toC);
      case 'Q':
        return (
          (absDr === absDc || dr === 0 || dc === 0) &&
          isPathClear(board as Board, fromR, fromC, toR, toC)
        );
      case 'K':
        return absDr <= 1 && absDc <= 1;
      case 'A': // Archbishop: Bishop + Knight
        return (
          (absDr === absDc && isPathClear(board as Board, fromR, fromC, toR, toC)) ||
          (absDr === 2 && absDc === 1) ||
          (absDr === 1 && absDc === 2)
        );
      case 'C': // Chancellor: Rook + Knight
        return (
          ((dr === 0 || dc === 0) && isPathClear(board as Board, fromR, fromC, toR, toC)) ||
          (absDr === 2 && absDc === 1) ||
          (absDr === 1 && absDc === 2)
        );
    }
  }

  private findKing(board: CapaBoard, player: string): [number, number] | null {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const p = board[r][c];
        if (p && p.type === 'K' && p.owner === player) return [r, c];
      }
    }
    return null;
  }

  private isInCheck(
    board: CapaBoard,
    player: string,
    players: string[],
    ep: [number, number] | null,
  ): boolean {
    const king = this.findKing(board, player);
    if (!king) return false;
    const [kr, kc] = king;
    for (let i = 0; i < players.length; i++) {
      if (players[i] === player) continue;
      for (let r = 0; r < this.ROWS; r++) {
        for (let c = 0; c < this.COLS; c++) {
          const p = board[r][c];
          if (p && p.owner === players[i]) {
            if (this.isPseudoLegal(board, p, r, c, kr, kc, i, ep)) return true;
          }
        }
      }
    }
    return false;
  }

  private isLegal(
    board: CapaBoard,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    player: string,
    playerIdx: number,
    players: string[],
    ep: [number, number] | null,
  ): boolean {
    const piece = board[fromR][fromC];
    if (!piece || piece.owner !== player) return false;
    if (!this.isPseudoLegal(board, piece, fromR, fromC, toR, toC, playerIdx, ep)) return false;

    const saved = board[toR][toC];
    board[toR][toC] = piece;
    board[fromR][fromC] = null;
    let epCapture = false;
    let savedEp: CapaPiece | null = null;
    if (piece.type === 'P' && ep && toR === ep[0] && toC === ep[1]) {
      savedEp = board[fromR][toC];
      board[fromR][toC] = null;
      epCapture = true;
    }
    const inCheck = this.isInCheck(board, player, players, ep);
    board[fromR][fromC] = piece;
    board[toR][toC] = saved;
    if (epCapture) board[fromR][toC] = savedEp;
    return !inCheck;
  }

  private hasAnyMove(
    board: CapaBoard,
    player: string,
    playerIdx: number,
    players: string[],
    ep: [number, number] | null,
  ): boolean {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const piece = board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < this.ROWS; tr++) {
          for (let tc = 0; tc < this.COLS; tc++) {
            if (this.isLegal(board, r, c, tr, tc, player, playerIdx, players, ep)) return true;
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CapablancaState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    if (
      !this.isLegal(
        data.board,
        fromR,
        fromC,
        toR,
        toC,
        playerId,
        data.currentPlayer,
        players,
        data.enPassantTarget,
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    const piece = data.board[fromR][fromC]!;
    const captured = data.board[toR][toC];

    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
    }

    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    // Promotion (can also promote to A or C)
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as CapaPieceType | undefined;
      const valid: CapaPieceType[] = ['Q', 'R', 'B', 'N', 'A', 'C'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }

    if (piece.type === 'P' || captured) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    const opponent = players[data.currentPlayer];
    const inCheck = this.isInCheck(data.board, opponent, players, data.enPassantTarget);
    const hasMoves = this.hasAnyMove(
      data.board,
      opponent,
      data.currentPlayer,
      players,
      data.enPassantTarget,
    );

    if (!hasMoves) {
      if (inCheck) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        data.draw = true;
      }
    }
    if (data.halfMoveClock >= 100) data.draw = true;

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    // Support a-j for 10 columns
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CapablancaState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<CapablancaState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CapablancaState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}

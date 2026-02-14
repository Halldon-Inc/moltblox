import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  createEmptyBoard,
  inBounds,
  isPathClear,
  findKing,
  isKingInCheck,
  isLegalMoveStandard,
  hasAnyLegalMove,
} from './chessHelpers.js';

// Makruk pieces: K, Met(Queen), Khon(Bishop), Horse(N), Rook(R), Bia(Pawn)
// Met moves 1 step diagonally (like Silver General forward diag)
// Khon moves 1 step diag or 1 step forward (like Silver General)
// Bia promotes to Met on rank 6 (relative to mover)

type MakrukPiece = 'K' | 'M' | 'S' | 'N' | 'R' | 'P'; // M=Met(queen), S=Khon(bishop)

interface MPiece {
  type: MakrukPiece;
  owner: string;
  moved: boolean;
}

type MBoard = (MPiece | null)[][];

interface MakrukState {
  [key: string]: unknown;
  board: MBoard;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  halfMoveClock: number;
}

export class MakrukGame extends BaseGame {
  readonly name = 'Makruk';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): MakrukState {
    const board: MBoard = [];
    for (let r = 0; r < 8; r++) board.push(Array(8).fill(null));

    const p0 = playerIds[0]; // White (bottom)
    const p1 = playerIds[1]; // Black (top)

    // Black (top, row 0-1)
    const blackBack: MakrukPiece[] = ['R', 'N', 'S', 'M', 'K', 'S', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: blackBack[c], owner: p1, moved: false };
      board[2][c] = { type: 'P', owner: p1, moved: false };
    }

    // White (bottom, row 7-6)
    const whiteBack: MakrukPiece[] = ['R', 'N', 'S', 'K', 'M', 'S', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      board[7][c] = { type: whiteBack[c], owner: p0, moved: false };
      board[5][c] = { type: 'P', owner: p0, moved: false };
    }

    return { board, currentPlayer: 0, winner: null, draw: false, halfMoveClock: 0 };
  }

  private isPseudoLegal(
    board: MBoard,
    piece: MPiece,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    playerIdx: number,
  ): boolean {
    if (!inBounds(toR, toC)) return false;
    if (fromR === toR && fromC === toC) return false;
    const target = board[toR][toC];
    if (target && target.owner === piece.owner) return false;

    const dr = toR - fromR;
    const dc = toC - fromC;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);
    const fwd = playerIdx === 0 ? -1 : 1;

    switch (piece.type) {
      case 'K':
        return absDr <= 1 && absDc <= 1;
      case 'R':
        return (dr === 0 || dc === 0) && isPathClear(board as Board, fromR, fromC, toR, toC);
      case 'N':
        return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
      case 'M': // Met: 1 step diagonal only
        return absDr === 1 && absDc === 1;
      case 'S': // Khon: 1 step forward or 1 step diagonal forward
        if (dr === fwd && dc === 0) return true;
        if (absDr === 1 && absDc === 1) return true; // All 4 diagonals for Khon
        return false;
      case 'P': // Bia: 1 step forward, captures diag forward
        if (dc === 0 && dr === fwd && !target) return true;
        if (absDc === 1 && dr === fwd && target) return true;
        return false;
    }
  }

  private findKingPos(board: MBoard, player: string): [number, number] | null {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'K' && p.owner === player) return [r, c];
      }
    }
    return null;
  }

  private isInCheck(board: MBoard, player: string, players: string[]): boolean {
    const king = this.findKingPos(board, player);
    if (!king) return false;
    const [kr, kc] = king;
    for (let i = 0; i < players.length; i++) {
      if (players[i] === player) continue;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.owner === players[i]) {
            if (this.isPseudoLegal(board, p, r, c, kr, kc, i)) return true;
          }
        }
      }
    }
    return false;
  }

  private isLegal(
    board: MBoard,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    player: string,
    playerIdx: number,
    players: string[],
  ): boolean {
    const piece = board[fromR][fromC];
    if (!piece || piece.owner !== player) return false;
    if (!this.isPseudoLegal(board, piece, fromR, fromC, toR, toC, playerIdx)) return false;

    const saved = board[toR][toC];
    board[toR][toC] = piece;
    board[fromR][fromC] = null;
    const inCheck = this.isInCheck(board, player, players);
    board[fromR][fromC] = piece;
    board[toR][toC] = saved;
    return !inCheck;
  }

  private hasAnyMove(board: MBoard, player: string, playerIdx: number, players: string[]): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!board[r][c] || board[r][c]!.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (this.isLegal(board, r, c, tr, tc, player, playerIdx, players)) return true;
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MakrukState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    if (!this.isLegal(data.board, fromR, fromC, toR, toC, playerId, data.currentPlayer, players)) {
      return { success: false, error: 'Illegal move' };
    }

    const piece = data.board[fromR][fromC]!;
    const captured = data.board[toR][toC];

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    // Promotion: Bia promotes to Met on rank 3 for white (row 2), rank 6 for black (row 5)
    if (piece.type === 'P') {
      const promoRow = data.currentPlayer === 0 ? 2 : 5;
      if (toR === promoRow) {
        piece.type = 'M';
      }
    }

    if (piece.type === 'P' || captured) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    const opponent = players[data.currentPlayer];
    const inCheck = this.isInCheck(data.board, opponent, players);
    const hasMoves = this.hasAnyMove(data.board, opponent, data.currentPlayer, players);

    if (!hasMoves) {
      if (inCheck) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        data.draw = true;
      }
    }

    if (data.halfMoveClock >= 128) data.draw = true; // Makruk counting rules simplified

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MakrukState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<MakrukState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MakrukState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}

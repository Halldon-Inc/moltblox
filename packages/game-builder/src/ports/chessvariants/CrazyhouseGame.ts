import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  setupStandardBoard,
  inBounds,
  isPathClear,
  isPseudoLegalMove,
  findKing,
  isKingInCheck,
  hasAnyLegalMove,
  isLegalMoveStandard,
} from './chessHelpers.js';

interface CrazyhouseState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
  reserves: PieceType[][];
}

export class CrazyhouseGame extends BaseGame {
  readonly name = 'Crazyhouse';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): CrazyhouseState {
    return {
      board: setupStandardBoard(playerIds),
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
      halfMoveClock: 0,
      castlingRights: [
        { kingSide: true, queenSide: true },
        { kingSide: true, queenSide: true },
      ],
      reserves: [[], []],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CrazyhouseState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'drop') {
      return this.handleDrop(data, playerId, action, players);
    }

    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };

    const [fromR, fromC] = from;
    const [toR, toC] = to;

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId)
      return { success: false, error: 'No valid piece at source' };

    if (
      !isLegalMoveStandard(
        data.board,
        fromR,
        fromC,
        toR,
        toC,
        playerId,
        data.currentPlayer,
        players,
        data.enPassantTarget,
        data.castlingRights,
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    // Capture: add piece (as pawn type demoted) to reserves
    const capturedPiece = data.board[toR][toC];
    if (capturedPiece) {
      const reserveType: PieceType = capturedPiece.type === 'K' ? 'P' : capturedPiece.type;
      data.reserves[data.currentPlayer].push(reserveType);
    }

    // En passant capture
    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      const epPiece = data.board[fromR][toC];
      if (epPiece) {
        data.reserves[data.currentPlayer].push('P');
      }
      data.board[fromR][toC] = null;
    }

    // Castling
    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (toC > fromC) {
        data.board[fromR][5] = data.board[fromR][7];
        data.board[fromR][7] = null;
        if (data.board[fromR][5]) data.board[fromR][5]!.moved = true;
      } else {
        data.board[fromR][3] = data.board[fromR][0];
        data.board[fromR][0] = null;
        if (data.board[fromR][3]) data.board[fromR][3]!.moved = true;
      }
    }

    // En passant target
    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    // Promotion
    const promotion = action.payload.promotion as PieceType | undefined;
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    // Update castling rights
    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }
    if (fromC === 0) data.castlingRights[data.currentPlayer].queenSide = false;
    if (fromC === 7) data.castlingRights[data.currentPlayer].kingSide = false;

    if (piece.type === 'P' || capturedPiece) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.checkEndCondition(data, players);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDrop(
    data: CrazyhouseState,
    playerId: string,
    action: GameAction,
    players: string[],
  ): ActionResult {
    const pieceType = action.payload.piece as PieceType;
    const to = this.parseCoords(action.payload.to as string);
    if (!to) return { success: false, error: 'Invalid target square' };
    const [toR, toC] = to;

    if (!inBounds(toR, toC)) return { success: false, error: 'Out of bounds' };
    if (data.board[toR][toC] !== null) return { success: false, error: 'Square occupied' };

    const idx = data.reserves[data.currentPlayer].indexOf(pieceType);
    if (idx === -1) return { success: false, error: 'Piece not in reserve' };

    // Pawns cannot be dropped on first or last rank
    if (pieceType === 'P' && (toR === 0 || toR === 7)) {
      return { success: false, error: 'Cannot drop pawn on first/last rank' };
    }

    // Simulate the drop and check it does not leave own king in check (this is always fine but must not give check illegally... actually drops can give check)
    data.reserves[data.currentPlayer].splice(idx, 1);
    data.board[toR][toC] = { type: pieceType, owner: playerId, moved: true };

    // If drop leaves own king in check, undo
    if (isKingInCheck(data.board, playerId, players, data.enPassantTarget)) {
      data.board[toR][toC] = null;
      data.reserves[data.currentPlayer].splice(idx, 0, pieceType);
      return { success: false, error: 'Drop leaves king in check' };
    }

    data.enPassantTarget = null;
    data.halfMoveClock = 0;
    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.checkEndCondition(data, players);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkEndCondition(data: CrazyhouseState, players: string[]): void {
    const opponent = players[data.currentPlayer];
    const oppIdx = data.currentPlayer;
    const inCheck = isKingInCheck(data.board, opponent, players, data.enPassantTarget);
    const hasMove = hasAnyLegalMove(
      data.board,
      opponent,
      oppIdx,
      players,
      data.enPassantTarget,
      data.castlingRights,
    );

    if (!hasMove) {
      if (inCheck) {
        data.winner = players[(data.currentPlayer + 1) % 2];
        this.emitEvent('checkmate', data.winner, {});
      } else {
        data.draw = true;
        this.emitEvent('stalemate', undefined, {});
      }
    }
    if (data.halfMoveClock >= 100) data.draw = true;
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CrazyhouseState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<CrazyhouseState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CrazyhouseState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}

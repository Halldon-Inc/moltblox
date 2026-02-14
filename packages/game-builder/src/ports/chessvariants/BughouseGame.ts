import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  setupStandardBoard,
  inBounds,
  isPseudoLegalMove,
  isKingInCheck,
  isLegalMoveStandard,
  hasAnyLegalMove,
} from './chessHelpers.js';

/**
 * Bughouse: 4-player team chess on 2 boards.
 * Team 1: players[0] (board A white) + players[2] (board B black)
 * Team 2: players[1] (board A black) + players[3] (board B white)
 * Captured pieces are given to partner to drop.
 */
interface BughouseState {
  [key: string]: unknown;
  boards: Board[];
  currentPlayers: number[]; // current player index for each board (0 or 1 relative to board)
  boardPlayers: string[][]; // [board][0=white, 1=black]
  winner: string | null;
  winningTeam: number | null;
  reserves: Record<string, PieceType[]>;
  enPassantTargets: ([number, number] | null)[];
  castlingRights: { kingSide: boolean; queenSide: boolean }[][];
}

export class BughouseGame extends BaseGame {
  readonly name = 'Bughouse';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): BughouseState {
    // Board A: playerIds[0] (white) vs playerIds[1] (black)
    // Board B: playerIds[3] (white) vs playerIds[2] (black)
    const boardAPlayers = [playerIds[0], playerIds[1]];
    const boardBPlayers = [playerIds[3], playerIds[2]];

    const reserves: Record<string, PieceType[]> = {};
    for (const p of playerIds) reserves[p] = [];

    return {
      boards: [setupStandardBoard(boardAPlayers), setupStandardBoard(boardBPlayers)],
      currentPlayers: [0, 0],
      boardPlayers: [boardAPlayers, boardBPlayers],
      winner: null,
      winningTeam: null,
      reserves,
      enPassantTargets: [null, null],
      castlingRights: [
        [
          { kingSide: true, queenSide: true },
          { kingSide: true, queenSide: true },
        ],
        [
          { kingSide: true, queenSide: true },
          { kingSide: true, queenSide: true },
        ],
      ],
    };
  }

  private getPartner(playerId: string, playerIds: string[]): string {
    const idx = playerIds.indexOf(playerId);
    // Team 1: 0 and 2, Team 2: 1 and 3
    if (idx === 0) return playerIds[2];
    if (idx === 2) return playerIds[0];
    if (idx === 1) return playerIds[3];
    return playerIds[1];
  }

  private getBoardIndex(playerId: string, data: BughouseState): number {
    if (data.boardPlayers[0].includes(playerId)) return 0;
    return 1;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BughouseState>();
    const allPlayers = this.getPlayers();
    const boardIdx = this.getBoardIndex(playerId, data);
    const board = data.boards[boardIdx];
    const bPlayers = data.boardPlayers[boardIdx];
    const curPlayerIdx = data.currentPlayers[boardIdx];
    const partner = this.getPartner(playerId, allPlayers);

    if (bPlayers[curPlayerIdx] !== playerId)
      return { success: false, error: 'Not your turn on this board' };

    if (action.type === 'drop') {
      const pieceType = action.payload.piece as PieceType;
      const from = this.parseCoords(action.payload.to as string);
      if (!from) return { success: false, error: 'Invalid target' };
      const [toR, toC] = from;

      if (!inBounds(toR, toC)) return { success: false, error: 'Out of bounds' };
      if (board[toR][toC] !== null) return { success: false, error: 'Square occupied' };

      const idx = data.reserves[playerId].indexOf(pieceType);
      if (idx === -1) return { success: false, error: 'Piece not in reserve' };

      if (pieceType === 'P' && (toR === 0 || toR === 7)) {
        return { success: false, error: 'Cannot drop pawn on first/last rank' };
      }

      data.reserves[playerId].splice(idx, 1);
      board[toR][toC] = { type: pieceType, owner: playerId, moved: true };

      if (isKingInCheck(board, playerId, bPlayers, data.enPassantTargets[boardIdx])) {
        board[toR][toC] = null;
        data.reserves[playerId].splice(idx, 0, pieceType);
        return { success: false, error: 'Drop leaves king in check' };
      }

      data.enPassantTargets[boardIdx] = null;
      data.currentPlayers[boardIdx] = (curPlayerIdx + 1) % 2;

      this.checkBoardEnd(data, boardIdx, allPlayers);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    const piece = board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId) return { success: false, error: 'No valid piece' };

    if (
      !isLegalMoveStandard(
        board,
        fromR,
        fromC,
        toR,
        toC,
        playerId,
        curPlayerIdx,
        bPlayers,
        data.enPassantTargets[boardIdx],
        data.castlingRights[boardIdx],
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    const captured = board[toR][toC];

    // En passant capture
    if (
      piece.type === 'P' &&
      data.enPassantTargets[boardIdx] &&
      toR === data.enPassantTargets[boardIdx]![0] &&
      toC === data.enPassantTargets[boardIdx]![1]
    ) {
      const epPiece = board[fromR][toC];
      if (epPiece) {
        data.reserves[partner].push(epPiece.type === 'K' ? 'P' : epPiece.type);
      }
      board[fromR][toC] = null;
    }

    // Give captured piece to partner
    if (captured) {
      const reserveType: PieceType = captured.type === 'K' ? 'P' : captured.type;
      data.reserves[partner].push(reserveType);
    }

    // Castling
    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (toC > fromC) {
        board[fromR][5] = board[fromR][7];
        board[fromR][7] = null;
        if (board[fromR][5]) board[fromR][5]!.moved = true;
      } else {
        board[fromR][3] = board[fromR][0];
        board[fromR][0] = null;
        if (board[fromR][3]) board[fromR][3]!.moved = true;
      }
    }

    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTargets[boardIdx] = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTargets[boardIdx] = null;
    }

    board[toR][toC] = piece;
    board[fromR][fromC] = null;
    piece.moved = true;

    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as PieceType | undefined;
      const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    if (piece.type === 'K') {
      data.castlingRights[boardIdx][curPlayerIdx] = { kingSide: false, queenSide: false };
    }

    data.currentPlayers[boardIdx] = (curPlayerIdx + 1) % 2;
    this.checkBoardEnd(data, boardIdx, allPlayers);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkBoardEnd(data: BughouseState, boardIdx: number, allPlayers: string[]): void {
    if (data.winner) return;
    const board = data.boards[boardIdx];
    const bPlayers = data.boardPlayers[boardIdx];
    const curIdx = data.currentPlayers[boardIdx];
    const opponent = bPlayers[curIdx];

    const inCheck = isKingInCheck(board, opponent, bPlayers, data.enPassantTargets[boardIdx]);
    const hasMoves = hasAnyLegalMove(
      board,
      opponent,
      curIdx,
      bPlayers,
      data.enPassantTargets[boardIdx],
      data.castlingRights[boardIdx],
    );

    if (!hasMoves && inCheck) {
      // The player who delivered checkmate's team wins
      const mover = bPlayers[(curIdx + 1) % 2];
      data.winner = mover;
      const moverGlobalIdx = allPlayers.indexOf(mover);
      data.winningTeam = moverGlobalIdx % 2; // 0 or 1
      this.emitEvent('checkmate', mover, { board: boardIdx });
    }
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    return this.getData<BughouseState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<BughouseState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BughouseState>();
    const scores: Record<string, number> = {};
    const allPlayers = this.getPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      if (data.winningTeam !== null) {
        scores[allPlayers[i]] = i % 2 === data.winningTeam ? 1 : 0;
      } else {
        scores[allPlayers[i]] = 0;
      }
    }
    return scores;
  }
}

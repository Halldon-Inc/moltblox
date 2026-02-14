import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  setupStandardBoard,
  inBounds,
  isPseudoLegalMove,
} from './chessHelpers.js';

interface AntichessState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
}

export class AntichessGame extends BaseGame {
  readonly name = 'Antichess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): AntichessState {
    return {
      board: setupStandardBoard(playerIds),
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<AntichessState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
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
      !isPseudoLegalMove(
        data.board,
        piece,
        fromR,
        fromC,
        toR,
        toC,
        data.currentPlayer,
        data.enPassantTarget,
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    const isCapture =
      data.board[toR][toC] !== null ||
      (piece.type === 'P' &&
        data.enPassantTarget &&
        toR === data.enPassantTarget[0] &&
        toC === data.enPassantTarget[1]);

    // Must capture if possible
    const captures = this.getCaptureMoves(data, playerId);
    if (captures.length > 0 && !isCapture) {
      return { success: false, error: 'Must capture when possible' };
    }

    // En passant capture
    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
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

    // Promotion: in antichess, can promote to king too
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as PieceType | undefined;
      const valid: PieceType[] = ['Q', 'R', 'B', 'N', 'K'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Win: player has no pieces left
    const myPieces = this.countPieces(data.board, playerId);
    if (myPieces === 0) {
      data.winner = playerId; // Losing all pieces wins!
      this.emitEvent('all_pieces_lost', playerId, {});
    }

    // Stalemate: current player has no legal moves (in antichess, this is a win for the stalemated player)
    if (!data.winner) {
      const curPlayer = players[data.currentPlayer];
      if (!this.hasAnyMove(data, curPlayer)) {
        data.winner = curPlayer;
        this.emitEvent('stalemate_win', curPlayer, {});
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getCaptureMoves(
    data: AntichessState,
    player: string,
  ): [number, number, number, number][] {
    const moves: [number, number, number, number][] = [];
    const playerIdx = this.getPlayers().indexOf(player);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = data.board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (
              !isPseudoLegalMove(data.board, piece, r, c, tr, tc, playerIdx, data.enPassantTarget)
            )
              continue;
            const isCapture =
              data.board[tr][tc] !== null ||
              (piece.type === 'P' &&
                data.enPassantTarget &&
                tr === data.enPassantTarget[0] &&
                tc === data.enPassantTarget[1]);
            if (isCapture) moves.push([r, c, tr, tc]);
          }
        }
      }
    }
    return moves;
  }

  private hasAnyMove(data: AntichessState, player: string): boolean {
    const playerIdx = this.getPlayers().indexOf(player);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = data.board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (isPseudoLegalMove(data.board, piece, r, c, tr, tc, playerIdx, data.enPassantTarget))
              return true;
          }
        }
      }
    }
    return false;
  }

  private countPieces(board: Board, player: string): number {
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c]?.owner === player) count++;
      }
    }
    return count;
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<AntichessState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<AntichessState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<AntichessState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type JPieceType = 'G' | 'A' | 'E' | 'H' | 'R' | 'C' | 'S';

interface JPiece {
  type: JPieceType;
  owner: string;
}

type JBoard = (JPiece | null)[][];

interface JanggiState {
  [key: string]: unknown;
  board: JBoard;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  passCount: number;
}

export class JanggiGame extends BaseGame {
  readonly name = 'Janggi';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): JanggiState {
    const board: JBoard = [];
    for (let r = 0; r < 10; r++) board.push(Array(9).fill(null));

    const p0 = playerIds[0]; // Cho (Red, bottom)
    const p1 = playerIds[1]; // Han (Blue, top)

    // Han (top)
    board[0][0] = { type: 'R', owner: p1 };
    board[0][1] = { type: 'E', owner: p1 };
    board[0][2] = { type: 'H', owner: p1 };
    board[0][3] = { type: 'A', owner: p1 };
    board[0][5] = { type: 'A', owner: p1 };
    board[0][6] = { type: 'E', owner: p1 };
    board[0][7] = { type: 'H', owner: p1 };
    board[0][8] = { type: 'R', owner: p1 };
    board[1][4] = { type: 'G', owner: p1 };
    board[2][1] = { type: 'C', owner: p1 };
    board[2][7] = { type: 'C', owner: p1 };
    for (let c = 0; c < 9; c += 2) board[3][c] = { type: 'S', owner: p1 };

    // Cho (bottom)
    board[9][0] = { type: 'R', owner: p0 };
    board[9][1] = { type: 'E', owner: p0 };
    board[9][2] = { type: 'H', owner: p0 };
    board[9][3] = { type: 'A', owner: p0 };
    board[9][5] = { type: 'A', owner: p0 };
    board[9][6] = { type: 'E', owner: p0 };
    board[9][7] = { type: 'H', owner: p0 };
    board[9][8] = { type: 'R', owner: p0 };
    board[8][4] = { type: 'G', owner: p0 };
    board[7][1] = { type: 'C', owner: p0 };
    board[7][7] = { type: 'C', owner: p0 };
    for (let c = 0; c < 9; c += 2) board[6][c] = { type: 'S', owner: p0 };

    return { board, currentPlayer: 0, winner: null, draw: false, passCount: 0 };
  }

  private isValidMove(
    board: JBoard,
    piece: JPiece,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    playerIdx: number,
  ): boolean {
    if (toR < 0 || toR >= 10 || toC < 0 || toC >= 9) return false;
    if (fromR === toR && fromC === toC) return false;
    const target = board[toR][toC];
    if (target && target.owner === piece.owner) return false;

    const dr = toR - fromR;
    const dc = toC - fromC;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    const palaceRowMin = playerIdx === 0 ? 7 : 0;
    const palaceRowMax = playerIdx === 0 ? 9 : 2;

    switch (piece.type) {
      case 'G': {
        // Moves 1 step orthogonal or diagonal within palace
        if (absDr <= 1 && absDc <= 1 && absDr + absDc > 0) {
          if (toR >= palaceRowMin && toR <= palaceRowMax && toC >= 3 && toC <= 5) return true;
        }
        return false;
      }
      case 'A': {
        if (absDr <= 1 && absDc <= 1 && absDr + absDc > 0) {
          if (toR >= palaceRowMin && toR <= palaceRowMax && toC >= 3 && toC <= 5) return true;
        }
        return false;
      }
      case 'E': {
        // Elephant in Janggi: moves 1 orthogonal then 2 diagonal (no river restriction)
        if ((absDr === 3 && absDc === 2) || (absDr === 2 && absDc === 3)) {
          // Check blocking
          const stepR = Math.sign(dr);
          const stepC = Math.sign(dc);
          if (board[fromR + stepR][fromC + stepC]) return false; // First step blocked
          if (absDr === 3) {
            if (board[fromR + 2 * stepR][fromC + stepC]) return false;
          } else {
            if (board[fromR + stepR][fromC + 2 * stepC]) return false;
          }
          return true;
        }
        return false;
      }
      case 'H': {
        if ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)) {
          const blockR = absDr === 2 ? fromR + Math.sign(dr) : fromR;
          const blockC = absDc === 2 ? fromC + Math.sign(dc) : fromC;
          if (board[blockR][blockC]) return false;
          return true;
        }
        return false;
      }
      case 'R': {
        if (dr !== 0 && dc !== 0) {
          // Can move diagonally on palace diagonals
          if (absDr === 1 && absDc === 1) {
            const inPalace =
              (fromR >= 7 && fromR <= 9 && fromC >= 3 && fromC <= 5) ||
              (fromR >= 0 && fromR <= 2 && fromC >= 3 && fromC <= 5);
            const toPalace =
              (toR >= 7 && toR <= 9 && toC >= 3 && toC <= 5) ||
              (toR >= 0 && toR <= 2 && toC >= 3 && toC <= 5);
            if (inPalace && toPalace) return true;
          }
          return false;
        }
        return this.isPathClear(board, fromR, fromC, toR, toC);
      }
      case 'C': {
        // Cannon: jumps exactly one piece to move or capture, cannot jump another cannon
        if (dr !== 0 && dc !== 0) return false;
        const between = this.getPiecesBetween(board, fromR, fromC, toR, toC);
        if (between.length !== 1) return false;
        if (between[0].type === 'C') return false; // Cannot jump over cannon
        if (target && target.type === 'C') return false; // Cannot capture cannon
        return true;
      }
      case 'S': {
        const fwd = playerIdx === 0 ? -1 : 1;
        // Forward or sideways (no backward). No river restriction
        if (dr === fwd && dc === 0) return true;
        if (dr === 0 && absDc === 1) return true;
        // Diagonal in palace
        if (absDr === 1 && absDc === 1) {
          const inPalace =
            (toR >= 7 && toR <= 9 && toC >= 3 && toC <= 5) ||
            (toR >= 0 && toR <= 2 && toC >= 3 && toC <= 5);
          if (inPalace) return true;
        }
        return false;
      }
    }
  }

  private isPathClear(
    board: JBoard,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let r = fromR + dr,
      c = fromC + dc;
    while (r !== toR || c !== toC) {
      if (board[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  private getPiecesBetween(
    board: JBoard,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): JPiece[] {
    const pieces: JPiece[] = [];
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let r = fromR + dr,
      c = fromC + dc;
    while (r !== toR || c !== toC) {
      if (board[r][c]) pieces.push(board[r][c]!);
      r += dr;
      c += dc;
    }
    return pieces;
  }

  private findGeneral(board: JBoard, player: string): [number, number] | null {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.type === 'G' && p.owner === player) return [r, c];
      }
    }
    return null;
  }

  private isInCheck(board: JBoard, player: string, players: string[]): boolean {
    const gen = this.findGeneral(board, player);
    if (!gen) return true;
    const [gr, gc] = gen;

    for (let i = 0; i < players.length; i++) {
      if (players[i] === player) continue;
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const p = board[r][c];
          if (p && p.owner === players[i]) {
            if (this.isValidMove(board, p, r, c, gr, gc, i)) return true;
          }
        }
      }
    }
    return false;
  }

  private hasAnyLegalMove(
    board: JBoard,
    player: string,
    playerIdx: number,
    players: string[],
  ): boolean {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < 10; tr++) {
          for (let tc = 0; tc < 9; tc++) {
            if (!this.isValidMove(board, piece, r, c, tr, tc, playerIdx)) continue;
            const saved = board[tr][tc];
            board[tr][tc] = piece;
            board[r][c] = null;
            const inCheck = this.isInCheck(board, player, players);
            board[r][c] = piece;
            board[tr][tc] = saved;
            if (!inCheck) return true;
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<JanggiState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    // In Janggi, a player can pass
    if (action.type === 'pass') {
      data.passCount++;
      if (data.passCount >= 4) {
        // Both players passed twice
        data.draw = true;
      }
      data.currentPlayer = (data.currentPlayer + 1) % 2;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    data.passCount = 0;

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v)))
      return { success: false, error: 'Invalid coordinates' };

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId) return { success: false, error: 'No valid piece' };

    if (!this.isValidMove(data.board, piece, fromR, fromC, toR, toC, data.currentPlayer)) {
      return { success: false, error: 'Illegal move' };
    }

    const saved = data.board[toR][toC];
    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;

    if (this.isInCheck(data.board, playerId, players)) {
      data.board[fromR][fromC] = piece;
      data.board[toR][toC] = saved;
      return { success: false, error: 'Move leaves general in check' };
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    const opponent = players[data.currentPlayer];

    if (this.isInCheck(data.board, opponent, players)) {
      if (!this.hasAnyLegalMove(data.board, opponent, data.currentPlayer, players)) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<JanggiState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<JanggiState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<JanggiState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}

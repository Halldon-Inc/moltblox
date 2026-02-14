import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type XPieceType = 'G' | 'A' | 'E' | 'H' | 'R' | 'C' | 'S'; // General, Advisor, Elephant, Horse, Chariot, Cannon, Soldier

interface XPiece {
  type: XPieceType;
  owner: string;
}

type XBoard = (XPiece | null)[][];

interface XiangqiState {
  [key: string]: unknown;
  board: XBoard;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
}

export class XiangqiGame extends BaseGame {
  readonly name = 'Xiangqi';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private readonly ROWS = 10;
  private readonly COLS = 9;

  protected initializeState(playerIds: string[]): XiangqiState {
    const board: XBoard = [];
    for (let r = 0; r < 10; r++) board.push(Array(9).fill(null));

    const p0 = playerIds[0]; // Red (bottom, rows 5-9)
    const p1 = playerIds[1]; // Black (top, rows 0-4)

    // Black pieces (top)
    board[0][0] = { type: 'R', owner: p1 };
    board[0][1] = { type: 'H', owner: p1 };
    board[0][2] = { type: 'E', owner: p1 };
    board[0][3] = { type: 'A', owner: p1 };
    board[0][4] = { type: 'G', owner: p1 };
    board[0][5] = { type: 'A', owner: p1 };
    board[0][6] = { type: 'E', owner: p1 };
    board[0][7] = { type: 'H', owner: p1 };
    board[0][8] = { type: 'R', owner: p1 };
    board[2][1] = { type: 'C', owner: p1 };
    board[2][7] = { type: 'C', owner: p1 };
    for (let c = 0; c < 9; c += 2) board[3][c] = { type: 'S', owner: p1 };

    // Red pieces (bottom)
    board[9][0] = { type: 'R', owner: p0 };
    board[9][1] = { type: 'H', owner: p0 };
    board[9][2] = { type: 'E', owner: p0 };
    board[9][3] = { type: 'A', owner: p0 };
    board[9][4] = { type: 'G', owner: p0 };
    board[9][5] = { type: 'A', owner: p0 };
    board[9][6] = { type: 'E', owner: p0 };
    board[9][7] = { type: 'H', owner: p0 };
    board[9][8] = { type: 'R', owner: p0 };
    board[7][1] = { type: 'C', owner: p0 };
    board[7][7] = { type: 'C', owner: p0 };
    for (let c = 0; c < 9; c += 2) board[6][c] = { type: 'S', owner: p0 };

    return { board, currentPlayer: 0, winner: null, draw: false };
  }

  private isValidMove(
    board: XBoard,
    piece: XPiece,
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

    // Palace bounds for each side
    const palaceRowMin = playerIdx === 0 ? 7 : 0;
    const palaceRowMax = playerIdx === 0 ? 9 : 2;
    // River: rows 0-4 are black's side, rows 5-9 are red's side
    const ownSideMin = playerIdx === 0 ? 5 : 0;
    const ownSideMax = playerIdx === 0 ? 9 : 4;

    switch (piece.type) {
      case 'G': // General: 1 step orthogonal, inside palace
        if (!((absDr === 1 && absDc === 0) || (absDr === 0 && absDc === 1))) return false;
        if (toR < palaceRowMin || toR > palaceRowMax || toC < 3 || toC > 5) return false;
        return true;

      case 'A': // Advisor: 1 step diagonal, inside palace
        if (absDr !== 1 || absDc !== 1) return false;
        if (toR < palaceRowMin || toR > palaceRowMax || toC < 3 || toC > 5) return false;
        return true;

      case 'E': {
        // Elephant: 2 steps diagonal, cannot cross river, blocked at midpoint
        if (absDr !== 2 || absDc !== 2) return false;
        if (toR < ownSideMin || toR > ownSideMax) return false;
        const midR = (fromR + toR) / 2;
        const midC = (fromC + toC) / 2;
        if (board[midR][midC]) return false; // Blocked
        return true;
      }

      case 'H': {
        // Horse: L-shape, but blocked at first step
        if ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)) {
          // Blocking point
          let blockR: number, blockC: number;
          if (absDr === 2) {
            blockR = fromR + Math.sign(dr);
            blockC = fromC;
          } else {
            blockR = fromR;
            blockC = fromC + Math.sign(dc);
          }
          if (board[blockR][blockC]) return false;
          return true;
        }
        return false;
      }

      case 'R': // Chariot: slides orthogonally
        if (dr !== 0 && dc !== 0) return false;
        return this.isPathClear(board, fromR, fromC, toR, toC);

      case 'C': {
        // Cannon: slides orthogonally, captures by jumping over exactly one piece
        if (dr !== 0 && dc !== 0) return false;
        const pieces = this.countBetween(board, fromR, fromC, toR, toC);
        if (!target) return pieces === 0; // Non-capture: clear path
        return pieces === 1; // Capture: exactly one piece between
      }

      case 'S': {
        // Soldier: 1 step forward before river, forward/sideways after river
        const fwd = playerIdx === 0 ? -1 : 1;
        const crossedRiver = playerIdx === 0 ? toR <= 4 : toR >= 5;
        if (crossedRiver || (fromR <= 4 && playerIdx === 0) || (fromR >= 5 && playerIdx === 1)) {
          // After crossing river or currently across: forward + sideways
          if (dr === fwd && dc === 0) return true;
          if (
            dr === 0 &&
            absDc === 1 &&
            ((playerIdx === 0 && fromR <= 4) || (playerIdx === 1 && fromR >= 5))
          )
            return true;
        }
        // Before crossing: only forward
        if (dr === fwd && dc === 0) return true;
        return false;
      }
    }
  }

  private isPathClear(
    board: XBoard,
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

  private countBetween(
    board: XBoard,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): number {
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let r = fromR + dr,
      c = fromC + dc;
    let count = 0;
    while (r !== toR || c !== toC) {
      if (board[r][c]) count++;
      r += dr;
      c += dc;
    }
    return count;
  }

  private findGeneral(board: XBoard, player: string): [number, number] | null {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.type === 'G' && p.owner === player) return [r, c];
      }
    }
    return null;
  }

  private isInCheck(board: XBoard, player: string, players: string[]): boolean {
    const gen = this.findGeneral(board, player);
    if (!gen) return true;
    const [gr, gc] = gen;

    // Flying general rule: generals cannot face each other on same column with no pieces between
    const oppGen = this.findGeneral(board, players.find((p) => p !== player)!);
    if (oppGen && oppGen[1] === gc) {
      if (this.isPathClear(board, gr, gc, oppGen[0], oppGen[1])) return true;
    }

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
    board: XBoard,
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
    const data = this.getData<XiangqiState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

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

    if (!this.hasAnyLegalMove(data.board, opponent, data.currentPlayer, players)) {
      if (this.isInCheck(data.board, opponent, players)) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        // Stalemate in Xiangqi is a loss for the stalemated player
        data.winner = playerId;
        this.emitEvent('stalemate', playerId, {});
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<XiangqiState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<XiangqiState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const w = this.getData<XiangqiState>().winner;
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === w ? 1 : 0;
    return scores;
  }
}

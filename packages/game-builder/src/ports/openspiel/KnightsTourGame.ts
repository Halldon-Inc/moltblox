import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface KnightsTourConfig {
  boardSize?: number;
}

interface KnightsTourState {
  [key: string]: unknown;
  board: boolean[][];
  boardSize: number;
  knightRow: number;
  knightCol: number;
  visitCount: number;
  totalSquares: number;
  completed: boolean;
  stuck: boolean;
}

const KNIGHT_MOVES = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

export class KnightsTourGame extends BaseGame {
  readonly name = 'Knights Tour';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): KnightsTourState {
    const boardSize = (this.config as KnightsTourConfig).boardSize ?? 8;
    const board: boolean[][] = [];
    for (let r = 0; r < boardSize; r++) board.push(Array(boardSize).fill(false));
    board[0][0] = true;

    return {
      board,
      boardSize,
      knightRow: 0,
      knightCol: 0,
      visitCount: 1,
      totalSquares: boardSize * boardSize,
      completed: false,
      stuck: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<KnightsTourState>();

    if (data.completed || data.stuck) return { success: false, error: 'Game is over' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (
      isNaN(row) ||
      isNaN(col) ||
      row < 0 ||
      row >= data.boardSize ||
      col < 0 ||
      col >= data.boardSize
    ) {
      return { success: false, error: 'Invalid position' };
    }

    const dr = Math.abs(row - data.knightRow);
    const dc = Math.abs(col - data.knightCol);
    if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) {
      return { success: false, error: 'Not a valid knight move' };
    }
    if (data.board[row][col]) return { success: false, error: 'Square already visited' };

    data.board[row][col] = true;
    data.knightRow = row;
    data.knightCol = col;
    data.visitCount++;

    if (data.visitCount === data.totalSquares) {
      data.completed = true;
      this.emitEvent('completed', playerId, { visits: data.visitCount });
    } else {
      const hasMove = KNIGHT_MOVES.some(([ddr, ddc]) => {
        const nr = data.knightRow + ddr;
        const nc = data.knightCol + ddc;
        return (
          nr >= 0 && nr < data.boardSize && nc >= 0 && nc < data.boardSize && !data.board[nr][nc]
        );
      });
      if (!hasMove) {
        data.stuck = true;
        this.emitEvent('stuck', playerId, { visits: data.visitCount });
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<KnightsTourState>();
    return data.completed || data.stuck;
  }

  protected determineWinner(): string | null {
    return this.getData<KnightsTourState>().completed ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<KnightsTourState>().visitCount };
  }
}

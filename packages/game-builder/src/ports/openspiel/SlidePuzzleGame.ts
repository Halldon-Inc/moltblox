import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SlidePuzzleConfig {
  size?: number;
}

interface SlidePuzzleState {
  [key: string]: unknown;
  board: number[];
  size: number;
  emptyIndex: number;
  moves: number;
  solved: boolean;
}

export class SlidePuzzleGame extends BaseGame {
  readonly name = 'Slide Puzzle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SlidePuzzleState {
    const size = (this.config as SlidePuzzleConfig).size ?? 4;
    const total = size * size;
    const board: number[] = [];
    for (let i = 1; i < total; i++) board.push(i);
    board.push(0);

    // Shuffle via random valid moves to ensure solvability
    let emptyIdx = total - 1;
    const dirs = [-1, 1, -size, size];
    for (let i = 0; i < total * 50; i++) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const target = emptyIdx + dir;
      if (target < 0 || target >= total) continue;
      const emptyRow = Math.floor(emptyIdx / size);
      const targetRow = Math.floor(target / size);
      if (Math.abs(dir) === 1 && emptyRow !== targetRow) continue;

      [board[emptyIdx], board[target]] = [board[target], board[emptyIdx]];
      emptyIdx = target;
    }

    return { board, size, emptyIndex: emptyIdx, moves: 0, solved: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SlidePuzzleState>();

    if (data.solved) return { success: false, error: 'Puzzle already solved' };
    if (action.type !== 'slide') return { success: false, error: `Unknown action: ${action.type}` };

    const tileIndex = Number(action.payload.index);
    if (isNaN(tileIndex) || tileIndex < 0 || tileIndex >= data.board.length) {
      return { success: false, error: 'Invalid tile index' };
    }

    const eRow = Math.floor(data.emptyIndex / data.size);
    const eCol = data.emptyIndex % data.size;
    const tRow = Math.floor(tileIndex / data.size);
    const tCol = tileIndex % data.size;
    const dist = Math.abs(eRow - tRow) + Math.abs(eCol - tCol);

    if (dist !== 1) return { success: false, error: 'Tile is not adjacent to the empty space' };

    [data.board[data.emptyIndex], data.board[tileIndex]] = [
      data.board[tileIndex],
      data.board[data.emptyIndex],
    ];
    data.emptyIndex = tileIndex;
    data.moves++;

    let isSolved = true;
    for (let i = 0; i < data.board.length - 1; i++) {
      if (data.board[i] !== i + 1) {
        isSolved = false;
        break;
      }
    }
    if (isSolved && data.board[data.board.length - 1] === 0) {
      data.solved = true;
      this.emitEvent('solved', playerId, { moves: data.moves });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SlidePuzzleState>().solved;
  }

  protected determineWinner(): string | null {
    return this.getData<SlidePuzzleState>().solved ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SlidePuzzleState>();
    return { [this.getPlayers()[0]]: data.solved ? Math.max(1000 - data.moves * 10, 0) : 0 };
  }
}

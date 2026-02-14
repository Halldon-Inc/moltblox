import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MinesweeperConfig {
  width?: number;
  height?: number;
  mines?: number;
}

interface MinesweeperState {
  [key: string]: unknown;
  mineGrid: boolean[][];
  revealed: boolean[][];
  flagged: boolean[][];
  adjacentCounts: number[][];
  width: number;
  height: number;
  mineCount: number;
  revealedCount: number;
  totalSafe: number;
  hitMine: boolean;
  won: boolean;
  firstMove: boolean;
}

export class MinesweeperGame extends BaseGame {
  readonly name = 'Minesweeper';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MinesweeperState {
    const width = (this.config as MinesweeperConfig).width ?? 9;
    const height = (this.config as MinesweeperConfig).height ?? 9;
    const mines = (this.config as MinesweeperConfig).mines ?? 10;

    const mineGrid: boolean[][] = [];
    const revealed: boolean[][] = [];
    const flagged: boolean[][] = [];
    const adjacentCounts: number[][] = [];

    for (let r = 0; r < height; r++) {
      mineGrid.push(Array(width).fill(false));
      revealed.push(Array(width).fill(false));
      flagged.push(Array(width).fill(false));
      adjacentCounts.push(Array(width).fill(0));
    }

    return {
      mineGrid,
      revealed,
      flagged,
      adjacentCounts,
      width,
      height,
      mineCount: mines,
      revealedCount: 0,
      totalSafe: width * height - mines,
      hitMine: false,
      won: false,
      firstMove: true,
    };
  }

  private placeMines(data: MinesweeperState, safeRow: number, safeCol: number): void {
    let placed = 0;
    while (placed < data.mineCount) {
      const r = Math.floor(Math.random() * data.height);
      const c = Math.floor(Math.random() * data.width);
      if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
      if (data.mineGrid[r][c]) continue;
      data.mineGrid[r][c] = true;
      placed++;
    }

    for (let r = 0; r < data.height; r++) {
      for (let c = 0; c < data.width; c++) {
        if (data.mineGrid[r][c]) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < data.height && nc >= 0 && nc < data.width && data.mineGrid[nr][nc])
              count++;
          }
        }
        data.adjacentCounts[r][c] = count;
      }
    }
  }

  private floodReveal(data: MinesweeperState, row: number, col: number): void {
    if (row < 0 || row >= data.height || col < 0 || col >= data.width) return;
    if (data.revealed[row][col] || data.flagged[row][col] || data.mineGrid[row][col]) return;

    data.revealed[row][col] = true;
    data.revealedCount++;

    if (data.adjacentCounts[row][col] === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          this.floodReveal(data, row + dr, col + dc);
        }
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MinesweeperState>();

    if (data.hitMine || data.won) return { success: false, error: 'Game is over' };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (isNaN(row) || isNaN(col) || row < 0 || row >= data.height || col < 0 || col >= data.width) {
      return { success: false, error: 'Invalid position' };
    }

    if (action.type === 'flag') {
      if (data.revealed[row][col]) return { success: false, error: 'Cannot flag a revealed cell' };
      data.flagged[row][col] = !data.flagged[row][col];
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'reveal')
      return { success: false, error: `Unknown action: ${action.type}` };

    if (data.revealed[row][col]) return { success: false, error: 'Cell already revealed' };
    if (data.flagged[row][col]) return { success: false, error: 'Cell is flagged; unflag first' };

    if (data.firstMove) {
      this.placeMines(data, row, col);
      data.firstMove = false;
      let safeCells = 0;
      for (let r = 0; r < data.height; r++) {
        for (let c = 0; c < data.width; c++) {
          if (!data.mineGrid[r][c]) safeCells++;
        }
      }
      data.totalSafe = safeCells;
    }

    if (data.mineGrid[row][col]) {
      data.hitMine = true;
      for (let r = 0; r < data.height; r++) {
        for (let c = 0; c < data.width; c++) {
          if (data.mineGrid[r][c]) data.revealed[r][c] = true;
        }
      }
      this.emitEvent('mine_hit', playerId, { row, col });
    } else {
      this.floodReveal(data, row, col);
      if (data.revealedCount >= data.totalSafe) {
        data.won = true;
        this.emitEvent('won', playerId, { revealedCount: data.revealedCount });
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MinesweeperState>();
    return data.hitMine || data.won;
  }

  protected determineWinner(): string | null {
    return this.getData<MinesweeperState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MinesweeperState>();
    return { [this.getPlayers()[0]]: data.won ? data.totalSafe * 10 : 0 };
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const d = state.data as MinesweeperState;
    const visibleCounts: number[][] = [];
    for (let r = 0; r < d.height; r++) {
      const row: number[] = [];
      for (let c = 0; c < d.width; c++) row.push(d.revealed[r][c] ? d.adjacentCounts[r][c] : -1);
      visibleCounts.push(row);
    }
    return {
      ...state,
      data: { ...d, mineGrid: d.hitMine ? d.mineGrid : [], adjacentCounts: visibleCounts },
    };
  }
}

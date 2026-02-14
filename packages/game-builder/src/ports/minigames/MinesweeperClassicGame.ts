import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface MinesweeperState {
  [key: string]: unknown;
  width: number;
  height: number;
  mines: boolean[][];
  revealed: boolean[][];
  flagged: boolean[][];
  numbers: number[][];
  dead: boolean;
  won: boolean;
}

export class MinesweeperClassicGame extends BaseGame {
  readonly name = 'Minesweeper Classic';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): MinesweeperState {
    const w = 8,
      h = 8,
      numMines = 10;
    const mines = Array.from({ length: h }, () => Array(w).fill(false));
    let placed = 0;
    while (placed < numMines) {
      const r = Math.floor(Math.random() * h);
      const c = Math.floor(Math.random() * w);
      if (!mines[r][c]) {
        mines[r][c] = true;
        placed++;
      }
    }
    const numbers = Array.from({ length: h }, (_, r) =>
      Array.from({ length: w }, (_, c) => {
        if (mines[r][c]) return -1;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr,
              nc = c + dc;
            if (nr >= 0 && nr < h && nc >= 0 && nc < w && mines[nr][nc]) count++;
          }
        return count;
      }),
    );
    return {
      width: w,
      height: h,
      mines,
      numbers,
      revealed: Array.from({ length: h }, () => Array(w).fill(false)),
      flagged: Array.from({ length: h }, () => Array(w).fill(false)),
      dead: false,
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<MinesweeperState>();
    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (row < 0 || row >= d.height || col < 0 || col >= d.width)
      return { success: false, error: 'Out of bounds' };

    if (action.type === 'flag') {
      d.flagged[row][col] = !d.flagged[row][col];
    } else if (action.type === 'reveal') {
      if (d.flagged[row][col]) return { success: false, error: 'Cell is flagged' };
      if (d.revealed[row][col]) return { success: false, error: 'Already revealed' };
      if (d.mines[row][col]) {
        d.dead = true;
      } else this.floodReveal(d, row, col);
    } else {
      return { success: false, error: 'Unknown action' };
    }

    // Check win: all non-mine cells revealed
    let allRevealed = true;
    for (let r = 0; r < d.height; r++)
      for (let c = 0; c < d.width; c++) {
        if (!d.mines[r][c] && !d.revealed[r][c]) allRevealed = false;
      }
    if (allRevealed) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  private floodReveal(d: MinesweeperState, r: number, c: number): void {
    if (r < 0 || r >= d.height || c < 0 || c >= d.width) return;
    if (d.revealed[r][c] || d.mines[r][c]) return;
    d.revealed[r][c] = true;
    if (d.numbers[r][c] === 0) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          this.floodReveal(d, r + dr, c + dc);
        }
    }
  }

  protected checkGameOver(): boolean {
    const d = this.getData<MinesweeperState>();
    return d.dead || d.won;
  }

  protected determineWinner(): string | null {
    return this.getData<MinesweeperState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<MinesweeperState>();
    let revealed = 0;
    for (let r = 0; r < d.height; r++)
      for (let c = 0; c < d.width; c++) if (d.revealed[r][c]) revealed++;
    return { [this.getPlayers()[0]]: revealed * 10 };
  }
}

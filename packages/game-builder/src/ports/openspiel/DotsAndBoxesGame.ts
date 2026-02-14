import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface DotsAndBoxesConfig {
  rows?: number;
  cols?: number;
}

interface DotsAndBoxesState {
  [key: string]: unknown;
  hLines: boolean[][];
  vLines: boolean[][];
  boxes: (string | null)[][];
  scores: Record<string, number>;
  currentPlayer: number;
  rows: number;
  cols: number;
}

export class DotsAndBoxesGame extends BaseGame {
  readonly name = 'Dots and Boxes';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): DotsAndBoxesState {
    const cfg = this.config as DotsAndBoxesConfig;
    const rows = cfg.rows ?? 4;
    const cols = cfg.cols ?? 4;
    const hLines: boolean[][] = [];
    for (let r = 0; r <= rows; r++) hLines.push(Array(cols).fill(false));
    const vLines: boolean[][] = [];
    for (let r = 0; r < rows; r++) vLines.push(Array(cols + 1).fill(false));
    const boxes: (string | null)[][] = [];
    for (let r = 0; r < rows; r++) boxes.push(Array(cols).fill(null));
    const scores: Record<string, number> = {};
    for (const p of playerIds) scores[p] = 0;
    return { hLines, vLines, boxes, scores, currentPlayer: 0, rows, cols };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DotsAndBoxesState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'draw_line')
      return { success: false, error: `Unknown action: ${action.type}` };

    const orientation = String(action.payload.orientation);
    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (orientation === 'h' || orientation === 'horizontal') {
      if (row < 0 || row > data.rows || col < 0 || col >= data.cols)
        return { success: false, error: 'Invalid line position' };
      if (data.hLines[row][col]) return { success: false, error: 'Line already drawn' };
      data.hLines[row][col] = true;
    } else if (orientation === 'v' || orientation === 'vertical') {
      if (row < 0 || row >= data.rows || col < 0 || col > data.cols)
        return { success: false, error: 'Invalid line position' };
      if (data.vLines[row][col]) return { success: false, error: 'Line already drawn' };
      data.vLines[row][col] = true;
    } else {
      return { success: false, error: 'Orientation must be h or v' };
    }

    // Check for completed boxes
    let completed = 0;
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        if (
          data.boxes[r][c] === null &&
          data.hLines[r][c] &&
          data.hLines[r + 1][c] &&
          data.vLines[r][c] &&
          data.vLines[r][c + 1]
        ) {
          data.boxes[r][c] = playerId;
          data.scores[playerId]++;
          completed++;
        }
      }
    }

    // If no box completed, switch turns
    if (completed === 0) {
      data.currentPlayer = (data.currentPlayer + 1) % 2;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<DotsAndBoxesState>();
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        if (data.boxes[r][c] === null) return false;
      }
    }
    return true;
  }

  protected determineWinner(): string | null {
    const data = this.getData<DotsAndBoxesState>();
    const players = this.getPlayers();
    if (data.scores[players[0]] > data.scores[players[1]]) return players[0];
    if (data.scores[players[1]] > data.scores[players[0]]) return players[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<DotsAndBoxesState>().scores };
  }
}

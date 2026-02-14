import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface ConnectDotsState {
  [key: string]: unknown;
  rows: number;
  cols: number;
  hLines: boolean[][];
  vLines: boolean[][];
  boxes: (string | null)[][];
  scores: Record<string, number>;
  currentPlayer: number;
  totalBoxes: number;
  filledBoxes: number;
}

export class ConnectDotsGame extends BaseGame {
  readonly name = 'Connect the Dots';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): ConnectDotsState {
    const rows = 4,
      cols = 4;
    return {
      rows,
      cols,
      hLines: Array.from({ length: rows + 1 }, () => Array(cols).fill(false)),
      vLines: Array.from({ length: rows }, () => Array(cols + 1).fill(false)),
      boxes: Array.from({ length: rows }, () => Array(cols).fill(null)),
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      currentPlayer: 0,
      totalBoxes: rows * cols,
      filledBoxes: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<ConnectDotsState>();
    const players = this.getPlayers();
    if (players[d.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'draw') return { success: false, error: 'Use draw action' };

    const r1 = Number(action.payload.row1),
      c1 = Number(action.payload.col1);
    const r2 = Number(action.payload.row2),
      c2 = Number(action.payload.col2);

    let scored = false;
    // Horizontal line
    if (r1 === r2 && Math.abs(c1 - c2) === 1) {
      const r = r1,
        c = Math.min(c1, c2);
      if (r < 0 || r > d.rows || c < 0 || c >= d.cols)
        return { success: false, error: 'Out of bounds' };
      if (d.hLines[r][c]) return { success: false, error: 'Line already drawn' };
      d.hLines[r][c] = true;
      // Check boxes above and below
      if (r > 0 && d.hLines[r - 1][c] && d.vLines[r - 1][c] && d.vLines[r - 1][c + 1]) {
        d.boxes[r - 1][c] = playerId;
        d.scores[playerId]++;
        d.filledBoxes++;
        scored = true;
      }
      if (r < d.rows && d.hLines[r + 1]?.[c] && d.vLines[r]?.[c] && d.vLines[r]?.[c + 1]) {
        d.boxes[r][c] = playerId;
        d.scores[playerId]++;
        d.filledBoxes++;
        scored = true;
      }
    }
    // Vertical line
    else if (c1 === c2 && Math.abs(r1 - r2) === 1) {
      const r = Math.min(r1, r2),
        c = c1;
      if (r < 0 || r >= d.rows || c < 0 || c > d.cols)
        return { success: false, error: 'Out of bounds' };
      if (d.vLines[r][c]) return { success: false, error: 'Line already drawn' };
      d.vLines[r][c] = true;
      if (c > 0 && d.vLines[r][c - 1] && d.hLines[r][c - 1] && d.hLines[r + 1][c - 1]) {
        d.boxes[r][c - 1] = playerId;
        d.scores[playerId]++;
        d.filledBoxes++;
        scored = true;
      }
      if (c < d.cols && d.vLines[r]?.[c + 1] && d.hLines[r]?.[c] && d.hLines[r + 1]?.[c]) {
        d.boxes[r][c] = playerId;
        d.scores[playerId]++;
        d.filledBoxes++;
        scored = true;
      }
    } else {
      return { success: false, error: 'Invalid line (must be adjacent dots)' };
    }

    if (!scored) d.currentPlayer = (d.currentPlayer + 1) % 2;
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<ConnectDotsState>();
    return d.filledBoxes >= d.totalBoxes;
  }

  protected determineWinner(): string | null {
    const d = this.getData<ConnectDotsState>();
    const players = this.getPlayers();
    if (d.scores[players[0]] > d.scores[players[1]]) return players[0];
    if (d.scores[players[1]] > d.scores[players[0]]) return players[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<ConnectDotsState>().scores };
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface DotsState {
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

export class DotsGame extends BaseGame {
  readonly name = 'Dots';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): DotsState {
    const rows = 5,
      cols = 5;
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
    const d = this.getData<DotsState>();
    const players = this.getPlayers();
    if (players[d.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'draw') return { success: false, error: 'Use draw action' };

    const from = Number(action.payload.from);
    const to = Number(action.payload.to);
    // Convert node IDs to grid positions
    const fromRow = Math.floor(from / (d.cols + 1));
    const fromCol = from % (d.cols + 1);
    const toRow = Math.floor(to / (d.cols + 1));
    const toCol = to % (d.cols + 1);

    let scored = false;

    if (fromRow === toRow && Math.abs(fromCol - toCol) === 1) {
      // Horizontal line
      const r = fromRow,
        c = Math.min(fromCol, toCol);
      if (r > d.rows || c >= d.cols) return { success: false, error: 'Out of bounds' };
      if (d.hLines[r][c]) return { success: false, error: 'Already drawn' };
      d.hLines[r][c] = true;
      // Check box above
      if (r > 0 && d.hLines[r - 1]?.[c] && d.vLines[r - 1]?.[c] && d.vLines[r - 1]?.[c + 1]) {
        d.boxes[r - 1][c] = playerId;
        d.scores[playerId]++;
        d.filledBoxes++;
        scored = true;
      }
      // Check box below
      if (r < d.rows && d.hLines[r + 1]?.[c] && d.vLines[r]?.[c] && d.vLines[r]?.[c + 1]) {
        d.boxes[r][c] = playerId;
        d.scores[playerId]++;
        d.filledBoxes++;
        scored = true;
      }
    } else if (fromCol === toCol && Math.abs(fromRow - toRow) === 1) {
      // Vertical line
      const r = Math.min(fromRow, toRow),
        c = fromCol;
      if (r >= d.rows || c > d.cols) return { success: false, error: 'Out of bounds' };
      if (d.vLines[r][c]) return { success: false, error: 'Already drawn' };
      d.vLines[r][c] = true;
      if (c > 0 && d.vLines[r]?.[c - 1] && d.hLines[r]?.[c - 1] && d.hLines[r + 1]?.[c - 1]) {
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
      return { success: false, error: 'Invalid line' };
    }

    if (!scored) d.currentPlayer = (d.currentPlayer + 1) % 2;
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<DotsState>().filledBoxes >= this.getData<DotsState>().totalBoxes;
  }

  protected determineWinner(): string | null {
    const d = this.getData<DotsState>();
    const p = this.getPlayers();
    if (d.scores[p[0]] > d.scores[p[1]]) return p[0];
    if (d.scores[p[1]] > d.scores[p[0]]) return p[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<DotsState>().scores };
  }
}

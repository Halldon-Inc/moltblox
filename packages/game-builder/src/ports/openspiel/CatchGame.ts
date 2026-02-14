import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface CatchState {
  [key: string]: unknown;
  chasers: [number, number][];
  runner: [number, number];
  currentPlayer: number;
  gridSize: number;
  caught: boolean;
  turnsLeft: number;
}

export class CatchGame extends BaseGame {
  readonly name = 'Catch';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): CatchState {
    const gridSize = 7;
    return {
      chasers: [
        [0, 0],
        [0, gridSize - 1],
        [gridSize - 1, 0],
        [gridSize - 1, gridSize - 1],
      ],
      runner: [Math.floor(gridSize / 2), Math.floor(gridSize / 2)],
      currentPlayer: 0,
      gridSize,
      caught: false,
      turnsLeft: 50,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CatchState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (data.currentPlayer === 0) {
      // Chaser: move one chaser
      const chaserIdx = Number(action.payload.chaserIndex ?? 0);
      if (isNaN(chaserIdx) || chaserIdx < 0 || chaserIdx >= data.chasers.length) {
        return { success: false, error: 'Invalid chaser index' };
      }
      const [cr, cc] = data.chasers[chaserIdx];
      const dr = Math.abs(row - cr);
      const dc = Math.abs(col - cc);
      if (dr + dc !== 1) return { success: false, error: 'Must move one step orthogonally' };
      if (row < 0 || row >= data.gridSize || col < 0 || col >= data.gridSize)
        return { success: false, error: 'Out of bounds' };
      data.chasers[chaserIdx] = [row, col];

      // Check catch
      if (data.chasers.some(([r, c]) => r === data.runner[0] && c === data.runner[1])) {
        data.caught = true;
      }
    } else {
      // Runner
      const [rr, rc] = data.runner;
      const dr = Math.abs(row - rr);
      const dc = Math.abs(col - rc);
      if (dr + dc !== 1) return { success: false, error: 'Must move one step orthogonally' };
      if (row < 0 || row >= data.gridSize || col < 0 || col >= data.gridSize)
        return { success: false, error: 'Out of bounds' };
      if (data.chasers.some(([r, c]) => r === row && c === col))
        return { success: false, error: 'Cannot move onto a chaser' };
      data.runner = [row, col];
    }

    data.turnsLeft--;
    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CatchState>();
    return data.caught || data.turnsLeft <= 0;
  }

  protected determineWinner(): string | null {
    const data = this.getData<CatchState>();
    const players = this.getPlayers();
    return data.caught ? players[0] : players[1];
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CatchState>();
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? data.turnsLeft : 0;
    return scores;
  }
}

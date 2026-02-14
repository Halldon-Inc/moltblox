import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface BreakoutState {
  [key: string]: unknown;
  width: number;
  height: number;
  paddle: number;
  paddleWidth: number;
  ball: number[];
  ballDir: number[];
  bricks: boolean[][];
  score: number;
  launched: boolean;
  lost: boolean;
}

export class BreakoutGame extends BaseGame {
  readonly name = 'Breakout';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): BreakoutState {
    const w = 10,
      h = 15,
      rows = 3;
    return {
      width: w,
      height: h,
      paddle: Math.floor(w / 2),
      paddleWidth: 3,
      ball: [h - 2, Math.floor(w / 2)],
      ballDir: [-1, 1],
      bricks: Array.from({ length: rows }, () => Array(w).fill(true)),
      score: 0,
      launched: false,
      lost: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<BreakoutState>();
    if (action.type === 'launch') {
      d.launched = true;
    } else if (action.type === 'move') {
      const dir = action.payload.direction as string;
      if (dir === 'left' && d.paddle > 0) d.paddle--;
      else if (dir === 'right' && d.paddle < d.width - 1) d.paddle++;
    } else {
      return { success: false, error: 'Unknown action' };
    }

    if (d.launched) {
      const nr = d.ball[0] + d.ballDir[0];
      const nc = d.ball[1] + d.ballDir[1];
      if (nc <= 0 || nc >= d.width - 1) d.ballDir[1] *= -1;
      if (nr <= 0) d.ballDir[0] *= -1;
      if (nr >= d.height - 1) {
        const halfPad = Math.floor(d.paddleWidth / 2);
        if (nc >= d.paddle - halfPad && nc <= d.paddle + halfPad) {
          d.ballDir[0] *= -1;
        } else {
          d.lost = true;
        }
      }
      if (nr >= 0 && nr < d.bricks.length && nc >= 0 && nc < d.width && d.bricks[nr][nc]) {
        d.bricks[nr][nc] = false;
        d.ballDir[0] *= -1;
        d.score += 10;
      }
      d.ball = [d.ball[0] + d.ballDir[0], d.ball[1] + d.ballDir[1]];
      d.ball[0] = Math.max(0, Math.min(d.height - 1, d.ball[0]));
      d.ball[1] = Math.max(0, Math.min(d.width - 1, d.ball[1]));
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<BreakoutState>();
    return d.lost || d.bricks.every((row) => row.every((b) => !b));
  }

  protected determineWinner(): string | null {
    const d = this.getData<BreakoutState>();
    return d.bricks.every((row) => row.every((b) => !b)) ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<BreakoutState>().score };
  }
}

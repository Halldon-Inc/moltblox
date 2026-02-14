import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface PongState {
  [key: string]: unknown;
  width: number;
  height: number;
  paddles: number[];
  ball: number[];
  ballDir: number[];
  scores: number[];
  maxScore: number;
  winner: string | null;
}

export class PongGame extends BaseGame {
  readonly name = 'Pong';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): PongState {
    const w = 20,
      h = 10;
    return {
      width: w,
      height: h,
      paddles: [Math.floor(h / 2), Math.floor(h / 2)],
      ball: [Math.floor(h / 2), Math.floor(w / 2)],
      ballDir: [1, 1],
      scores: [0, 0],
      maxScore: (this.config.maxScore as number) ?? 5,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<PongState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    if (pi < 0) return { success: false, error: 'Unknown player' };

    if (action.type !== 'move') return { success: false, error: 'Use move action' };
    const dir = action.payload.direction as string;
    if (dir === 'up' && d.paddles[pi] > 0) d.paddles[pi]--;
    else if (dir === 'down' && d.paddles[pi] < d.height - 1) d.paddles[pi]++;

    // Ball step
    const nr = d.ball[0] + d.ballDir[0];
    const nc = d.ball[1] + d.ballDir[1];
    if (nr <= 0 || nr >= d.height - 1) d.ballDir[0] *= -1;
    if (nc <= 0) {
      if (Math.abs(d.paddles[0] - d.ball[0]) <= 1) {
        d.ballDir[1] *= -1;
      } else {
        d.scores[1]++;
        d.ball = [Math.floor(d.height / 2), Math.floor(d.width / 2)];
        d.ballDir = [1, 1];
      }
    } else if (nc >= d.width - 1) {
      if (Math.abs(d.paddles[1] - d.ball[0]) <= 1) {
        d.ballDir[1] *= -1;
      } else {
        d.scores[0]++;
        d.ball = [Math.floor(d.height / 2), Math.floor(d.width / 2)];
        d.ballDir = [-1, -1];
      }
    }
    d.ball = [d.ball[0] + d.ballDir[0], d.ball[1] + d.ballDir[1]];
    d.ball[0] = Math.max(0, Math.min(d.height - 1, d.ball[0]));
    d.ball[1] = Math.max(0, Math.min(d.width - 1, d.ball[1]));

    if (d.scores[0] >= d.maxScore) d.winner = players[0];
    else if (d.scores[1] >= d.maxScore) d.winner = players[1];

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<PongState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<PongState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<PongState>();
    const p = this.getPlayers();
    return { [p[0]]: d.scores[0], [p[1]]: d.scores[1] };
  }
}

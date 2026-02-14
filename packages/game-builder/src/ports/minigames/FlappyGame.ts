import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Pipe {
  x: number;
  gapY: number;
  gapSize: number;
}

interface FlappyState {
  [key: string]: unknown;
  birdY: number;
  birdVelocity: number;
  pipes: Pipe[];
  score: number;
  dead: boolean;
  height: number;
  width: number;
  pipeInterval: number;
  tick: number;
}

export class FlappyGame extends BaseGame {
  readonly name = 'Flappy Bird';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): FlappyState {
    const h = 20,
      w = 40;
    return {
      birdY: Math.floor(h / 2),
      birdVelocity: 0,
      pipes: [{ x: 15, gapY: Math.floor(h / 2), gapSize: 5 }],
      score: 0,
      dead: false,
      height: h,
      width: w,
      pipeInterval: 10,
      tick: 0,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<FlappyState>();
    if (action.type === 'flap') {
      d.birdVelocity = -3;
    } else if (action.type === 'wait') {
      // Do nothing, gravity applies
    } else {
      return { success: false, error: 'Use flap or wait' };
    }

    // Physics
    d.birdVelocity += 1; // gravity
    d.birdY += d.birdVelocity;
    d.tick++;

    // Bounds
    if (d.birdY <= 0 || d.birdY >= d.height - 1) {
      d.dead = true;
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    // Move pipes
    for (const pipe of d.pipes) pipe.x--;

    // Collision check
    const birdX = 5;
    for (const pipe of d.pipes) {
      if (pipe.x === birdX) {
        if (
          d.birdY < pipe.gapY - Math.floor(pipe.gapSize / 2) ||
          d.birdY > pipe.gapY + Math.floor(pipe.gapSize / 2)
        ) {
          d.dead = true;
        } else {
          d.score++;
        }
      }
    }

    // Remove passed pipes, add new
    d.pipes = d.pipes.filter((p) => p.x > 0);
    if (d.tick % d.pipeInterval === 0) {
      d.pipes.push({
        x: d.width - 1,
        gapY: 3 + Math.floor(Math.random() * (d.height - 6)),
        gapSize: 5,
      });
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<FlappyState>().dead;
  }
  protected determineWinner(): string | null {
    return null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<FlappyState>().score };
  }
}

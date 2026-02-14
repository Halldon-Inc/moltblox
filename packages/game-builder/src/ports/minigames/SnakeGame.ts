import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface SnakeState {
  [key: string]: unknown;
  width: number;
  height: number;
  snake: number[][];
  direction: string;
  food: number[];
  score: number;
  dead: boolean;
}

export class SnakeGame extends BaseGame {
  readonly name = 'Snake';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): SnakeState {
    const w = (this.config.width as number) ?? 10;
    const h = (this.config.height as number) ?? 10;
    const mid = [Math.floor(h / 2), Math.floor(w / 2)];
    return {
      width: w,
      height: h,
      snake: [mid, [mid[0], mid[1] - 1], [mid[0], mid[1] - 2]],
      direction: 'right',
      food: this.placeFood(w, h, [mid, [mid[0], mid[1] - 1], [mid[0], mid[1] - 2]]),
      score: 0,
      dead: false,
    };
  }

  private placeFood(w: number, h: number, snake: number[][]): number[] {
    const set = new Set(snake.map((s) => `${s[0]},${s[1]}`));
    let r: number, c: number;
    do {
      r = Math.floor(Math.random() * h);
      c = Math.floor(Math.random() * w);
    } while (set.has(`${r},${c}`));
    return [r, c];
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<SnakeState>();
    if (action.type !== 'move') return { success: false, error: 'Use move action' };

    const dir = action.payload.direction as string;
    const opposites: Record<string, string> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    if (!['up', 'down', 'left', 'right'].includes(dir))
      return { success: false, error: 'Invalid direction' };
    if (opposites[dir] === d.direction) return { success: false, error: 'Cannot reverse' };

    d.direction = dir;
    const head = [...d.snake[0]];
    if (dir === 'up') head[0]--;
    else if (dir === 'down') head[0]++;
    else if (dir === 'left') head[1]--;
    else head[1]++;

    if (head[0] < 0 || head[0] >= d.height || head[1] < 0 || head[1] >= d.width) {
      d.dead = true;
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    if (d.snake.some((s, i) => i > 0 && s[0] === head[0] && s[1] === head[1])) {
      d.dead = true;
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    d.snake.unshift(head);
    if (head[0] === d.food[0] && head[1] === d.food[1]) {
      d.score++;
      d.food = this.placeFood(d.width, d.height, d.snake);
    } else {
      d.snake.pop();
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SnakeState>().dead;
  }

  protected determineWinner(): string | null {
    return null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<SnakeState>().score };
  }
}

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Ghost {
  x: number;
  y: number;
}

interface PacManState {
  [key: string]: unknown;
  width: number;
  height: number;
  walls: boolean[][];
  dots: boolean[][];
  player: number[];
  ghosts: Ghost[];
  score: number;
  dead: boolean;
  totalDots: number;
  dotsEaten: number;
}

export class PacManGame extends BaseGame {
  readonly name = 'Pac-Man';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): PacManState {
    const w = 10,
      h = 10;
    const walls = Array.from({ length: h }, () => Array(w).fill(false));
    for (let i = 0; i < w; i++) {
      walls[0][i] = true;
      walls[h - 1][i] = true;
    }
    for (let i = 0; i < h; i++) {
      walls[i][0] = true;
      walls[i][w - 1] = true;
    }
    walls[3][3] = true;
    walls[3][4] = true;
    walls[3][5] = true;
    walls[6][3] = true;
    walls[6][4] = true;
    walls[6][5] = true;

    const dots = Array.from({ length: h }, (_, r) =>
      Array.from({ length: w }, (_, c) => !walls[r][c]),
    );
    dots[1][1] = false; // Player start
    let totalDots = 0;
    dots.forEach((row) =>
      row.forEach((d) => {
        if (d) totalDots++;
      }),
    );

    return {
      width: w,
      height: h,
      walls,
      dots,
      player: [1, 1],
      ghosts: [
        { x: 5, y: 2 },
        { x: 5, y: 7 },
      ],
      score: 0,
      dead: false,
      totalDots,
      dotsEaten: 0,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'move') return { success: false, error: 'Use move action' };
    const d = this.getData<PacManState>();
    const dir = action.payload.direction as string;
    const deltas: Record<string, number[]> = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    };
    const delta = deltas[dir];
    if (!delta) return { success: false, error: 'Invalid direction' };

    const nr = d.player[0] + delta[0],
      nc = d.player[1] + delta[1];
    if (!d.walls[nr]?.[nc]) {
      d.player = [nr, nc];
      if (d.dots[nr][nc]) {
        d.dots[nr][nc] = false;
        d.score += 10;
        d.dotsEaten++;
      }
    }

    // Move ghosts toward player
    for (const g of d.ghosts) {
      const dx = Math.sign(d.player[1] - g.x);
      const dy = Math.sign(d.player[0] - g.y);
      const nx = g.x + dx,
        ny = g.y + dy;
      if (!d.walls[ny]?.[nx]) {
        g.x = nx;
        g.y = ny;
      } else if (!d.walls[g.y]?.[nx]) {
        g.x = nx;
      } else if (!d.walls[ny]?.[g.x]) {
        g.y = ny;
      }
    }

    // Check ghost collision
    for (const g of d.ghosts) {
      if (g.x === d.player[1] && g.y === d.player[0]) d.dead = true;
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<PacManState>();
    return d.dead || d.dotsEaten >= d.totalDots;
  }

  protected determineWinner(): string | null {
    const d = this.getData<PacManState>();
    return d.dotsEaten >= d.totalDots ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<PacManState>().score };
  }
}

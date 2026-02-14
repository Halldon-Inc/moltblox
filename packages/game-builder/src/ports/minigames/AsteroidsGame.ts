import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Asteroid {
  x: number;
  y: number;
  size: number;
}

interface AsteroidsState {
  [key: string]: unknown;
  shipX: number;
  shipY: number;
  shipDir: number; // 0=up, 1=right, 2=down, 3=left
  asteroids: Asteroid[];
  bullets: number[][];
  score: number;
  dead: boolean;
  width: number;
  height: number;
  tick: number;
}

export class AsteroidsGame extends BaseGame {
  readonly name = 'Asteroids';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): AsteroidsState {
    const w = 20,
      h = 20;
    const asteroids: Asteroid[] = [];
    for (let i = 0; i < 5; i++) {
      asteroids.push({
        x: Math.floor(Math.random() * w),
        y: Math.floor(Math.random() * (h / 2)),
        size: 2,
      });
    }
    return {
      shipX: Math.floor(w / 2),
      shipY: h - 2,
      shipDir: 0,
      asteroids,
      bullets: [],
      score: 0,
      dead: false,
      width: w,
      height: h,
      tick: 0,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<AsteroidsState>();
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]; // up, right, down, left

    if (action.type === 'rotate') {
      const dir = action.payload.direction as string;
      if (dir === 'left') d.shipDir = (d.shipDir + 3) % 4;
      else if (dir === 'right') d.shipDir = (d.shipDir + 1) % 4;
      else return { success: false, error: 'left or right' };
    } else if (action.type === 'thrust') {
      const dx = dirs[d.shipDir];
      d.shipX = (d.shipX + dx[0] + d.width) % d.width;
      d.shipY = (d.shipY + dx[1] + d.height) % d.height;
    } else if (action.type === 'shoot') {
      const dx = dirs[d.shipDir];
      d.bullets.push([d.shipX + dx[0], d.shipY + dx[1]]);
    } else {
      return { success: false, error: 'Unknown action' };
    }

    // Move bullets
    d.bullets = d.bullets
      .map((b) => {
        const dx = dirs[d.shipDir];
        return [(b[0] + dx[0] + d.width) % d.width, (b[1] + dx[1] + d.height) % d.height];
      })
      .filter((b) => b[0] >= 0 && b[0] < d.width && b[1] >= 0 && b[1] < d.height);

    // Move asteroids
    for (const a of d.asteroids) {
      a.y++;
      if (a.y >= d.height) {
        a.y = 0;
        a.x = Math.floor(Math.random() * d.width);
      }
    }

    // Bullet-asteroid collision
    const hitAsteroids = new Set<number>();
    const hitBullets = new Set<number>();
    for (let bi = 0; bi < d.bullets.length; bi++) {
      for (let ai = 0; ai < d.asteroids.length; ai++) {
        const a = d.asteroids[ai];
        if (
          Math.abs(d.bullets[bi][0] - a.x) <= a.size &&
          Math.abs(d.bullets[bi][1] - a.y) <= a.size
        ) {
          hitAsteroids.add(ai);
          hitBullets.add(bi);
          d.score += 100;
        }
      }
    }
    d.asteroids = d.asteroids.filter((_, i) => !hitAsteroids.has(i));
    d.bullets = d.bullets.filter((_, i) => !hitBullets.has(i));

    // Ship collision
    for (const a of d.asteroids) {
      if (Math.abs(d.shipX - a.x) <= a.size && Math.abs(d.shipY - a.y) <= a.size) {
        d.dead = true;
      }
    }

    // Spawn new asteroids
    d.tick++;
    if (d.tick % 5 === 0) {
      d.asteroids.push({
        x: Math.floor(Math.random() * d.width),
        y: 0,
        size: 1 + Math.floor(Math.random() * 2),
      });
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<AsteroidsState>().dead;
  }
  protected determineWinner(): string | null {
    return null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<AsteroidsState>().score };
  }
}

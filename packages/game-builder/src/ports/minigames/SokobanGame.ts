import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface SokobanState {
  [key: string]: unknown;
  width: number;
  height: number;
  walls: boolean[][];
  boxes: number[][];
  targets: number[][];
  player: number[];
  moves: number;
  won: boolean;
}

export class SokobanGame extends BaseGame {
  readonly name = 'Sokoban';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): SokobanState {
    // Simple 7x7 level
    const w = 7,
      h = 7;
    const walls = Array.from({ length: h }, () => Array(w).fill(false));
    // Border walls
    for (let i = 0; i < w; i++) {
      walls[0][i] = true;
      walls[h - 1][i] = true;
    }
    for (let i = 0; i < h; i++) {
      walls[i][0] = true;
      walls[i][w - 1] = true;
    }
    walls[2][3] = true;
    walls[4][3] = true;

    return {
      width: w,
      height: h,
      walls,
      boxes: [
        [3, 2],
        [3, 4],
      ],
      targets: [
        [3, 1],
        [3, 5],
      ],
      player: [3, 3],
      moves: 0,
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'move') return { success: false, error: 'Use move action' };
    const d = this.getData<SokobanState>();
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
    if (d.walls[nr]?.[nc]) return { success: false, error: 'Wall' };

    const boxIdx = d.boxes.findIndex((b) => b[0] === nr && b[1] === nc);
    if (boxIdx >= 0) {
      const br = nr + delta[0],
        bc = nc + delta[1];
      if (d.walls[br]?.[bc]) return { success: false, error: 'Cannot push box into wall' };
      if (d.boxes.some((b) => b[0] === br && b[1] === bc))
        return { success: false, error: 'Cannot push box into box' };
      d.boxes[boxIdx] = [br, bc];
    }

    d.player = [nr, nc];
    d.moves++;

    // Check win: all targets have boxes
    d.won = d.targets.every((t) => d.boxes.some((b) => b[0] === t[0] && b[1] === t[1]));

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SokobanState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<SokobanState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<SokobanState>();
    return { [this.getPlayers()[0]]: d.won ? Math.max(1000 - d.moves * 10, 100) : 0 };
  }
}

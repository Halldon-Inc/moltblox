import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SokobanConfig {
  level?: number;
}

// Cell types: 0=floor, 1=wall, 2=target, 3=box, 4=box_on_target, 5=player, 6=player_on_target

interface SokobanState {
  [key: string]: unknown;
  grid: number[][];
  width: number;
  height: number;
  playerRow: number;
  playerCol: number;
  moves: number;
  solved: boolean;
}

const LEVELS: { grid: number[][]; playerRow: number; playerCol: number }[] = [
  {
    grid: [
      [1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 1],
      [1, 0, 3, 2, 0, 1],
      [1, 0, 0, 0, 0, 1],
      [1, 0, 3, 2, 0, 1],
      [1, 5, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1],
    ],
    playerRow: 5,
    playerCol: 1,
  },
  {
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 3, 0, 3, 0, 1],
      [1, 2, 0, 0, 0, 2, 1],
      [1, 0, 0, 5, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
    playerRow: 4,
    playerCol: 3,
  },
  {
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 3, 0, 3, 0, 3, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 2, 0, 2, 0, 2, 0, 1],
      [1, 0, 0, 0, 5, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    playerRow: 5,
    playerCol: 4,
  },
];

export class SokobanGame extends BaseGame {
  readonly name = 'Sokoban';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SokobanState {
    const levelIdx = Math.min((this.config as SokobanConfig).level ?? 0, LEVELS.length - 1);
    const level = LEVELS[Math.max(0, levelIdx)];
    const grid = level.grid.map((row) => [...row]);

    return {
      grid,
      width: grid[0].length,
      height: grid.length,
      playerRow: level.playerRow,
      playerCol: level.playerCol,
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SokobanState>();

    if (data.solved) return { success: false, error: 'Puzzle already solved' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const direction = action.payload.direction as string;
    let dr = 0;
    let dc = 0;

    switch (direction) {
      case 'up':
        dr = -1;
        break;
      case 'down':
        dr = 1;
        break;
      case 'left':
        dc = -1;
        break;
      case 'right':
        dc = 1;
        break;
      default:
        return { success: false, error: 'Direction must be up, down, left, or right' };
    }

    const newRow = data.playerRow + dr;
    const newCol = data.playerCol + dc;

    if (newRow < 0 || newRow >= data.height || newCol < 0 || newCol >= data.width) {
      return { success: false, error: 'Cannot move outside the grid' };
    }

    const targetCell = data.grid[newRow][newCol];
    if (targetCell === 1) return { success: false, error: 'Cannot move into a wall' };

    if (targetCell === 3 || targetCell === 4) {
      const boxNewRow = newRow + dr;
      const boxNewCol = newCol + dc;

      if (boxNewRow < 0 || boxNewRow >= data.height || boxNewCol < 0 || boxNewCol >= data.width) {
        return { success: false, error: 'Cannot push box outside grid' };
      }

      const behindBox = data.grid[boxNewRow][boxNewCol];
      if (behindBox === 1 || behindBox === 3 || behindBox === 4) {
        return { success: false, error: 'Cannot push box there' };
      }

      data.grid[boxNewRow][boxNewCol] = behindBox === 2 ? 4 : 3;
      data.grid[newRow][newCol] = targetCell === 4 ? 2 : 0;
    }

    const oldCell = data.grid[data.playerRow][data.playerCol];
    data.grid[data.playerRow][data.playerCol] = oldCell === 6 ? 2 : 0;

    const newCell = data.grid[newRow][newCol];
    data.grid[newRow][newCol] = newCell === 2 ? 6 : 5;

    data.playerRow = newRow;
    data.playerCol = newCol;
    data.moves++;

    let allTargetsCovered = true;
    for (let r = 0; r < data.height; r++) {
      for (let c = 0; c < data.width; c++) {
        if (data.grid[r][c] === 2 || data.grid[r][c] === 6) allTargetsCovered = false;
      }
    }

    if (allTargetsCovered) {
      data.solved = true;
      this.emitEvent('solved', playerId, { moves: data.moves });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SokobanState>().solved;
  }

  protected determineWinner(): string | null {
    return this.getData<SokobanState>().solved ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SokobanState>();
    return { [this.getPlayers()[0]]: data.solved ? Math.max(1000 - data.moves * 5, 100) : 0 };
  }
}

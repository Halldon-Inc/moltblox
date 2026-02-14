import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TowersOfHanoiConfig {
  disks?: number;
  discs?: number;
}

interface TowersOfHanoiState {
  [key: string]: unknown;
  pegs: number[][];
  diskCount: number;
  moves: number;
  solved: boolean;
}

export class TowersOfHanoiGame extends BaseGame {
  readonly name = 'Towers of Hanoi';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): TowersOfHanoiState {
    const cfg = this.config as TowersOfHanoiConfig;
    const diskCount = cfg.discs ?? cfg.disks ?? 5;
    const pegs: number[][] = [[], [], []];
    for (let i = diskCount; i >= 1; i--) {
      pegs[0].push(i);
    }
    return { pegs, diskCount, moves: 0, solved: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TowersOfHanoiState>();

    if (data.solved) return { success: false, error: 'Puzzle already solved' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = Number(action.payload.from);
    const to = Number(action.payload.to);

    if (isNaN(from) || isNaN(to) || from < 0 || from > 2 || to < 0 || to > 2) {
      return { success: false, error: 'Invalid peg index (use 0, 1, or 2)' };
    }
    if (from === to) return { success: false, error: 'Source and destination must differ' };
    if (data.pegs[from].length === 0) return { success: false, error: 'Source peg is empty' };

    const disk = data.pegs[from][data.pegs[from].length - 1];
    const topDest = data.pegs[to].length > 0 ? data.pegs[to][data.pegs[to].length - 1] : Infinity;

    if (disk > topDest)
      return { success: false, error: 'Cannot place a larger disk on a smaller disk' };

    data.pegs[from].pop();
    data.pegs[to].push(disk);
    data.moves++;

    if (data.pegs[2].length === data.diskCount) {
      data.solved = true;
      this.emitEvent('solved', playerId, { moves: data.moves });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<TowersOfHanoiState>().solved;
  }

  protected determineWinner(): string | null {
    return this.getData<TowersOfHanoiState>().solved ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TowersOfHanoiState>();
    const optimal = Math.pow(2, data.diskCount) - 1;
    const score = data.solved ? Math.max(1000 - (data.moves - optimal) * 20, 100) : 0;
    return { [this.getPlayers()[0]]: score };
  }
}

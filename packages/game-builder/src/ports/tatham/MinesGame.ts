/**
 * MinesGame: Minesweeper
 * Reveal cells, flag mines. Numbers show adjacent mine count.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MinesConfig {
  width?: number;
  height?: number;
  mineCount?: number;
}

interface MinesState {
  [key: string]: unknown;
  width: number;
  height: number;
  mines: boolean[];
  revealed: boolean[];
  flagged: boolean[];
  adjacentCounts: number[];
  moves: number;
  gameOver: boolean;
  won: boolean;
  firstMove: boolean;
}

export class MinesGame extends BaseGame {
  readonly name = 'Minesweeper';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MinesState {
    const cfg = this.config as MinesConfig;
    const width = Math.max(5, Math.min(cfg.width ?? 9, 30));
    const height = Math.max(5, Math.min(cfg.height ?? 9, 30));
    const total = width * height;
    const mineCount = Math.max(1, Math.min(cfg.mineCount ?? Math.floor(total * 0.15), total - 9));

    return {
      width,
      height,
      mines: new Array(total).fill(false),
      revealed: new Array(total).fill(false),
      flagged: new Array(total).fill(false),
      adjacentCounts: new Array(total).fill(0),
      moves: 0,
      gameOver: false,
      won: false,
      firstMove: true,
    };
  }

  private placeMines(data: MinesState, safeIndex: number): void {
    const total = data.width * data.height;
    const safeRow = Math.floor(safeIndex / data.width);
    const safeCol = safeIndex % data.width;
    const safeSet = new Set<number>();

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeRow + dr;
        const c = safeCol + dc;
        if (r >= 0 && r < data.height && c >= 0 && c < data.width) {
          safeSet.add(r * data.width + c);
        }
      }
    }

    const mineCount = (data.mines as boolean[]).length > 0 ? Math.floor(total * 0.15) : 10;
    const cfg = this.config as MinesConfig;
    const targetMines = Math.max(
      1,
      Math.min(cfg.mineCount ?? Math.floor(total * 0.15), total - safeSet.size),
    );

    let placed = 0;
    while (placed < targetMines) {
      const idx = Math.floor(Math.random() * total);
      if (!safeSet.has(idx) && !data.mines[idx]) {
        data.mines[idx] = true;
        placed++;
      }
    }

    for (let i = 0; i < total; i++) {
      if (data.mines[i]) continue;
      let count = 0;
      const row = Math.floor(i / data.width);
      const col = i % data.width;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && r < data.height && c >= 0 && c < data.width) {
            if (data.mines[r * data.width + c]) count++;
          }
        }
      }
      data.adjacentCounts[i] = count;
    }
  }

  private floodReveal(data: MinesState, index: number): void {
    const stack = [index];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (data.revealed[idx]) continue;
      data.revealed[idx] = true;
      data.flagged[idx] = false;

      if (data.adjacentCounts[idx] === 0) {
        const row = Math.floor(idx / data.width);
        const col = idx % data.width;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < data.height && c >= 0 && c < data.width) {
              const ni = r * data.width + c;
              if (!data.revealed[ni] && !data.mines[ni]) {
                stack.push(ni);
              }
            }
          }
        }
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MinesState>();
    if (data.gameOver) {
      return { success: false, error: 'Game is over' };
    }

    const index = Number(action.payload.index);
    if (index < 0 || index >= data.width * data.height) {
      return { success: false, error: 'Invalid cell index' };
    }

    switch (action.type) {
      case 'reveal': {
        if (data.revealed[index] || data.flagged[index]) {
          return { success: false, error: 'Cell already revealed or flagged' };
        }

        if (data.firstMove) {
          this.placeMines(data, index);
          data.firstMove = false;
        }

        data.moves++;

        if (data.mines[index]) {
          data.gameOver = true;
          data.won = false;
          data.revealed[index] = true;
          this.emitEvent('mine_hit', playerId, { index });
        } else {
          this.floodReveal(data, index);
          const total = data.width * data.height;
          const mineCount = data.mines.filter(Boolean).length;
          const revealedCount = data.revealed.filter(Boolean).length;
          if (revealedCount === total - mineCount) {
            data.gameOver = true;
            data.won = true;
            this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
          }
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'flag': {
        if (data.revealed[index]) {
          return { success: false, error: 'Cannot flag revealed cell' };
        }
        data.flagged[index] = !data.flagged[index];
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<MinesState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.getData<MinesState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MinesState>();
    const playerId = this.getPlayers()[0];
    if (!data.won) return { [playerId]: 0 };
    const total = data.width * data.height;
    const mineCount = data.mines.filter(Boolean).length;
    const safeCells = total - mineCount;
    const score = Math.max(0, 1000 - (data.moves - safeCells) * 20);
    return { [playerId]: score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as MinesState;
    const visibleMines = data.mines.map((m, i) => (data.revealed[i] || data.gameOver ? m : false));
    return {
      ...state,
      data: { ...data, mines: visibleMines },
    };
  }
}

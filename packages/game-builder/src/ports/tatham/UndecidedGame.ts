/**
 * UndecidedGame (Undead): Place ghosts/vampires/zombies.
 * Mirrors reflect line of sight. Ghosts visible only in mirrors.
 * Vampires visible only directly. Zombies always visible.
 * Edge clues show count of monsters visible from that direction.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface UndecidedConfig {
  size?: number;
}

type Monster = 'ghost' | 'vampire' | 'zombie' | null;
type Mirror = '/' | '\\' | null;

interface UndecidedState {
  [key: string]: unknown;
  size: number;
  mirrors: Mirror[];
  cells: Monster[];
  fixed: boolean[];
  topClues: number[];
  bottomClues: number[];
  leftClues: number[];
  rightClues: number[];
  totalGhosts: number;
  totalVampires: number;
  totalZombies: number;
  moves: number;
  solved: boolean;
}

export class UndecidedGame extends BaseGame {
  readonly name = 'Undead';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private countVisible(
    size: number,
    mirrors: Mirror[],
    cells: Monster[],
    startR: number,
    startC: number,
    dr: number,
    dc: number,
  ): number {
    let count = 0;
    let r = startR;
    let c = startC;
    let reflected = false;

    while (r >= 0 && r < size && c >= 0 && c < size) {
      const idx = r * size + c;

      if (mirrors[idx] !== null) {
        reflected = true;
        if (mirrors[idx] === '/') {
          const newDr = -dc;
          const newDc = -dr;
          dr = newDr;
          dc = newDc;
        } else {
          const newDr = dc;
          const newDc = dr;
          dr = newDr;
          dc = newDc;
        }
      } else if (cells[idx] !== null) {
        const monster = cells[idx]!;
        if (monster === 'zombie') count++;
        else if (monster === 'vampire' && !reflected) count++;
        else if (monster === 'ghost' && reflected) count++;
      }

      r += dr;
      c += dc;
    }

    return count;
  }

  protected initializeState(_playerIds: string[]): UndecidedState {
    const cfg = this.config as UndecidedConfig;
    const size = Math.max(3, Math.min(cfg.size ?? 4, 8));
    const total = size * size;

    const mirrors: Mirror[] = new Array(total).fill(null);
    const cells: Monster[] = new Array(total).fill(null);

    const mirrorCount = Math.floor(total * 0.3);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < mirrorCount; i++) {
      mirrors[indices[i]] = Math.random() < 0.5 ? '/' : '\\';
    }

    const monsters: Monster[] = ['ghost', 'vampire', 'zombie'];
    let totalGhosts = 0;
    let totalVampires = 0;
    let totalZombies = 0;

    for (let i = 0; i < total; i++) {
      if (mirrors[i] !== null) continue;
      const m = monsters[Math.floor(Math.random() * 3)];
      cells[i] = m;
      if (m === 'ghost') totalGhosts++;
      if (m === 'vampire') totalVampires++;
      if (m === 'zombie') totalZombies++;
    }

    const topClues: number[] = [];
    const bottomClues: number[] = [];
    const leftClues: number[] = [];
    const rightClues: number[] = [];

    for (let c = 0; c < size; c++) {
      topClues.push(this.countVisible(size, mirrors, cells, 0, c, 1, 0));
      bottomClues.push(this.countVisible(size, mirrors, cells, size - 1, c, -1, 0));
    }
    for (let r = 0; r < size; r++) {
      leftClues.push(this.countVisible(size, mirrors, cells, r, 0, 0, 1));
      rightClues.push(this.countVisible(size, mirrors, cells, r, size - 1, 0, -1));
    }

    const playerCells: Monster[] = new Array(total).fill(null);
    const fixed = new Array(total).fill(false);

    for (let i = 0; i < total; i++) {
      if (mirrors[i] !== null) {
        fixed[i] = true;
        continue;
      }
      if (Math.random() < 0.2) {
        playerCells[i] = cells[i];
        fixed[i] = true;
      }
    }

    return {
      size,
      mirrors,
      cells: playerCells,
      fixed,
      topClues,
      bottomClues,
      leftClues,
      rightClues,
      totalGhosts,
      totalVampires,
      totalZombies,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: UndecidedState): boolean {
    const {
      size,
      mirrors,
      cells,
      topClues,
      bottomClues,
      leftClues,
      rightClues,
      totalGhosts,
      totalVampires,
      totalZombies,
    } = data;

    let ghosts = 0;
    let vampires = 0;
    let zombies = 0;
    for (let i = 0; i < size * size; i++) {
      if (mirrors[i] !== null) continue;
      if (cells[i] === null) return false;
      if (cells[i] === 'ghost') ghosts++;
      if (cells[i] === 'vampire') vampires++;
      if (cells[i] === 'zombie') zombies++;
    }
    if (ghosts !== totalGhosts || vampires !== totalVampires || zombies !== totalZombies)
      return false;

    for (let c = 0; c < size; c++) {
      if (this.countVisible(size, mirrors, cells, 0, c, 1, 0) !== topClues[c]) return false;
      if (this.countVisible(size, mirrors, cells, size - 1, c, -1, 0) !== bottomClues[c])
        return false;
    }
    for (let r = 0; r < size; r++) {
      if (this.countVisible(size, mirrors, cells, r, 0, 0, 1) !== leftClues[r]) return false;
      if (this.countVisible(size, mirrors, cells, r, size - 1, 0, -1) !== rightClues[r])
        return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<UndecidedState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const monster = action.payload.monster as Monster;
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.fixed[index]) {
          return { success: false, error: 'Cannot modify fixed cell' };
        }
        if (data.mirrors[index] !== null) {
          return { success: false, error: 'Cell contains mirror' };
        }
        if (
          monster !== null &&
          monster !== 'ghost' &&
          monster !== 'vampire' &&
          monster !== 'zombie'
        ) {
          return { success: false, error: 'Monster must be ghost, vampire, zombie, or null' };
        }

        data.cells[index] = monster;
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<UndecidedState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<UndecidedState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}

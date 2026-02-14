import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const DICE = 'AAEEGNELRTTYABBJOOEHRTVWCIMOTUDISTTYEABORISAAFIRSY'.match(/.{1}/g)!;

interface BoggleState {
  [key: string]: unknown;
  grid: string[][];
  found: Record<string, string[]>;
  scores: Record<string, number>;
  turnsLeft: number;
  size: number;
}

export class BoggleGame extends BaseGame {
  readonly name = 'Boggle';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): BoggleState {
    const size = 4;
    const letters = Array.from({ length: 16 }, () => DICE[Math.floor(Math.random() * DICE.length)]);
    const grid: string[][] = [];
    for (let i = 0; i < size; i++) grid.push(letters.slice(i * size, (i + 1) * size));
    return {
      grid,
      size,
      found: Object.fromEntries(playerIds.map((p) => [p, []])),
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      turnsLeft: 30,
    };
  }

  private isValidPath(grid: string[][], word: string, size: number): boolean {
    const search = (r: number, c: number, idx: number, visited: Set<string>): boolean => {
      if (idx === word.length) return true;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const key = `${r},${c}`;
      if (visited.has(key) || grid[r][c] !== word[idx]) return false;
      visited.add(key);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (search(r + dr, c + dc, idx + 1, visited)) return true;
        }
      visited.delete(key);
      return false;
    };
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        if (search(r, c, 0, new Set())) return true;
      }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    if (action.type !== 'submit') return { success: false, error: 'Use submit action' };
    const d = this.getData<BoggleState>();
    const word = ((action.payload.word as string) || '').toUpperCase();
    if (word.length < 3) return { success: false, error: 'Word must be at least 3 letters' };

    for (const pid of Object.keys(d.found)) {
      if (d.found[pid].includes(word)) return { success: false, error: 'Already found' };
    }

    if (!this.isValidPath(d.grid, word, d.size))
      return { success: false, error: 'Not a valid path' };

    d.found[playerId].push(word);
    const points =
      word.length <= 4
        ? 1
        : word.length <= 5
          ? 2
          : word.length <= 6
            ? 3
            : word.length <= 7
              ? 5
              : 11;
    d.scores[playerId] += points;
    d.turnsLeft--;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<BoggleState>().turnsLeft <= 0;
  }
  protected determineWinner(): string | null {
    const d = this.getData<BoggleState>();
    let best = '',
      bestScore = -1;
    for (const [p, s] of Object.entries(d.scores)) {
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return bestScore > 0 ? best : null;
  }
  protected calculateScores(): Record<string, number> {
    return { ...this.getData<BoggleState>().scores };
  }
}

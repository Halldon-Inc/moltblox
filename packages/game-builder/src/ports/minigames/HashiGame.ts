import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Island {
  id: number;
  row: number;
  col: number;
  value: number;
}

interface HashiState {
  [key: string]: unknown;
  islands: Island[];
  bridges: Record<string, number>;
  won: boolean;
}

export class HashiGame extends BaseGame {
  readonly name = 'Hashi';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): HashiState {
    const islands: Island[] = [
      { id: 0, row: 0, col: 0, value: 2 },
      { id: 1, row: 0, col: 4, value: 2 },
      { id: 2, row: 2, col: 0, value: 2 },
      { id: 3, row: 2, col: 4, value: 2 },
    ];
    return { islands, bridges: {}, won: false };
  }

  private bridgeKey(a: number, b: number): string {
    return `${Math.min(a, b)}-${Math.max(a, b)}`;
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'bridge') return { success: false, error: 'Use bridge action' };
    const d = this.getData<HashiState>();
    const i1 = Number(action.payload.island1),
      i2 = Number(action.payload.island2);
    if (!d.islands.find((i) => i.id === i1) || !d.islands.find((i) => i.id === i2))
      return { success: false, error: 'Invalid island' };
    if (i1 === i2) return { success: false, error: 'Same island' };

    const key = this.bridgeKey(i1, i2);
    const current = d.bridges[key] || 0;
    if (current >= 2) return { success: false, error: 'Max 2 bridges between islands' };
    d.bridges[key] = current + 1;

    // Check win: each island has exactly value bridges
    let allCorrect = true;
    for (const island of d.islands) {
      let count = 0;
      for (const other of d.islands) {
        if (other.id === island.id) continue;
        count += d.bridges[this.bridgeKey(island.id, other.id)] || 0;
      }
      if (count !== island.value) allCorrect = false;
    }
    if (allCorrect) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<HashiState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<HashiState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<HashiState>().won ? 100 : 0 };
  }
}

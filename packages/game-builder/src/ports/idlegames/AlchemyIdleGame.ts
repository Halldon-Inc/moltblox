import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface AlchemyState {
  [key: string]: unknown;
  elements: Record<string, number>;
  potions: Record<string, number>;
  recipes: Record<string, { e1: string; e2: string; result: string }>;
  gold: number;
  totalGold: number;
  target: number;
}

export class AlchemyIdleGame extends BaseGame {
  readonly name = 'Alchemy Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): AlchemyState {
    return {
      elements: { fire: 10, water: 10, earth: 10, air: 10 },
      potions: {},
      recipes: {
        'fire+water': { e1: 'fire', e2: 'water', result: 'steam_potion' },
        'earth+water': { e1: 'earth', e2: 'water', result: 'mud_potion' },
        'fire+air': { e1: 'fire', e2: 'air', result: 'energy_potion' },
        'earth+fire': { e1: 'earth', e2: 'fire', result: 'lava_potion' },
        'water+air': { e1: 'water', e2: 'air', result: 'mist_potion' },
        'earth+air': { e1: 'earth', e2: 'air', result: 'dust_potion' },
      },
      gold: 0,
      totalGold: 0,
      target: 300,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<AlchemyState>();

    if (action.type === 'combine') {
      const e1 = action.payload.element1 as string;
      const e2 = action.payload.element2 as string;
      const key1 = `${e1}+${e2}`,
        key2 = `${e2}+${e1}`;
      const recipe = d.recipes[key1] || d.recipes[key2];
      if (!recipe) return { success: false, error: 'No recipe for this combination' };
      if ((d.elements[e1] || 0) < 1 || (d.elements[e2] || 0) < 1)
        return { success: false, error: 'Not enough elements' };
      d.elements[e1]--;
      d.elements[e2]--;
      d.potions[recipe.result] = (d.potions[recipe.result] || 0) + 1;
    } else if (action.type === 'sell') {
      const potionId = action.payload.potionId as string;
      if (!d.potions[potionId] || d.potions[potionId] <= 0)
        return { success: false, error: 'No potions to sell' };
      d.potions[potionId]--;
      const value = 20;
      d.gold += value;
      d.totalGold += value;
    } else {
      return { success: false, error: 'Use combine or sell' };
    }

    // Passive element regeneration
    for (const e of ['fire', 'water', 'earth', 'air']) {
      d.elements[e] = (d.elements[e] || 0) + 1;
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<AlchemyState>().totalGold >= this.getData<AlchemyState>().target;
  }
  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<AlchemyState>().totalGold };
  }
}

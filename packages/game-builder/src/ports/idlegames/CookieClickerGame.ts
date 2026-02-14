/**
 * CookieClickerGame: Click to earn cookies, buy producers that generate
 * cookies per tick, and purchase upgrades that multiply production.
 *
 * Actions: click, buy_producer, buy_upgrade
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Producer {
  id: string;
  name: string;
  baseCost: number;
  owned: number;
  baseRate: number;
  [key: string]: unknown;
}

interface CookieUpgrade {
  id: string;
  name: string;
  cost: number;
  purchased: boolean;
  multiplier: number;
  target: string;
  [key: string]: unknown;
}

interface CookieState {
  cookies: number;
  totalCookies: number;
  cookiesPerClick: number;
  cookiesPerTick: number;
  producers: Producer[];
  upgrades: CookieUpgrade[];
  globalMultiplier: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const PRODUCERS: Array<{ id: string; name: string; baseCost: number; baseRate: number }> = [
  { id: 'cursor', name: 'Cursor', baseCost: 15, baseRate: 0.1 },
  { id: 'grandma', name: 'Grandma', baseCost: 100, baseRate: 1 },
  { id: 'farm', name: 'Farm', baseCost: 1100, baseRate: 8 },
  { id: 'mine', name: 'Mine', baseCost: 12000, baseRate: 47 },
  { id: 'factory', name: 'Factory', baseCost: 130000, baseRate: 260 },
  { id: 'bank', name: 'Bank', baseCost: 1400000, baseRate: 1400 },
  { id: 'temple', name: 'Temple', baseCost: 20000000, baseRate: 7800 },
  { id: 'wizard_tower', name: 'Wizard Tower', baseCost: 330000000, baseRate: 44000 },
];

const UPGRADES: Array<{
  id: string;
  name: string;
  cost: number;
  multiplier: number;
  target: string;
}> = [
  {
    id: 'reinforced_index',
    name: 'Reinforced Index Finger',
    cost: 100,
    multiplier: 2,
    target: 'cursor',
  },
  {
    id: 'forwards_from_grandma',
    name: 'Forwards from Grandma',
    cost: 1000,
    multiplier: 2,
    target: 'grandma',
  },
  { id: 'cheap_hoes', name: 'Cheap Hoes', cost: 11000, multiplier: 2, target: 'farm' },
  { id: 'sugar_gas', name: 'Sugar Gas', cost: 120000, multiplier: 2, target: 'mine' },
  {
    id: 'sturdier_conveyor',
    name: 'Sturdier Conveyor Belts',
    cost: 1300000,
    multiplier: 2,
    target: 'factory',
  },
  { id: 'taller_tellers', name: 'Taller Tellers', cost: 14000000, multiplier: 2, target: 'bank' },
  { id: 'golden_idol', name: 'Golden Idol', cost: 200000000, multiplier: 2, target: 'temple' },
  {
    id: 'pointier_hats',
    name: 'Pointier Hats',
    cost: 3300000000,
    multiplier: 2,
    target: 'wizard_tower',
  },
  { id: 'global_boost_1', name: 'Cookie Monster', cost: 50000, multiplier: 1.5, target: 'all' },
  { id: 'global_boost_2', name: 'Cookie Storm', cost: 5000000, multiplier: 1.5, target: 'all' },
];

export class CookieClickerGame extends BaseGame {
  readonly name = 'Cookie Clicker';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): CookieState {
    const producers: Producer[] = PRODUCERS.map((p) => ({
      ...p,
      owned: 0,
    }));

    const upgrades: CookieUpgrade[] = UPGRADES.map((u) => ({
      ...u,
      purchased: false,
    }));

    return {
      cookies: 0,
      totalCookies: 0,
      cookiesPerClick: 1,
      cookiesPerTick: 0,
      producers,
      upgrades,
      globalMultiplier: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private recalcRates(data: CookieState): void {
    let totalPerTick = 0;
    for (const prod of data.producers) {
      let rate = prod.baseRate * prod.owned;
      for (const up of data.upgrades) {
        if (up.purchased && up.target === prod.id) {
          rate *= up.multiplier;
        }
      }
      totalPerTick += rate;
    }
    data.cookiesPerTick = totalPerTick * data.globalMultiplier;
  }

  private tickProduction(data: CookieState): void {
    data.tickCount++;
    const gained = data.cookiesPerTick;
    data.cookies += gained;
    data.totalCookies += gained;
  }

  private producerCost(producer: Producer): number {
    return Math.floor(producer.baseCost * Math.pow(1.15, producer.owned));
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CookieState>();

    this.tickProduction(data);

    switch (action.type) {
      case 'click': {
        const gained = data.cookiesPerClick * data.globalMultiplier;
        data.cookies += gained;
        data.totalCookies += gained;
        data.score += 1;
        this.emitEvent('click', playerId, { gained });
        break;
      }

      case 'buy_producer': {
        const producerId = String(action.payload.producerId);
        const prod = data.producers.find((p) => p.id === producerId);
        if (!prod) return { success: false, error: 'Unknown producer' };
        const cost = this.producerCost(prod);
        if (data.cookies < cost) return { success: false, error: 'Not enough cookies' };
        data.cookies -= cost;
        prod.owned++;
        this.recalcRates(data);
        data.score += 10;
        this.emitEvent('buy_producer', playerId, { producer: prod.name, owned: prod.owned });
        break;
      }

      case 'buy_upgrade': {
        const upgradeId = String(action.payload.upgradeId);
        const upgrade = data.upgrades.find((u) => u.id === upgradeId);
        if (!upgrade) return { success: false, error: 'Unknown upgrade' };
        if (upgrade.purchased) return { success: false, error: 'Already purchased' };
        if (data.cookies < upgrade.cost) return { success: false, error: 'Not enough cookies' };
        data.cookies -= upgrade.cost;
        upgrade.purchased = true;
        if (upgrade.target === 'all') {
          data.globalMultiplier *= upgrade.multiplier;
        }
        this.recalcRates(data);
        data.score += 50;
        this.emitEvent('buy_upgrade', playerId, { upgrade: upgrade.name });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CookieState>();
    return data.totalCookies >= 1e12;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CookieState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

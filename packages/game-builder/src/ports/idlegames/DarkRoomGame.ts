/**
 * DarkRoomGame: A Dark Room inspired text adventure + idle hybrid.
 * Start with a flickering fire in a dark room. Stoke the fire,
 * gather wood, build huts, attract villagers. Unlock trade routes
 * and exploration as your settlement grows.
 *
 * Actions: stoke_fire, gather, build, trade, explore
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type FireLevel = 'dead' | 'smouldering' | 'flickering' | 'burning' | 'roaring';

interface Building {
  id: string;
  name: string;
  count: number;
  cost: Record<string, number>;
  effect: string;
  [key: string]: unknown;
}

interface TradeRoute {
  id: string;
  name: string;
  gives: Record<string, number>;
  takes: Record<string, number>;
  unlocked: boolean;
  [key: string]: unknown;
}

interface ExploreResult {
  description: string;
  resources: Record<string, number>;
  [key: string]: unknown;
}

interface DarkRoomState {
  fireLevel: FireLevel;
  fireLevelIndex: number;
  resources: Record<string, number>;
  buildings: Building[];
  villagers: number;
  maxVillagers: number;
  tradeRoutes: TradeRoute[];
  exploredLocations: number;
  totalLocations: number;
  gatherMultiplier: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const FIRE_LEVELS: FireLevel[] = ['dead', 'smouldering', 'flickering', 'burning', 'roaring'];

const BUILDINGS: Array<{ id: string; name: string; cost: Record<string, number>; effect: string }> =
  [
    { id: 'hut', name: 'Hut', cost: { wood: 10 }, effect: 'population' },
    { id: 'trap', name: 'Trap', cost: { wood: 10, leather: 2 }, effect: 'gather_fur' },
    { id: 'cart', name: 'Cart', cost: { wood: 30, iron: 5 }, effect: 'gather_mult' },
    { id: 'lodge', name: 'Lodge', cost: { wood: 50, fur: 10 }, effect: 'population_large' },
    {
      id: 'trading_post',
      name: 'Trading Post',
      cost: { wood: 100, fur: 20, iron: 10 },
      effect: 'trade',
    },
    { id: 'tannery', name: 'Tannery', cost: { wood: 25, fur: 5 }, effect: 'leather' },
    { id: 'smokehouse', name: 'Smokehouse', cost: { wood: 50, meat: 10 }, effect: 'food_preserve' },
    {
      id: 'workshop',
      name: 'Workshop',
      cost: { wood: 80, leather: 20, iron: 10 },
      effect: 'crafting',
    },
  ];

const TRADE_ROUTES: Array<{
  id: string;
  name: string;
  gives: Record<string, number>;
  takes: Record<string, number>;
}> = [
  { id: 'fur_trader', name: 'Fur Trader', gives: { fur: 5 }, takes: { wood: 10 } },
  { id: 'iron_merchant', name: 'Iron Merchant', gives: { iron: 3 }, takes: { fur: 10 } },
  { id: 'cloth_dealer', name: 'Cloth Dealer', gives: { cloth: 5 }, takes: { leather: 8 } },
  { id: 'exotic_trader', name: 'Exotic Trader', gives: { gems: 1 }, takes: { cloth: 10, iron: 5 } },
];

const EXPLORE_ENCOUNTERS: ExploreResult[] = [
  { description: 'Found an abandoned campsite', resources: { wood: 15, cloth: 2 } },
  { description: 'Discovered a small cave with supplies', resources: { iron: 5, meat: 10 } },
  { description: 'Found a hidden grove', resources: { wood: 30 } },
  { description: 'Stumbled upon old ruins', resources: { iron: 10, cloth: 5, gems: 1 } },
  { description: 'Encountered a friendly wanderer', resources: { fur: 15, meat: 8 } },
  { description: 'Found a mineral deposit', resources: { iron: 20 } },
  { description: 'Discovered ancient treasure', resources: { gems: 3, cloth: 10 } },
  { description: 'Found a fertile valley', resources: { wood: 50, meat: 20 } },
];

export class DarkRoomGame extends BaseGame {
  readonly name = 'A Dark Room';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): DarkRoomState {
    const buildings: Building[] = BUILDINGS.map((b) => ({
      ...b,
      count: 0,
    }));

    const tradeRoutes: TradeRoute[] = TRADE_ROUTES.map((t) => ({
      ...t,
      unlocked: false,
    }));

    return {
      fireLevel: 'dead',
      fireLevelIndex: 0,
      resources: {
        wood: 5,
        fur: 0,
        meat: 0,
        iron: 0,
        leather: 0,
        cloth: 0,
        gems: 0,
      },
      buildings,
      villagers: 0,
      maxVillagers: 0,
      tradeRoutes,
      exploredLocations: 0,
      totalLocations: 20,
      gatherMultiplier: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private tickSettlement(data: DarkRoomState): void {
    data.tickCount++;

    // Fire decays over time
    if (data.tickCount % 5 === 0 && data.fireLevelIndex > 0) {
      data.fireLevelIndex = Math.max(0, data.fireLevelIndex - 1);
      data.fireLevel = FIRE_LEVELS[data.fireLevelIndex];
    }

    // Villagers gather resources passively
    if (data.villagers > 0) {
      const gatherRate = data.villagers * 0.5 * data.gatherMultiplier;
      data.resources.wood = (data.resources.wood ?? 0) + gatherRate;
    }

    // Traps produce fur
    const traps = data.buildings.find((b) => b.id === 'trap');
    if (traps && traps.count > 0) {
      data.resources.fur = (data.resources.fur ?? 0) + traps.count * 0.3;
    }

    // Tannery converts fur to leather
    const tannery = data.buildings.find((b) => b.id === 'tannery');
    if (tannery && tannery.count > 0 && (data.resources.fur ?? 0) >= 2) {
      const convert = Math.min(tannery.count, Math.floor((data.resources.fur ?? 0) / 2));
      data.resources.fur = (data.resources.fur ?? 0) - convert * 2;
      data.resources.leather = (data.resources.leather ?? 0) + convert;
    }

    // Smokehouse preserves meat (prevents decay)
    const smokehouse = data.buildings.find((b) => b.id === 'smokehouse');
    if (!smokehouse || smokehouse.count === 0) {
      // Meat decays without smokehouse
      if ((data.resources.meat ?? 0) > 10) {
        data.resources.meat = (data.resources.meat ?? 0) * 0.95;
      }
    }

    // Villagers attracted by fire
    if (data.fireLevelIndex >= 3 && data.villagers < data.maxVillagers) {
      if (data.tickCount % 10 === 0) {
        data.villagers++;
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DarkRoomState>();

    this.tickSettlement(data);

    switch (action.type) {
      case 'stoke_fire': {
        if ((data.resources.wood ?? 0) < 1) {
          return { success: false, error: 'No wood to stoke the fire' };
        }
        data.resources.wood = (data.resources.wood ?? 0) - 1;
        data.fireLevelIndex = Math.min(FIRE_LEVELS.length - 1, data.fireLevelIndex + 1);
        data.fireLevel = FIRE_LEVELS[data.fireLevelIndex];
        data.score += 1;
        this.emitEvent('stoke_fire', playerId, { level: data.fireLevel });
        break;
      }

      case 'gather': {
        const resourceType = String(action.payload.resourceType ?? 'wood');
        let amount: number;
        switch (resourceType) {
          case 'wood':
            amount = 5 * data.gatherMultiplier;
            break;
          case 'meat':
            amount = 3 * data.gatherMultiplier;
            break;
          case 'fur':
            amount = 2 * data.gatherMultiplier;
            break;
          default:
            return { success: false, error: 'Can only manually gather wood, meat, or fur' };
        }
        data.resources[resourceType] = (data.resources[resourceType] ?? 0) + amount;
        data.score += 2;
        this.emitEvent('gather', playerId, { resource: resourceType, amount });
        break;
      }

      case 'build': {
        const buildingId = String(action.payload.buildingId);
        const building = data.buildings.find((b) => b.id === buildingId);
        if (!building) return { success: false, error: 'Unknown building' };

        // Scale cost with count
        const costScale = Math.pow(1.3, building.count);
        for (const [resource, baseCost] of Object.entries(building.cost)) {
          const cost = Math.ceil(baseCost * costScale);
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        // Deduct costs
        for (const [resource, baseCost] of Object.entries(building.cost)) {
          const cost = Math.ceil(baseCost * costScale);
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        building.count++;

        // Apply building effects
        switch (building.effect) {
          case 'population':
            data.maxVillagers += 2;
            break;
          case 'population_large':
            data.maxVillagers += 5;
            break;
          case 'gather_mult':
            data.gatherMultiplier += 0.25;
            break;
          case 'trade': {
            // Unlock a trade route
            const locked = data.tradeRoutes.filter((t) => !t.unlocked);
            if (locked.length > 0) locked[0].unlocked = true;
            break;
          }
        }

        data.score += 20;
        this.emitEvent('build', playerId, { building: building.name, count: building.count });
        break;
      }

      case 'trade': {
        const routeId = String(action.payload.routeId);
        const route = data.tradeRoutes.find((r) => r.id === routeId);
        if (!route) return { success: false, error: 'Unknown trade route' };
        if (!route.unlocked) return { success: false, error: 'Trade route not unlocked' };

        // Check costs
        for (const [resource, amount] of Object.entries(route.takes)) {
          if ((data.resources[resource] ?? 0) < amount) {
            return { success: false, error: `Not enough ${resource}` };
          }
        }

        // Execute trade
        for (const [resource, amount] of Object.entries(route.takes)) {
          data.resources[resource] = (data.resources[resource] ?? 0) - amount;
        }
        for (const [resource, amount] of Object.entries(route.gives)) {
          data.resources[resource] = (data.resources[resource] ?? 0) + amount;
        }

        data.score += 10;
        this.emitEvent('trade', playerId, { route: route.name });
        break;
      }

      case 'explore': {
        if (data.exploredLocations >= data.totalLocations) {
          return { success: false, error: 'All locations explored' };
        }

        // Exploration requires meat for the journey
        if ((data.resources.meat ?? 0) < 5) {
          return { success: false, error: 'Need at least 5 meat for the journey' };
        }
        data.resources.meat = (data.resources.meat ?? 0) - 5;

        // Deterministic exploration based on tick count
        const encounter = EXPLORE_ENCOUNTERS[data.exploredLocations % EXPLORE_ENCOUNTERS.length];
        for (const [resource, amount] of Object.entries(encounter.resources)) {
          data.resources[resource] = (data.resources[resource] ?? 0) + amount;
        }
        data.exploredLocations++;

        data.score += 50;
        this.emitEvent('explore', playerId, {
          description: encounter.description,
          found: encounter.resources,
          explored: data.exploredLocations,
        });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<DarkRoomState>();
    return data.exploredLocations >= data.totalLocations;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<DarkRoomState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

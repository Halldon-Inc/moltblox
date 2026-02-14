/**
 * KittensGame: Manage a village of kittens. Gather catnip, build
 * huts and workshops, research science, craft materials, and trade
 * with other species. Resource management with seasonal cycles.
 *
 * Actions: gather, build, craft, research, trade
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface KittenBuilding {
  id: string;
  name: string;
  count: number;
  baseCost: Record<string, number>;
  production: Record<string, number>;
  effect: string;
  [key: string]: unknown;
}

interface KittenResearch {
  id: string;
  name: string;
  cost: Record<string, number>;
  researched: boolean;
  effect: string;
  [key: string]: unknown;
}

interface CraftRecipe {
  id: string;
  name: string;
  input: Record<string, number>;
  output: Record<string, number>;
  unlocked: boolean;
  [key: string]: unknown;
}

interface KittenTradePartner {
  id: string;
  name: string;
  gives: Record<string, number>;
  takes: Record<string, number>;
  unlocked: boolean;
  standing: number;
  [key: string]: unknown;
}

interface KittensState {
  kittens: number;
  maxKittens: number;
  resources: Record<string, number>;
  resourceRates: Record<string, number>;
  resourceCaps: Record<string, number>;
  buildings: KittenBuilding[];
  research: KittenResearch[];
  crafts: CraftRecipe[];
  traders: KittenTradePartner[];
  season: string;
  seasonIndex: number;
  year: number;
  happiness: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

const BUILDINGS: Array<{
  id: string;
  name: string;
  baseCost: Record<string, number>;
  production: Record<string, number>;
  effect: string;
}> = [
  {
    id: 'catnip_field',
    name: 'Catnip Field',
    baseCost: { catnip: 10 },
    production: { catnip: 0.63 },
    effect: 'production',
  },
  { id: 'hut', name: 'Hut', baseCost: { wood: 5 }, production: {}, effect: 'housing' },
  {
    id: 'library',
    name: 'Library',
    baseCost: { wood: 25 },
    production: { science: 0.1 },
    effect: 'science',
  },
  { id: 'barn', name: 'Barn', baseCost: { wood: 50 }, production: {}, effect: 'storage' },
  {
    id: 'workshop_bldg',
    name: 'Workshop',
    baseCost: { wood: 100, minerals: 50 },
    production: {},
    effect: 'crafting',
  },
  {
    id: 'mine',
    name: 'Mine',
    baseCost: { wood: 100 },
    production: { minerals: 0.5 },
    effect: 'production',
  },
  {
    id: 'smelter',
    name: 'Smelter',
    baseCost: { minerals: 200 },
    production: { iron: 0.1 },
    effect: 'production',
  },
  {
    id: 'temple',
    name: 'Temple',
    baseCost: { iron: 50, gold: 10 },
    production: { faith: 0.05 },
    effect: 'faith',
  },
];

const RESEARCH_LIST: Array<{
  id: string;
  name: string;
  cost: Record<string, number>;
  effect: string;
}> = [
  { id: 'calendar', name: 'Calendar', cost: { science: 30 }, effect: 'seasons' },
  { id: 'agriculture', name: 'Agriculture', cost: { science: 100 }, effect: 'catnip_boost' },
  { id: 'mining', name: 'Mining', cost: { science: 500 }, effect: 'mining' },
  { id: 'metal_working', name: 'Metal Working', cost: { science: 900 }, effect: 'smelting' },
  { id: 'civil_service', name: 'Civil Service', cost: { science: 1500 }, effect: 'happiness' },
  { id: 'mathematics', name: 'Mathematics', cost: { science: 1000 }, effect: 'science_boost' },
  { id: 'currency', name: 'Currency', cost: { science: 2200 }, effect: 'trade_unlock' },
  { id: 'astronomy', name: 'Astronomy', cost: { science: 5000 }, effect: 'observatory' },
];

const CRAFT_RECIPES: Array<{
  id: string;
  name: string;
  input: Record<string, number>;
  output: Record<string, number>;
}> = [
  { id: 'beam', name: 'Beam', input: { wood: 175 }, output: { beam: 1 } },
  { id: 'slab', name: 'Slab', input: { minerals: 250 }, output: { slab: 1 } },
  { id: 'plate', name: 'Plate', input: { iron: 125 }, output: { plate: 1 } },
  {
    id: 'manuscript',
    name: 'Manuscript',
    input: { culture: 400, furs: 25 },
    output: { manuscript: 1 },
  },
];

const TRADE_PARTNERS: Array<{
  id: string;
  name: string;
  gives: Record<string, number>;
  takes: Record<string, number>;
}> = [
  { id: 'lizards', name: 'Lizards', gives: { minerals: 50 }, takes: { catnip: 1000 } },
  { id: 'sharks', name: 'Sharks', gives: { iron: 10 }, takes: { catnip: 2000 } },
  { id: 'griffins', name: 'Griffins', gives: { wood: 100 }, takes: { iron: 15 } },
  { id: 'dragons', name: 'Dragons', gives: { gold: 5 }, takes: { iron: 50, plate: 2 } },
];

export class KittensGame extends BaseGame {
  readonly name = 'Kittens Game';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): KittensState {
    const buildings: KittenBuilding[] = BUILDINGS.map((b) => ({
      ...b,
      count: 0,
    }));

    const research: KittenResearch[] = RESEARCH_LIST.map((r) => ({
      ...r,
      researched: false,
    }));

    const crafts: CraftRecipe[] = CRAFT_RECIPES.map((c) => ({
      ...c,
      unlocked: false,
    }));

    const traders: KittenTradePartner[] = TRADE_PARTNERS.map((t) => ({
      ...t,
      unlocked: false,
      standing: 0,
    }));

    return {
      kittens: 0,
      maxKittens: 0,
      resources: {
        catnip: 0,
        wood: 0,
        minerals: 0,
        iron: 0,
        gold: 0,
        science: 0,
        culture: 0,
        faith: 0,
        furs: 0,
        beam: 0,
        slab: 0,
        plate: 0,
        manuscript: 0,
      },
      resourceRates: {},
      resourceCaps: {
        catnip: 5000,
        wood: 200,
        minerals: 250,
        iron: 50,
        gold: 10,
        science: 250,
      },
      buildings,
      research,
      crafts,
      traders,
      season: 'Spring',
      seasonIndex: 0,
      year: 0,
      happiness: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private recalcRates(data: KittensState): void {
    const rates: Record<string, number> = {};
    for (const bldg of data.buildings) {
      for (const [resource, amount] of Object.entries(bldg.production)) {
        rates[resource] = (rates[resource] ?? 0) + amount * bldg.count;
      }
    }

    // Seasonal catnip modifier
    const seasonMod: Record<string, number> = {
      Spring: 1.5,
      Summer: 1.0,
      Autumn: 1.0,
      Winter: 0.25,
    };
    if (rates.catnip) {
      rates.catnip *= seasonMod[data.season] ?? 1;
    }

    // Kittens consume catnip
    rates.catnip = (rates.catnip ?? 0) - data.kittens * 0.85;

    // Kittens produce culture slowly
    rates.culture = (rates.culture ?? 0) + data.kittens * 0.01;

    data.resourceRates = rates;
  }

  private tickVillage(data: KittensState): void {
    data.tickCount++;

    // Advance season
    if (data.tickCount % 25 === 0) {
      data.seasonIndex = (data.seasonIndex + 1) % 4;
      data.season = SEASONS[data.seasonIndex];
      if (data.seasonIndex === 0) data.year++;
      this.recalcRates(data);
    }

    // Produce resources
    for (const [resource, rate] of Object.entries(data.resourceRates)) {
      const cap = data.resourceCaps[resource];
      const current = (data.resources[resource] ?? 0) + rate;
      data.resources[resource] = cap ? Math.min(cap, Math.max(0, current)) : Math.max(0, current);
    }

    // Kitten arrival (requires huts and catnip)
    if (data.kittens < data.maxKittens && (data.resources.catnip ?? 0) > 50) {
      if (data.tickCount % 50 === 0) {
        data.kittens++;
        this.recalcRates(data);
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<KittensState>();

    this.tickVillage(data);

    switch (action.type) {
      case 'gather': {
        const resourceType = String(action.payload.resourceType ?? 'catnip');
        if (resourceType === 'catnip') {
          const amount = 10 * data.happiness;
          const cap = data.resourceCaps.catnip ?? 5000;
          data.resources.catnip = Math.min(cap, (data.resources.catnip ?? 0) + amount);
        } else {
          return { success: false, error: 'Can only manually gather catnip' };
        }
        data.score += 1;
        this.emitEvent('gather', playerId, { resource: resourceType });
        break;
      }

      case 'build': {
        const buildingId = String(action.payload.buildingId);
        const bldg = data.buildings.find((b) => b.id === buildingId);
        if (!bldg) return { success: false, error: 'Unknown building' };

        const costScale = Math.pow(1.15, bldg.count);
        for (const [resource, baseCost] of Object.entries(bldg.baseCost)) {
          const cost = Math.ceil(baseCost * costScale);
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        for (const [resource, baseCost] of Object.entries(bldg.baseCost)) {
          const cost = Math.ceil(baseCost * costScale);
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        bldg.count++;

        switch (bldg.effect) {
          case 'housing':
            data.maxKittens += 2;
            break;
          case 'storage': {
            // Increase resource caps
            const storageBonus = 0.5;
            for (const key of Object.keys(data.resourceCaps)) {
              data.resourceCaps[key] = Math.floor(
                (data.resourceCaps[key] ?? 200) * (1 + storageBonus),
              );
            }
            break;
          }
          case 'crafting':
            // Unlock craft recipes
            for (const craft of data.crafts) {
              craft.unlocked = true;
            }
            break;
        }

        this.recalcRates(data);
        data.score += 15;
        this.emitEvent('build', playerId, { building: bldg.name, count: bldg.count });
        break;
      }

      case 'craft': {
        const recipeId = String(action.payload.recipeId);
        const recipe = data.crafts.find((c) => c.id === recipeId);
        if (!recipe) return { success: false, error: 'Unknown recipe' };
        if (!recipe.unlocked)
          return { success: false, error: 'Recipe not unlocked (build a Workshop)' };

        const count = Math.max(1, Number(action.payload.count ?? 1));

        for (const [resource, amount] of Object.entries(recipe.input)) {
          if ((data.resources[resource] ?? 0) < amount * count) {
            return { success: false, error: `Not enough ${resource}` };
          }
        }

        for (const [resource, amount] of Object.entries(recipe.input)) {
          data.resources[resource] = (data.resources[resource] ?? 0) - amount * count;
        }
        for (const [resource, amount] of Object.entries(recipe.output)) {
          data.resources[resource] = (data.resources[resource] ?? 0) + amount * count;
        }

        data.score += 10 * count;
        this.emitEvent('craft', playerId, { recipe: recipe.name, count });
        break;
      }

      case 'research': {
        const techId = String(action.payload.techId);
        const tech = data.research.find((r) => r.id === techId);
        if (!tech) return { success: false, error: 'Unknown research' };
        if (tech.researched) return { success: false, error: 'Already researched' };

        for (const [resource, cost] of Object.entries(tech.cost)) {
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource}` };
          }
        }

        for (const [resource, cost] of Object.entries(tech.cost)) {
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        tech.researched = true;

        switch (tech.effect) {
          case 'catnip_boost':
            // Boost all catnip field production
            for (const bldg of data.buildings) {
              if (bldg.id === 'catnip_field') {
                bldg.production.catnip = (bldg.production.catnip ?? 0) * 1.5;
              }
            }
            break;
          case 'happiness':
            data.happiness += 0.25;
            break;
          case 'science_boost':
            for (const bldg of data.buildings) {
              if (bldg.id === 'library') {
                bldg.production.science = (bldg.production.science ?? 0) * 2;
              }
            }
            break;
          case 'trade_unlock':
            for (const trader of data.traders) {
              trader.unlocked = true;
            }
            break;
        }

        this.recalcRates(data);
        data.score += 50;
        this.emitEvent('research', playerId, { tech: tech.name });
        break;
      }

      case 'trade': {
        const traderId = String(action.payload.traderId);
        const trader = data.traders.find((t) => t.id === traderId);
        if (!trader) return { success: false, error: 'Unknown trade partner' };
        if (!trader.unlocked)
          return { success: false, error: 'Trade not unlocked (research Currency)' };

        for (const [resource, amount] of Object.entries(trader.takes)) {
          if ((data.resources[resource] ?? 0) < amount) {
            return { success: false, error: `Not enough ${resource}` };
          }
        }

        for (const [resource, amount] of Object.entries(trader.takes)) {
          data.resources[resource] = (data.resources[resource] ?? 0) - amount;
        }
        for (const [resource, amount] of Object.entries(trader.gives)) {
          data.resources[resource] = (data.resources[resource] ?? 0) + amount;
        }

        trader.standing++;
        data.score += 15;
        this.emitEvent('trade', playerId, { partner: trader.name, standing: trader.standing });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<KittensState>();
    return data.year >= 100;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<KittensState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

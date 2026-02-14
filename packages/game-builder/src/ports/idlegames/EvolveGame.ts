/**
 * EvolveGame: Evolve a civilization from a single-cell organism.
 * Research technologies, build structures, manage population,
 * and reset (prestige) for permanent evolution bonuses that
 * carry over between runs.
 *
 * Actions: research, build, evolve, reset
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Technology {
  id: string;
  name: string;
  era: string;
  cost: Record<string, number>;
  researched: boolean;
  effect: string;
  [key: string]: unknown;
}

interface Structure {
  id: string;
  name: string;
  count: number;
  cost: Record<string, number>;
  effect: string;
  production: Record<string, number>;
  [key: string]: unknown;
}

interface EvolveState {
  era: string;
  eraIndex: number;
  population: number;
  maxPopulation: number;
  resources: Record<string, number>;
  resourceRates: Record<string, number>;
  technologies: Technology[];
  structures: Structure[];
  evolutionPoints: number;
  totalEvolutionPoints: number;
  evolutionBonuses: Record<string, number>;
  resetCount: number;
  globalMultiplier: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const ERAS = ['Primordial', 'Tribal', 'Medieval', 'Industrial', 'Modern', 'Space Age'];

const TECHNOLOGIES: Array<{
  id: string;
  name: string;
  era: string;
  cost: Record<string, number>;
  effect: string;
}> = [
  { id: 'fire', name: 'Fire', era: 'Primordial', cost: { food: 20 }, effect: 'production_x2' },
  {
    id: 'tools',
    name: 'Stone Tools',
    era: 'Primordial',
    cost: { food: 50, stone: 10 },
    effect: 'gather_boost',
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    era: 'Tribal',
    cost: { food: 100, wood: 50 },
    effect: 'food_production',
  },
  {
    id: 'pottery',
    name: 'Pottery',
    era: 'Tribal',
    cost: { stone: 80, wood: 30 },
    effect: 'storage_boost',
  },
  {
    id: 'metallurgy',
    name: 'Metallurgy',
    era: 'Medieval',
    cost: { stone: 200, wood: 100 },
    effect: 'metal_unlock',
  },
  {
    id: 'compass',
    name: 'Compass',
    era: 'Medieval',
    cost: { metal: 50, wood: 80 },
    effect: 'exploration',
  },
  {
    id: 'steam_power',
    name: 'Steam Power',
    era: 'Industrial',
    cost: { metal: 300, coal: 100 },
    effect: 'industry_x3',
  },
  {
    id: 'electricity',
    name: 'Electricity',
    era: 'Industrial',
    cost: { metal: 500, coal: 200 },
    effect: 'electricity',
  },
  {
    id: 'computers',
    name: 'Computers',
    era: 'Modern',
    cost: { metal: 1000, energy: 500 },
    effect: 'research_x5',
  },
  {
    id: 'rocketry',
    name: 'Rocketry',
    era: 'Modern',
    cost: { metal: 2000, energy: 1000 },
    effect: 'space_unlock',
  },
  {
    id: 'fusion',
    name: 'Fusion Power',
    era: 'Space Age',
    cost: { energy: 5000, metal: 3000 },
    effect: 'energy_x10',
  },
  {
    id: 'warp_drive',
    name: 'Warp Drive',
    era: 'Space Age',
    cost: { energy: 20000, metal: 10000 },
    effect: 'victory',
  },
];

const STRUCTURES: Array<{
  id: string;
  name: string;
  cost: Record<string, number>;
  effect: string;
  production: Record<string, number>;
}> = [
  { id: 'hut', name: 'Hut', cost: { wood: 10 }, effect: 'housing', production: {} },
  {
    id: 'farm',
    name: 'Farm',
    cost: { wood: 20, stone: 5 },
    effect: 'production',
    production: { food: 3 },
  },
  {
    id: 'quarry',
    name: 'Quarry',
    cost: { wood: 30 },
    effect: 'production',
    production: { stone: 2 },
  },
  {
    id: 'lumber_camp',
    name: 'Lumber Camp',
    cost: { stone: 15 },
    effect: 'production',
    production: { wood: 2 },
  },
  {
    id: 'mine',
    name: 'Mine',
    cost: { wood: 50, stone: 30 },
    effect: 'production',
    production: { metal: 1, coal: 1 },
  },
  {
    id: 'power_plant',
    name: 'Power Plant',
    cost: { metal: 100, coal: 50 },
    effect: 'production',
    production: { energy: 5 },
  },
  {
    id: 'lab',
    name: 'Research Lab',
    cost: { metal: 200, energy: 100 },
    effect: 'research',
    production: {},
  },
];

export class EvolveGame extends BaseGame {
  readonly name = 'Evolve';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): EvolveState {
    const technologies: Technology[] = TECHNOLOGIES.map((t) => ({
      ...t,
      researched: false,
    }));

    const structures: Structure[] = STRUCTURES.map((s) => ({
      ...s,
      count: 0,
    }));

    return {
      era: 'Primordial',
      eraIndex: 0,
      population: 1,
      maxPopulation: 5,
      resources: {
        food: 10,
        wood: 0,
        stone: 0,
        metal: 0,
        coal: 0,
        energy: 0,
      },
      resourceRates: {
        food: 1,
        wood: 0,
        stone: 0,
        metal: 0,
        coal: 0,
        energy: 0,
      },
      technologies,
      structures,
      evolutionPoints: 0,
      totalEvolutionPoints: 0,
      evolutionBonuses: {
        production: 0,
        research: 0,
        population: 0,
      },
      resetCount: 0,
      globalMultiplier: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private recalcRates(data: EvolveState): void {
    const rates: Record<string, number> = {
      food: 1,
      wood: 0,
      stone: 0,
      metal: 0,
      coal: 0,
      energy: 0,
    };

    for (const struct of data.structures) {
      for (const [resource, amount] of Object.entries(struct.production)) {
        rates[resource] = (rates[resource] ?? 0) + amount * struct.count;
      }
    }

    // Apply multipliers
    const prodBonus = 1 + (data.evolutionBonuses.production ?? 0) * 0.1;
    for (const key of Object.keys(rates)) {
      rates[key] *= data.globalMultiplier * prodBonus;
    }

    // Workers contribute to food
    rates.food += data.population * 0.5;

    data.resourceRates = rates;
  }

  private tickCivilization(data: EvolveState): void {
    data.tickCount++;

    // Produce resources
    for (const [resource, rate] of Object.entries(data.resourceRates)) {
      data.resources[resource] = (data.resources[resource] ?? 0) + rate;
    }

    // Population consumes food
    const foodConsumed = data.population * 0.5;
    data.resources.food = Math.max(0, (data.resources.food ?? 0) - foodConsumed);

    // Population growth (if food > threshold)
    if (data.resources.food > data.population * 5 && data.population < data.maxPopulation) {
      if (data.tickCount % 5 === 0) {
        data.population++;
        this.recalcRates(data);
      }
    }

    // Population decline if no food
    if (data.resources.food <= 0 && data.population > 1) {
      data.population--;
      this.recalcRates(data);
    }

    // Evolution points accumulate over time
    data.evolutionPoints += data.eraIndex * 0.1 + 0.01;
    data.totalEvolutionPoints += data.eraIndex * 0.1 + 0.01;
  }

  private updateEra(data: EvolveState): void {
    // Check if we should advance era based on technologies
    const researchedInEra: Record<string, number> = {};
    for (const tech of data.technologies) {
      if (tech.researched) {
        researchedInEra[tech.era] = (researchedInEra[tech.era] ?? 0) + 1;
      }
    }
    // Advance to next era when 2+ techs researched in current era
    const currentEraResearch = researchedInEra[data.era] ?? 0;
    if (currentEraResearch >= 2 && data.eraIndex < ERAS.length - 1) {
      data.eraIndex++;
      data.era = ERAS[data.eraIndex];
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<EvolveState>();

    this.tickCivilization(data);

    switch (action.type) {
      case 'research': {
        const techId = String(action.payload.techId);
        const tech = data.technologies.find((t) => t.id === techId);
        if (!tech) return { success: false, error: 'Unknown technology' };
        if (tech.researched) return { success: false, error: 'Already researched' };

        // Check costs
        const researchBonus = 1 + (data.evolutionBonuses.research ?? 0) * 0.15;
        for (const [resource, baseCost] of Object.entries(tech.cost)) {
          const cost = Math.floor(baseCost / researchBonus);
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        // Deduct costs
        for (const [resource, baseCost] of Object.entries(tech.cost)) {
          const cost = Math.floor(baseCost / researchBonus);
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        tech.researched = true;

        // Apply tech effects
        switch (tech.effect) {
          case 'production_x2':
            data.globalMultiplier *= 2;
            break;
          case 'gather_boost':
            data.globalMultiplier *= 1.5;
            break;
          case 'food_production':
            data.resourceRates.food += 5;
            break;
          case 'storage_boost':
            // Conceptual: no explicit storage limit in this version
            break;
          case 'industry_x3':
            data.globalMultiplier *= 3;
            break;
          case 'research_x5':
            // Reduces future research costs
            break;
        }

        this.recalcRates(data);
        this.updateEra(data);
        data.score += 50;
        this.emitEvent('research', playerId, { tech: tech.name, era: data.era });
        break;
      }

      case 'build': {
        const structId = String(action.payload.structureId);
        const struct = data.structures.find((s) => s.id === structId);
        if (!struct) return { success: false, error: 'Unknown structure' };

        // Scale cost with count
        const costScale = Math.pow(1.3, struct.count);
        for (const [resource, baseCost] of Object.entries(struct.cost)) {
          const cost = Math.ceil(baseCost * costScale);
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        // Deduct costs
        for (const [resource, baseCost] of Object.entries(struct.cost)) {
          const cost = Math.ceil(baseCost * costScale);
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        struct.count++;

        if (struct.effect === 'housing') {
          const popBonus = 1 + (data.evolutionBonuses.population ?? 0) * 0.2;
          data.maxPopulation += Math.floor(2 * popBonus);
        }

        this.recalcRates(data);
        data.score += 15;
        this.emitEvent('build', playerId, { structure: struct.name, count: struct.count });
        break;
      }

      case 'evolve': {
        // Spend evolution points on permanent bonuses
        const bonusType = String(action.payload.bonusType);
        const validBonuses = ['production', 'research', 'population'];
        if (!validBonuses.includes(bonusType)) {
          return {
            success: false,
            error: `Invalid bonus type. Choose: ${validBonuses.join(', ')}`,
          };
        }

        const cost = 10 + (data.evolutionBonuses[bonusType] ?? 0) * 5;
        if (data.evolutionPoints < cost) {
          return {
            success: false,
            error: `Need ${cost} evolution points (have ${Math.floor(data.evolutionPoints)})`,
          };
        }

        data.evolutionPoints -= cost;
        data.evolutionBonuses[bonusType] = (data.evolutionBonuses[bonusType] ?? 0) + 1;
        data.score += 30;
        this.emitEvent('evolve', playerId, {
          bonus: bonusType,
          level: data.evolutionBonuses[bonusType],
        });
        break;
      }

      case 'reset': {
        // Prestige reset: keep evolution bonuses, reset everything else
        const minReset = 100;
        if (data.score < minReset) {
          return { success: false, error: `Need at least ${minReset} score to reset` };
        }

        // Grant bonus evolution points based on score
        const bonusEP = Math.floor(data.score / 50);
        const savedBonuses = { ...data.evolutionBonuses };
        const savedTotal = data.totalEvolutionPoints + bonusEP;
        const savedResets = data.resetCount + 1;

        // Re-initialize
        const freshState = this.initializeState(this.getPlayers());
        Object.assign(data, freshState);
        data.evolutionBonuses = savedBonuses;
        data.evolutionPoints = bonusEP;
        data.totalEvolutionPoints = savedTotal;
        data.resetCount = savedResets;
        data.globalMultiplier = 1 + savedResets * 0.1;

        this.recalcRates(data);
        data.score = savedResets * 50; // Base score from resets
        this.emitEvent('reset', playerId, { resetCount: savedResets, bonusEP });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<EvolveState>();
    const warpDrive = data.technologies.find((t) => t.id === 'warp_drive');
    return warpDrive?.researched === true;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<EvolveState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

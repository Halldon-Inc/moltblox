/**
 * SpaceIdleGame: Manage a space colony. Mine asteroids for
 * resources, build ships, colonize planets, research alien
 * technologies, and establish trade routes between colonies.
 *
 * Actions: mine_asteroid, build_ship, colonize, research, trade
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Ship {
  id: string;
  type: string;
  name: string;
  miningPower: number;
  cargoCap: number;
  speed: number;
  [key: string]: unknown;
}

interface ShipBlueprint {
  type: string;
  name: string;
  miningPower: number;
  cargoCap: number;
  speed: number;
  cost: Record<string, number>;
  [key: string]: unknown;
}

interface Planet {
  id: string;
  name: string;
  colonized: boolean;
  resourceBonus: Record<string, number>;
  colonyCost: Record<string, number>;
  populationCap: number;
  population: number;
  [key: string]: unknown;
}

interface SpaceTech {
  id: string;
  name: string;
  cost: Record<string, number>;
  researched: boolean;
  effect: string;
  [key: string]: unknown;
}

interface SpaceState {
  resources: Record<string, number>;
  resourceRates: Record<string, number>;
  credits: number;
  totalCredits: number;
  ships: Ship[];
  shipCounter: number;
  blueprints: ShipBlueprint[];
  planets: Planet[];
  technologies: SpaceTech[];
  miningMultiplier: number;
  tradeMultiplier: number;
  researchMultiplier: number;
  totalColonies: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const SHIP_BLUEPRINTS: ShipBlueprint[] = [
  {
    type: 'shuttle',
    name: 'Mining Shuttle',
    miningPower: 5,
    cargoCap: 50,
    speed: 1,
    cost: { iron: 50, silicon: 20 },
  },
  {
    type: 'freighter',
    name: 'Cargo Freighter',
    miningPower: 2,
    cargoCap: 200,
    speed: 1,
    cost: { iron: 150, titanium: 30 },
  },
  {
    type: 'cruiser',
    name: 'Mining Cruiser',
    miningPower: 20,
    cargoCap: 100,
    speed: 2,
    cost: { titanium: 100, crystal: 20 },
  },
  {
    type: 'dreadnought',
    name: 'Dreadnought',
    miningPower: 50,
    cargoCap: 500,
    speed: 3,
    cost: { titanium: 500, crystal: 100, dark_matter: 10 },
  },
  {
    type: 'mothership',
    name: 'Mothership',
    miningPower: 100,
    cargoCap: 2000,
    speed: 5,
    cost: { titanium: 2000, crystal: 500, dark_matter: 100 },
  },
];

const PLANETS: Array<{
  id: string;
  name: string;
  resourceBonus: Record<string, number>;
  colonyCost: Record<string, number>;
  populationCap: number;
}> = [
  {
    id: 'mars',
    name: 'Mars',
    resourceBonus: { iron: 5, silicon: 3 },
    colonyCost: { iron: 200, silicon: 100 },
    populationCap: 100,
  },
  {
    id: 'europa',
    name: 'Europa',
    resourceBonus: { water: 10, silicon: 2 },
    colonyCost: { iron: 500, titanium: 100 },
    populationCap: 50,
  },
  {
    id: 'titan',
    name: 'Titan',
    resourceBonus: { fuel: 8, crystal: 2 },
    colonyCost: { titanium: 300, crystal: 50 },
    populationCap: 80,
  },
  {
    id: 'kepler',
    name: 'Kepler 442b',
    resourceBonus: { crystal: 5, dark_matter: 1 },
    colonyCost: { titanium: 1000, crystal: 200 },
    populationCap: 200,
  },
  {
    id: 'proxima',
    name: 'Proxima b',
    resourceBonus: { dark_matter: 5, antimatter: 1 },
    colonyCost: { dark_matter: 100, crystal: 500 },
    populationCap: 500,
  },
  {
    id: 'andromeda_prime',
    name: 'Andromeda Prime',
    resourceBonus: { antimatter: 5, dark_matter: 10 },
    colonyCost: { antimatter: 50, dark_matter: 500 },
    populationCap: 1000,
  },
];

const TECHNOLOGIES: Array<{
  id: string;
  name: string;
  cost: Record<string, number>;
  effect: string;
}> = [
  {
    id: 'improved_mining',
    name: 'Improved Mining Lasers',
    cost: { iron: 100, silicon: 50 },
    effect: 'mining_x2',
  },
  {
    id: 'warp_tech',
    name: 'Warp Technology',
    cost: { crystal: 100, titanium: 200 },
    effect: 'speed_x2',
  },
  {
    id: 'alien_alloys',
    name: 'Alien Alloys',
    cost: { crystal: 200, dark_matter: 20 },
    effect: 'ship_power_x2',
  },
  {
    id: 'quantum_trade',
    name: 'Quantum Trade Network',
    cost: { dark_matter: 50, crystal: 300 },
    effect: 'trade_x3',
  },
  {
    id: 'terraforming',
    name: 'Terraforming',
    cost: { dark_matter: 100, antimatter: 10 },
    effect: 'colony_pop_x2',
  },
  {
    id: 'dyson_sphere',
    name: 'Dyson Sphere',
    cost: { antimatter: 100, dark_matter: 500 },
    effect: 'energy_unlimited',
  },
  {
    id: 'ftl_drive',
    name: 'FTL Drive',
    cost: { antimatter: 500, dark_matter: 1000 },
    effect: 'victory',
  },
];

export class SpaceIdleGame extends BaseGame {
  readonly name = 'Space Colony';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SpaceState {
    const blueprints: ShipBlueprint[] = SHIP_BLUEPRINTS.map((b) => ({ ...b }));
    const planets: Planet[] = PLANETS.map((p) => ({
      ...p,
      colonized: false,
      population: 0,
    }));
    const technologies: SpaceTech[] = TECHNOLOGIES.map((t) => ({
      ...t,
      researched: false,
    }));

    return {
      resources: {
        iron: 100,
        silicon: 50,
        titanium: 0,
        crystal: 0,
        fuel: 20,
        water: 10,
        dark_matter: 0,
        antimatter: 0,
      },
      resourceRates: {},
      credits: 0,
      totalCredits: 0,
      ships: [],
      shipCounter: 0,
      blueprints,
      planets,
      technologies,
      miningMultiplier: 1,
      tradeMultiplier: 1,
      researchMultiplier: 1,
      totalColonies: 0,
      tickCount: 0,
      score: 0,
    };
  }

  private recalcRates(data: SpaceState): void {
    const rates: Record<string, number> = {};

    // Ships mine passively
    for (const ship of data.ships) {
      rates.iron = (rates.iron ?? 0) + ship.miningPower * 0.5 * data.miningMultiplier;
      rates.silicon = (rates.silicon ?? 0) + ship.miningPower * 0.3 * data.miningMultiplier;
    }

    // Colonies produce resources
    for (const planet of data.planets) {
      if (planet.colonized && planet.population > 0) {
        for (const [resource, bonus] of Object.entries(planet.resourceBonus)) {
          rates[resource] = (rates[resource] ?? 0) + bonus * (planet.population / 10);
        }
      }
    }

    data.resourceRates = rates;
  }

  private tickSpace(data: SpaceState): void {
    data.tickCount++;

    // Apply resource rates
    for (const [resource, rate] of Object.entries(data.resourceRates)) {
      data.resources[resource] = (data.resources[resource] ?? 0) + rate;
    }

    // Colony population growth
    for (const planet of data.planets) {
      if (planet.colonized && planet.population < planet.populationCap) {
        planet.population = Math.min(planet.populationCap, planet.population + 1);
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SpaceState>();

    this.tickSpace(data);

    switch (action.type) {
      case 'mine_asteroid': {
        // Manual mining action using all ships
        let totalMined = 0;
        for (const ship of data.ships) {
          totalMined += ship.miningPower;
        }
        totalMined = Math.max(5, totalMined) * data.miningMultiplier;

        // Distribute mined resources
        data.resources.iron = (data.resources.iron ?? 0) + totalMined * 0.4;
        data.resources.silicon = (data.resources.silicon ?? 0) + totalMined * 0.3;
        data.resources.titanium = (data.resources.titanium ?? 0) + totalMined * 0.1;

        // Rare resources based on total mining power
        if (totalMined > 50) {
          data.resources.crystal = (data.resources.crystal ?? 0) + totalMined * 0.05;
        }
        if (totalMined > 200) {
          data.resources.dark_matter = (data.resources.dark_matter ?? 0) + totalMined * 0.01;
        }

        data.score += Math.floor(totalMined / 10);
        this.emitEvent('mine_asteroid', playerId, { totalMined });
        break;
      }

      case 'build_ship': {
        const shipType = String(action.payload.shipType ?? 'shuttle');
        const blueprint = data.blueprints.find((b) => b.type === shipType);
        if (!blueprint) return { success: false, error: 'Unknown ship type' };

        for (const [resource, cost] of Object.entries(blueprint.cost)) {
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        for (const [resource, cost] of Object.entries(blueprint.cost)) {
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        data.shipCounter++;
        const ship: Ship = {
          id: `ship_${data.shipCounter}`,
          type: blueprint.type,
          name: blueprint.name,
          miningPower: blueprint.miningPower,
          cargoCap: blueprint.cargoCap,
          speed: blueprint.speed,
        };
        data.ships.push(ship);
        this.recalcRates(data);
        data.score += 20;
        this.emitEvent('build_ship', playerId, { ship: ship.name, total: data.ships.length });
        break;
      }

      case 'colonize': {
        const planetId = String(action.payload.planetId);
        const planet = data.planets.find((p) => p.id === planetId);
        if (!planet) return { success: false, error: 'Unknown planet' };
        if (planet.colonized) return { success: false, error: 'Planet already colonized' };

        // Need at least one ship
        if (data.ships.length === 0) {
          return { success: false, error: 'Need at least one ship to colonize' };
        }

        for (const [resource, cost] of Object.entries(planet.colonyCost)) {
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        for (const [resource, cost] of Object.entries(planet.colonyCost)) {
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        planet.colonized = true;
        planet.population = 10;
        data.totalColonies++;
        this.recalcRates(data);
        data.score += 100;
        this.emitEvent('colonize', playerId, { planet: planet.name });
        break;
      }

      case 'research': {
        const techId = String(action.payload.techId);
        const tech = data.technologies.find((t) => t.id === techId);
        if (!tech) return { success: false, error: 'Unknown technology' };
        if (tech.researched) return { success: false, error: 'Already researched' };

        const costMult = 1 / data.researchMultiplier;
        for (const [resource, baseCost] of Object.entries(tech.cost)) {
          const cost = Math.floor(baseCost * costMult);
          if ((data.resources[resource] ?? 0) < cost) {
            return { success: false, error: `Not enough ${resource} (need ${cost})` };
          }
        }

        for (const [resource, baseCost] of Object.entries(tech.cost)) {
          const cost = Math.floor(baseCost * costMult);
          data.resources[resource] = (data.resources[resource] ?? 0) - cost;
        }

        tech.researched = true;

        switch (tech.effect) {
          case 'mining_x2':
            data.miningMultiplier *= 2;
            break;
          case 'speed_x2':
            for (const ship of data.ships) {
              ship.speed *= 2;
            }
            break;
          case 'ship_power_x2':
            for (const ship of data.ships) {
              ship.miningPower *= 2;
            }
            data.miningMultiplier *= 1.5;
            break;
          case 'trade_x3':
            data.tradeMultiplier *= 3;
            break;
          case 'colony_pop_x2':
            for (const planet of data.planets) {
              planet.populationCap *= 2;
            }
            break;
          case 'energy_unlimited':
            data.miningMultiplier *= 5;
            data.researchMultiplier *= 2;
            break;
        }

        this.recalcRates(data);
        data.score += 75;
        this.emitEvent('research', playerId, { tech: tech.name });
        break;
      }

      case 'trade': {
        const resourceType = String(action.payload.resourceType ?? 'iron');
        const amount = Number(action.payload.amount ?? 0);
        const available = data.resources[resourceType] ?? 0;

        if (available <= 0) return { success: false, error: `No ${resourceType} to trade` };
        const sellAmount = amount > 0 ? Math.min(amount, available) : available;

        const resourceValues: Record<string, number> = {
          iron: 1,
          silicon: 2,
          titanium: 5,
          crystal: 15,
          fuel: 3,
          water: 2,
          dark_matter: 50,
          antimatter: 200,
        };

        const value = Math.floor(
          sellAmount * (resourceValues[resourceType] ?? 1) * data.tradeMultiplier,
        );
        data.resources[resourceType] = available - sellAmount;
        data.credits += value;
        data.totalCredits += value;
        data.score += Math.floor(value / 50);
        this.emitEvent('trade', playerId, {
          resource: resourceType,
          amount: sellAmount,
          credits: value,
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
    const data = this.getData<SpaceState>();
    const ftl = data.technologies.find((t) => t.id === 'ftl_drive');
    return ftl?.researched === true;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SpaceState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

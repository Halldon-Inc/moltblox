/**
 * SwarmGame: Grow a swarm of units. Gather resources with drones,
 * spawn new units (drones, warriors, queens), evolve traits,
 * and expand territory. Queens produce more units over time.
 *
 * Actions: gather, spawn, evolve, expand
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface EvolutionTrait {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  cost: number;
  effect: string;
  [key: string]: unknown;
}

interface Territory {
  id: number;
  name: string;
  resourceBonus: number;
  capacity: number;
  conquered: boolean;
  conquestCost: number;
  [key: string]: unknown;
}

interface SwarmState {
  biomass: number;
  totalBiomass: number;
  minerals: number;
  drones: number;
  warriors: number;
  queens: number;
  hives: number;
  territory: Territory[];
  traits: EvolutionTrait[];
  gatherMultiplier: number;
  spawnMultiplier: number;
  territoryCapacity: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const TERRITORIES: Array<{
  name: string;
  resourceBonus: number;
  capacity: number;
  conquestCost: number;
}> = [
  { name: 'Grasslands', resourceBonus: 1, capacity: 50, conquestCost: 0 },
  { name: 'Forest Edge', resourceBonus: 1.5, capacity: 80, conquestCost: 100 },
  { name: 'Dark Forest', resourceBonus: 2, capacity: 120, conquestCost: 300 },
  { name: 'Mountain Pass', resourceBonus: 2.5, capacity: 200, conquestCost: 800 },
  { name: 'Crystal Cave', resourceBonus: 3.5, capacity: 300, conquestCost: 2000 },
  { name: 'Volcanic Rift', resourceBonus: 5, capacity: 500, conquestCost: 5000 },
  { name: 'Ancient Ruins', resourceBonus: 8, capacity: 800, conquestCost: 15000 },
  { name: 'Nexus Core', resourceBonus: 12, capacity: 1500, conquestCost: 50000 },
];

const TRAITS: Array<{
  id: string;
  name: string;
  maxLevel: number;
  baseCost: number;
  effect: string;
}> = [
  { id: 'foraging', name: 'Enhanced Foraging', maxLevel: 10, baseCost: 50, effect: 'gather' },
  { id: 'fertility', name: 'Heightened Fertility', maxLevel: 10, baseCost: 80, effect: 'spawn' },
  { id: 'carapace', name: 'Hardened Carapace', maxLevel: 5, baseCost: 200, effect: 'defense' },
  { id: 'hive_mind', name: 'Hive Mind', maxLevel: 5, baseCost: 300, effect: 'efficiency' },
  { id: 'metamorphosis', name: 'Metamorphosis', maxLevel: 3, baseCost: 1000, effect: 'queen_rate' },
];

export class SwarmGame extends BaseGame {
  readonly name = 'Swarm';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SwarmState {
    const territory: Territory[] = TERRITORIES.map((t, i) => ({
      id: i,
      ...t,
      conquered: i === 0, // Start with grasslands
    }));

    const traits: EvolutionTrait[] = TRAITS.map((t) => ({
      ...t,
      level: 0,
      cost: t.baseCost,
    }));

    return {
      biomass: 10,
      totalBiomass: 10,
      minerals: 0,
      drones: 5,
      warriors: 0,
      queens: 0,
      hives: 1,
      territory,
      traits,
      gatherMultiplier: 1,
      spawnMultiplier: 1,
      territoryCapacity: 50,
      tickCount: 0,
      score: 0,
    };
  }

  private getResourceBonus(data: SwarmState): number {
    let bonus = 0;
    for (const t of data.territory) {
      if (t.conquered) bonus += t.resourceBonus;
    }
    return bonus;
  }

  private getTotalCapacity(data: SwarmState): number {
    let cap = 0;
    for (const t of data.territory) {
      if (t.conquered) cap += t.capacity;
    }
    return cap;
  }

  private getTotalUnits(data: SwarmState): number {
    return data.drones + data.warriors + data.queens;
  }

  private tickSwarm(data: SwarmState): void {
    data.tickCount++;

    // Drones gather biomass passively
    const resourceBonus = this.getResourceBonus(data);
    const droneGather = data.drones * 0.5 * data.gatherMultiplier * resourceBonus;
    data.biomass += droneGather;
    data.totalBiomass += droneGather;

    // Drones also gather minerals at a slower rate
    data.minerals += data.drones * 0.1 * resourceBonus;

    // Queens spawn drones passively
    const queenTrait = data.traits.find((t) => t.id === 'metamorphosis');
    const queenRate = 1 + (queenTrait ? queenTrait.level * 0.5 : 0);
    const cap = this.getTotalCapacity(data);
    const newDrones = Math.min(
      data.queens * queenRate * data.spawnMultiplier,
      cap - this.getTotalUnits(data),
    );
    if (newDrones > 0) {
      data.drones += Math.floor(newDrones);
    }

    // Hives generate small passive biomass
    data.biomass += data.hives * 2;
    data.totalBiomass += data.hives * 2;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SwarmState>();

    this.tickSwarm(data);

    switch (action.type) {
      case 'gather': {
        // Manual gather action with all drones
        const resourceBonus = this.getResourceBonus(data);
        const gathered = data.drones * 2 * data.gatherMultiplier * resourceBonus;
        const mineralsGathered = data.drones * 0.5 * resourceBonus;
        data.biomass += gathered;
        data.totalBiomass += gathered;
        data.minerals += mineralsGathered;
        data.score += Math.floor(gathered);
        this.emitEvent('gather', playerId, { biomass: gathered, minerals: mineralsGathered });
        break;
      }

      case 'spawn': {
        const unitType = String(action.payload.unitType ?? 'drone');
        const count = Math.max(1, Number(action.payload.count ?? 1));
        const cap = this.getTotalCapacity(data);
        const currentUnits = this.getTotalUnits(data);

        if (currentUnits + count > cap) {
          return { success: false, error: `Population cap reached (${currentUnits}/${cap})` };
        }

        let costPerUnit: number;
        switch (unitType) {
          case 'drone':
            costPerUnit = 5;
            break;
          case 'warrior':
            costPerUnit = 15;
            break;
          case 'queen':
            costPerUnit = 100;
            break;
          case 'hive':
            costPerUnit = 200;
            break;
          default:
            return { success: false, error: 'Unknown unit type. Use: drone, warrior, queen, hive' };
        }

        const totalCost = costPerUnit * count;
        if (data.biomass < totalCost) return { success: false, error: 'Not enough biomass' };

        data.biomass -= totalCost;
        switch (unitType) {
          case 'drone':
            data.drones += count;
            break;
          case 'warrior':
            data.warriors += count;
            break;
          case 'queen':
            data.queens += count;
            break;
          case 'hive':
            data.hives += count;
            break;
        }

        data.score += count * 5;
        this.emitEvent('spawn', playerId, { unitType, count });
        break;
      }

      case 'evolve': {
        const traitId = String(action.payload.traitId);
        const trait = data.traits.find((t) => t.id === traitId);
        if (!trait) return { success: false, error: 'Unknown trait' };
        if (trait.level >= trait.maxLevel)
          return { success: false, error: 'Trait already at max level' };

        if (data.minerals < trait.cost) return { success: false, error: 'Not enough minerals' };
        data.minerals -= trait.cost;
        trait.level++;
        trait.cost = Math.floor(trait.cost * 2);

        // Apply trait effects
        switch (trait.effect) {
          case 'gather':
            data.gatherMultiplier = 1 + trait.level * 0.3;
            break;
          case 'spawn':
            data.spawnMultiplier = 1 + trait.level * 0.2;
            break;
          case 'defense':
            // Warriors become tougher (affects expand success)
            break;
          case 'efficiency':
            // Reduces costs (handled at spawn time in future)
            break;
          case 'queen_rate':
            // Applied in tick
            break;
        }

        data.score += 50;
        this.emitEvent('evolve', playerId, { trait: trait.name, level: trait.level });
        break;
      }

      case 'expand': {
        const territoryId = Number(action.payload.territoryId);
        const territory = data.territory.find((t) => t.id === territoryId);
        if (!territory) return { success: false, error: 'Unknown territory' };
        if (territory.conquered) return { success: false, error: 'Territory already conquered' };

        // Need warriors for conquest
        const warriorsNeeded = Math.ceil(territory.conquestCost / 50);
        if (data.warriors < warriorsNeeded) {
          return { success: false, error: `Need ${warriorsNeeded} warriors` };
        }
        if (data.biomass < territory.conquestCost) {
          return { success: false, error: 'Not enough biomass' };
        }

        // Lose some warriors in the battle
        const carapaceTrait = data.traits.find((t) => t.id === 'carapace');
        const defenseBonus = carapaceTrait ? carapaceTrait.level * 0.1 : 0;
        const casualties = Math.max(1, Math.floor(warriorsNeeded * (0.3 - defenseBonus)));
        data.warriors -= casualties;
        data.biomass -= territory.conquestCost;
        territory.conquered = true;
        data.territoryCapacity = this.getTotalCapacity(data);

        data.score += 200;
        this.emitEvent('expand', playerId, {
          territory: territory.name,
          casualties,
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
    const data = this.getData<SwarmState>();
    // Game ends when all territories conquered
    return data.territory.every((t) => t.conquered);
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SwarmState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

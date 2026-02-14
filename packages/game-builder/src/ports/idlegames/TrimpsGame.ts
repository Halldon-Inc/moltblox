/**
 * TrimpsGame: Breed trimps (small creatures), send them to fight
 * enemies in zones, collect resources (food, wood, metal), build
 * structures, and use portal (prestige) for helium bonuses.
 *
 * Actions: fight, breed, build, map, portal
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface TrimpBuilding {
  id: string;
  name: string;
  count: number;
  baseCost: Record<string, number>;
  effect: string;
  [key: string]: unknown;
}

interface TrimpsState {
  trimps: number;
  maxTrimps: number;
  trimpAttack: number;
  trimpHealth: number;
  resources: Record<string, number>;
  resourceRates: Record<string, number>;
  buildings: TrimpBuilding[];
  zone: number;
  zoneCell: number;
  zoneCells: number;
  enemyHP: number;
  enemyAttack: number;
  helium: number;
  totalHelium: number;
  heliumMultiplier: number;
  portalCount: number;
  mapTokens: number;
  mapBonus: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const BUILDINGS: Array<{
  id: string;
  name: string;
  baseCost: Record<string, number>;
  effect: string;
}> = [
  { id: 'house', name: 'House', baseCost: { food: 10, wood: 10 }, effect: 'housing' },
  { id: 'trap', name: 'Trap', baseCost: { food: 10 }, effect: 'breeding' },
  { id: 'barn', name: 'Barn', baseCost: { wood: 50 }, effect: 'storage' },
  { id: 'forge', name: 'Forge', baseCost: { wood: 100, metal: 30 }, effect: 'attack' },
  { id: 'gym', name: 'Gym', baseCost: { wood: 80, food: 40 }, effect: 'health' },
  { id: 'tribute', name: 'Tribute', baseCost: { food: 1000, wood: 500 }, effect: 'gems' },
  { id: 'nursery', name: 'Nursery', baseCost: { metal: 200, gems: 5 }, effect: 'breed_speed' },
  { id: 'gateway', name: 'Gateway', baseCost: { metal: 1000, gems: 50 }, effect: 'portal_bonus' },
];

export class TrimpsGame extends BaseGame {
  readonly name = 'Trimps';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): TrimpsState {
    const buildings: TrimpBuilding[] = BUILDINGS.map((b) => ({
      ...b,
      count: 0,
    }));

    return {
      trimps: 10,
      maxTrimps: 10,
      trimpAttack: 5,
      trimpHealth: 50,
      resources: {
        food: 0,
        wood: 0,
        metal: 0,
        gems: 0,
      },
      resourceRates: {
        food: 1,
        wood: 1,
        metal: 0,
      },
      buildings,
      zone: 1,
      zoneCell: 0,
      zoneCells: 10,
      enemyHP: 10,
      enemyAttack: 2,
      helium: 0,
      totalHelium: 0,
      heliumMultiplier: 1,
      portalCount: 0,
      mapTokens: 0,
      mapBonus: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private getEnemyStats(zone: number, cell: number): { hp: number; attack: number } {
    const baseHP = 10 * Math.pow(1.2, zone) * (1 + cell * 0.1);
    const baseAtk = 2 * Math.pow(1.15, zone) * (1 + cell * 0.05);
    return { hp: Math.floor(baseHP), attack: Math.floor(baseAtk) };
  }

  private recalcRates(data: TrimpsState): void {
    const rates: Record<string, number> = {
      food: 1,
      wood: 1,
      metal: 0,
    };

    for (const bldg of data.buildings) {
      switch (bldg.effect) {
        case 'breeding':
          // Traps increase breeding speed
          break;
        case 'gems':
          rates.gems = (rates.gems ?? 0) + bldg.count * 0.1;
          break;
      }
    }

    // Workers (trimps assigned to gather)
    const gatherTrimps = Math.min(data.trimps, Math.floor(data.trimps * 0.3));
    rates.food += gatherTrimps * 0.5;
    rates.wood += gatherTrimps * 0.3;
    rates.metal += gatherTrimps * 0.1;

    data.resourceRates = rates;
  }

  private tickTrimps(data: TrimpsState): void {
    data.tickCount++;

    // Resource production
    for (const [resource, rate] of Object.entries(data.resourceRates)) {
      data.resources[resource] = (data.resources[resource] ?? 0) + rate * data.heliumMultiplier;
    }

    // Breeding
    const traps = data.buildings.find((b) => b.id === 'trap');
    const nursery = data.buildings.find((b) => b.id === 'nursery');
    const breedRate = 0.5 + (traps?.count ?? 0) * 0.2 + (nursery?.count ?? 0) * 0.5;
    if (data.trimps < data.maxTrimps && (data.resources.food ?? 0) > 5) {
      const bred = Math.min(breedRate, data.maxTrimps - data.trimps);
      data.trimps += Math.floor(bred);
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TrimpsState>();

    this.tickTrimps(data);

    switch (action.type) {
      case 'fight': {
        if (data.trimps < 1) return { success: false, error: 'No trimps to fight' };

        const enemy = this.getEnemyStats(data.zone, data.zoneCell);
        const totalAttack = data.trimpAttack * Math.min(data.trimps, 10) * data.mapBonus;

        if (totalAttack >= enemy.hp) {
          // Victory
          const casualties = Math.max(1, Math.floor(enemy.attack / data.trimpHealth));
          data.trimps = Math.max(0, data.trimps - casualties);
          data.zoneCell++;

          // Resources from combat
          data.resources.food = (data.resources.food ?? 0) + data.zone * 5;
          data.resources.metal = (data.resources.metal ?? 0) + data.zone * 2;

          // Map tokens
          data.mapTokens += 1;

          // Zone complete
          if (data.zoneCell >= data.zoneCells) {
            data.zone++;
            data.zoneCell = 0;

            // Helium from zone completion (zones 6+)
            if (data.zone > 6) {
              const heliumGained = Math.floor(Math.pow(data.zone - 5, 2));
              data.helium += heliumGained;
              data.totalHelium += heliumGained;
            }

            this.emitEvent('zone_complete', playerId, { zone: data.zone - 1, newZone: data.zone });
          }

          data.score += data.zone;
          this.emitEvent('fight_win', playerId, {
            zone: data.zone,
            cell: data.zoneCell,
            casualties,
          });
        } else {
          // Defeat (lose some trimps)
          const lost = Math.max(1, Math.floor(data.trimps * 0.1));
          data.trimps = Math.max(0, data.trimps - lost);
          this.emitEvent('fight_loss', playerId, { lost, enemyHP: enemy.hp });
        }
        break;
      }

      case 'breed': {
        // Manual breed action using food
        const foodCost = 10;
        if ((data.resources.food ?? 0) < foodCost) {
          return { success: false, error: 'Not enough food' };
        }
        if (data.trimps >= data.maxTrimps) {
          return { success: false, error: 'Max trimps reached' };
        }
        data.resources.food = (data.resources.food ?? 0) - foodCost;
        const bred = Math.min(5, data.maxTrimps - data.trimps);
        data.trimps += bred;
        data.score += 2;
        this.emitEvent('breed', playerId, { bred, total: data.trimps });
        break;
      }

      case 'build': {
        const buildingId = String(action.payload.buildingId);
        const bldg = data.buildings.find((b) => b.id === buildingId);
        if (!bldg) return { success: false, error: 'Unknown building' };

        const costScale = Math.pow(1.2, bldg.count);
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
            data.maxTrimps += 5;
            break;
          case 'attack':
            data.trimpAttack += 2;
            break;
          case 'health':
            data.trimpHealth += 10;
            break;
          case 'storage':
            // Conceptual storage increase
            break;
          case 'portal_bonus':
            // Increases helium gained from portal
            break;
        }

        this.recalcRates(data);
        data.score += 10;
        this.emitEvent('build', playerId, { building: bldg.name, count: bldg.count });
        break;
      }

      case 'map': {
        // Run a map for bonus resources using map tokens
        if (data.mapTokens < 5) {
          return { success: false, error: 'Need 5 map tokens' };
        }
        data.mapTokens -= 5;

        // Maps give bonus resources and temporarily boost damage
        data.resources.food = (data.resources.food ?? 0) + data.zone * 20;
        data.resources.wood = (data.resources.wood ?? 0) + data.zone * 15;
        data.resources.metal = (data.resources.metal ?? 0) + data.zone * 10;
        data.mapBonus = 1 + data.zone * 0.1;

        data.score += 25;
        this.emitEvent('map', playerId, { zone: data.zone, mapBonus: data.mapBonus });
        break;
      }

      case 'portal': {
        // Prestige: reset for helium
        if (data.zone < 10) {
          return { success: false, error: 'Must reach zone 10 to use portal' };
        }

        const gatewayBonus = data.buildings.find((b) => b.id === 'gateway');
        const portalBonus = 1 + (gatewayBonus?.count ?? 0) * 0.2;
        const heliumGained = Math.floor(data.zone * data.zone * portalBonus);

        data.helium += heliumGained;
        data.totalHelium += heliumGained;
        data.portalCount++;

        // Reset game state
        data.trimps = 10;
        data.maxTrimps = 10;
        data.trimpAttack = 5 + data.portalCount * 2;
        data.trimpHealth = 50 + data.portalCount * 10;
        data.zone = 1;
        data.zoneCell = 0;
        data.resources = { food: 0, wood: 0, metal: 0, gems: 0 };
        data.mapTokens = 0;
        data.mapBonus = 1;
        for (const bldg of data.buildings) {
          bldg.count = 0;
        }

        // Helium provides global multiplier
        data.heliumMultiplier = 1 + Math.log10(Math.max(1, data.totalHelium)) * 0.5;

        this.recalcRates(data);
        data.score += 200;
        this.emitEvent('portal', playerId, {
          heliumGained,
          totalHelium: data.totalHelium,
          portalCount: data.portalCount,
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
    const data = this.getData<TrimpsState>();
    return data.zone >= 50 && data.portalCount >= 3;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TrimpsState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

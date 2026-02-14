/**
 * SurvivalGame - Idle/survival with prestige
 *
 * Gather resources, build upgrades, and prestige for permanent multipliers.
 * Resource types are configurable. Upgrade tree includes gatherers, storage,
 * automation, and efficiency.
 * Actions: gather, build_upgrade, prestige, allocate_workers.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SurvivalConfig {
  resourceTypes?: string[];
  prestigeThreshold?: number;
  upgradeSlots?: number;
}

interface Upgrade {
  id: string;
  name: string;
  category: 'gatherer' | 'storage' | 'automation' | 'efficiency';
  level: number;
  cost: Record<string, number>;
  effect: number;
  [key: string]: unknown;
}

interface SurvivalState {
  resources: Record<string, number>;
  resourceRates: Record<string, number>;
  storageCapacity: Record<string, number>;
  upgrades: Upgrade[];
  workers: Record<string, number>;
  totalWorkers: number;
  maxWorkers: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  prestigeThreshold: number;
  totalResourcesGathered: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const BASE_RATE = 1;
const BASE_STORAGE = 100;
const WORKER_RATE_BONUS = 0.5;

export class SurvivalGame extends BaseGame {
  readonly name = 'Survival';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SurvivalState {
    const cfg = this.config as SurvivalConfig;
    const resourceTypes = cfg.resourceTypes ?? ['food', 'wood', 'stone'];
    const prestigeThreshold = cfg.prestigeThreshold ?? 1000;
    const upgradeSlots = cfg.upgradeSlots ?? 5;

    const resources: Record<string, number> = {};
    const resourceRates: Record<string, number> = {};
    const storageCapacity: Record<string, number> = {};
    const workers: Record<string, number> = {};

    for (const rt of resourceTypes) {
      resources[rt] = 0;
      resourceRates[rt] = BASE_RATE;
      storageCapacity[rt] = BASE_STORAGE;
      workers[rt] = 0;
    }

    const upgrades = this.generateUpgrades(resourceTypes, upgradeSlots);

    return {
      resources,
      resourceRates,
      storageCapacity,
      upgrades,
      workers,
      totalWorkers: 0,
      maxWorkers: 3,
      prestigeLevel: 0,
      prestigeMultiplier: 1.0,
      prestigeThreshold,
      totalResourcesGathered: 0,
      tickCount: 0,
      score: 0,
    };
  }

  private generateUpgrades(resourceTypes: string[], slots: number): Upgrade[] {
    const upgrades: Upgrade[] = [];
    const categories: Upgrade['category'][] = ['gatherer', 'storage', 'automation', 'efficiency'];
    let id = 0;

    for (let i = 0; i < Math.min(slots, categories.length * resourceTypes.length); i++) {
      const cat = categories[i % categories.length];
      const rt = resourceTypes[i % resourceTypes.length];
      const baseCost: Record<string, number> = {};
      baseCost[rt] = 10 + i * 5;

      let name: string;
      let effect: number;
      switch (cat) {
        case 'gatherer':
          name = `${rt} Gatherer`;
          effect = 1;
          break;
        case 'storage':
          name = `${rt} Warehouse`;
          effect = 50;
          break;
        case 'automation':
          name = `${rt} Automator`;
          effect = 0.5;
          break;
        case 'efficiency':
          name = `${rt} Efficiency`;
          effect = 0.2;
          break;
      }

      upgrades.push({
        id: `upgrade_${id++}`,
        name,
        category: cat,
        level: 0,
        cost: baseCost,
        effect,
        resource: rt,
      });
    }

    return upgrades;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SurvivalState>();

    // Tick resources first
    this.tickResources(data);

    switch (action.type) {
      case 'gather':
        return this.handleGather(playerId, action, data);
      case 'build_upgrade':
        return this.handleBuildUpgrade(playerId, action, data);
      case 'prestige':
        return this.handlePrestige(playerId, data);
      case 'allocate_workers':
        return this.handleAllocateWorkers(playerId, action, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private tickResources(data: SurvivalState): void {
    data.tickCount++;

    for (const [rt, rate] of Object.entries(data.resourceRates)) {
      const workerBonus = (data.workers[rt] ?? 0) * WORKER_RATE_BONUS;
      const totalRate = (rate + workerBonus) * data.prestigeMultiplier;
      const cap = data.storageCapacity[rt] ?? BASE_STORAGE;
      const newAmount = Math.min(cap, (data.resources[rt] ?? 0) + totalRate);
      const gained = newAmount - (data.resources[rt] ?? 0);
      data.resources[rt] = newAmount;
      data.totalResourcesGathered += gained;
    }
  }

  private handleGather(playerId: string, action: GameAction, data: SurvivalState): ActionResult {
    const resourceType = String(action.payload.resourceType || Object.keys(data.resources)[0]);

    if (!(resourceType in data.resources)) {
      return { success: false, error: 'Invalid resource type' };
    }

    const manualBoost = 5 * data.prestigeMultiplier;
    const cap = data.storageCapacity[resourceType] ?? BASE_STORAGE;
    const prev = data.resources[resourceType] ?? 0;
    data.resources[resourceType] = Math.min(cap, prev + manualBoost);
    data.totalResourcesGathered += data.resources[resourceType] - prev;
    data.score += 1;

    this.emitEvent('gathered', playerId, { resource: resourceType, amount: manualBoost });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleBuildUpgrade(
    playerId: string,
    action: GameAction,
    data: SurvivalState,
  ): ActionResult {
    const upgradeId = String(action.payload.upgradeId);
    const upgrade = data.upgrades.find((u) => u.id === upgradeId);

    if (!upgrade) {
      return { success: false, error: 'Upgrade not found' };
    }

    // Check costs (scale with level)
    const costMultiplier = Math.pow(1.5, upgrade.level);
    for (const [rt, baseCost] of Object.entries(upgrade.cost)) {
      const cost = Math.floor(baseCost * costMultiplier);
      if ((data.resources[rt] ?? 0) < cost) {
        return { success: false, error: `Not enough ${rt}` };
      }
    }

    // Deduct costs
    for (const [rt, baseCost] of Object.entries(upgrade.cost)) {
      const cost = Math.floor(baseCost * costMultiplier);
      data.resources[rt] = (data.resources[rt] ?? 0) - cost;
    }

    upgrade.level++;
    const rt = String(upgrade.resource ?? Object.keys(data.resources)[0]);

    // Apply upgrade effect
    switch (upgrade.category) {
      case 'gatherer':
        data.resourceRates[rt] = (data.resourceRates[rt] ?? BASE_RATE) + upgrade.effect;
        break;
      case 'storage':
        data.storageCapacity[rt] = (data.storageCapacity[rt] ?? BASE_STORAGE) + upgrade.effect;
        break;
      case 'automation':
        data.resourceRates[rt] = (data.resourceRates[rt] ?? BASE_RATE) + upgrade.effect;
        break;
      case 'efficiency':
        data.resourceRates[rt] = (data.resourceRates[rt] ?? BASE_RATE) * (1 + upgrade.effect);
        break;
    }

    data.score += 10;
    this.emitEvent('upgrade_built', playerId, { upgrade: upgrade.name, level: upgrade.level });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handlePrestige(playerId: string, data: SurvivalState): ActionResult {
    if (data.totalResourcesGathered < data.prestigeThreshold) {
      return {
        success: false,
        error: `Need ${data.prestigeThreshold} total resources (have ${Math.floor(data.totalResourcesGathered)})`,
      };
    }

    data.prestigeLevel++;
    data.prestigeMultiplier = 1.0 + data.prestigeLevel * 0.25;

    // Reset resources but keep upgrades and multiplier
    for (const rt of Object.keys(data.resources)) {
      data.resources[rt] = 0;
      data.resourceRates[rt] = BASE_RATE;
      data.storageCapacity[rt] = BASE_STORAGE;
      data.workers[rt] = 0;
    }
    data.totalWorkers = 0;

    // Reset upgrade levels
    for (const upgrade of data.upgrades) {
      upgrade.level = 0;
    }

    // Increase threshold for next prestige
    data.prestigeThreshold = Math.floor(data.prestigeThreshold * 2);
    data.score += 100 * data.prestigeLevel;
    data.totalResourcesGathered = 0;

    this.emitEvent('prestige', playerId, {
      level: data.prestigeLevel,
      multiplier: data.prestigeMultiplier,
    });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleAllocateWorkers(
    _playerId: string,
    action: GameAction,
    data: SurvivalState,
  ): ActionResult {
    const resourceType = String(action.payload.resourceType);
    const count = Number(action.payload.count ?? 1);

    if (!(resourceType in data.resources)) {
      return { success: false, error: 'Invalid resource type' };
    }

    if (count < 0) {
      // Deallocate workers
      const dealloc = Math.min(Math.abs(count), data.workers[resourceType] ?? 0);
      data.workers[resourceType] = (data.workers[resourceType] ?? 0) - dealloc;
      data.totalWorkers -= dealloc;
    } else {
      // Allocate workers
      const available = data.maxWorkers - data.totalWorkers;
      const alloc = Math.min(count, available);
      if (alloc <= 0) {
        return { success: false, error: 'No workers available' };
      }
      data.workers[resourceType] = (data.workers[resourceType] ?? 0) + alloc;
      data.totalWorkers += alloc;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  // Survival game does not end on its own; it's open-ended with prestige loops.
  // Game ends after 5 prestiges as a win condition for scored play.
  protected checkGameOver(): boolean {
    const data = this.getData<SurvivalState>();
    return data.prestigeLevel >= 5;
  }

  protected determineWinner(): string | null {
    const data = this.getData<SurvivalState>();
    if (data.prestigeLevel >= 5) {
      return this.getPlayers()[0];
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SurvivalState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

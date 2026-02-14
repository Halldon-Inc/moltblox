/**
 * MinerGame: Dig for resources at increasing depths. Hire workers,
 * buy better pickaxes, and descend to deeper levels where rarer
 * resources await.
 *
 * Actions: mine, hire, buy_tool, descend
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface MinerTool {
  id: string;
  name: string;
  miningPower: number;
  cost: number;
  [key: string]: unknown;
}

interface MinerLevel {
  depth: number;
  name: string;
  resources: Record<string, number>; // resource type -> yield per mine action
  unlockCost: number;
  [key: string]: unknown;
}

interface MinerState {
  resources: Record<string, number>;
  gold: number;
  currentDepth: number;
  levels: MinerLevel[];
  workers: number;
  workerCost: number;
  currentTool: MinerTool;
  availableTools: MinerTool[];
  miningPower: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const TOOLS: MinerTool[] = [
  { id: 'wooden_pick', name: 'Wooden Pickaxe', miningPower: 1, cost: 0 },
  { id: 'stone_pick', name: 'Stone Pickaxe', miningPower: 3, cost: 50 },
  { id: 'iron_pick', name: 'Iron Pickaxe', miningPower: 8, cost: 200 },
  { id: 'gold_pick', name: 'Gold Pickaxe', miningPower: 20, cost: 1000 },
  { id: 'diamond_pick', name: 'Diamond Pickaxe', miningPower: 50, cost: 5000 },
  { id: 'mythril_pick', name: 'Mythril Pickaxe', miningPower: 150, cost: 25000 },
];

const LEVELS: Array<{
  depth: number;
  name: string;
  resources: Record<string, number>;
  unlockCost: number;
}> = [
  { depth: 1, name: 'Surface', resources: { stone: 5, coal: 1 }, unlockCost: 0 },
  { depth: 2, name: 'Shallow Cave', resources: { stone: 3, coal: 3, iron: 2 }, unlockCost: 100 },
  { depth: 3, name: 'Deep Cave', resources: { iron: 5, copper: 3, silver: 1 }, unlockCost: 500 },
  {
    depth: 4,
    name: 'Underground Lake',
    resources: { silver: 4, gold_ore: 2, gems: 1 },
    unlockCost: 2500,
  },
  {
    depth: 5,
    name: 'Magma Chamber',
    resources: { gold_ore: 5, gems: 3, diamond: 1 },
    unlockCost: 15000,
  },
  {
    depth: 6,
    name: 'Crystal Cavern',
    resources: { diamond: 5, mythril: 2, dragonstone: 1 },
    unlockCost: 100000,
  },
];

const RESOURCE_VALUES: Record<string, number> = {
  stone: 1,
  coal: 2,
  iron: 5,
  copper: 4,
  silver: 10,
  gold_ore: 25,
  gems: 50,
  diamond: 100,
  mythril: 250,
  dragonstone: 500,
};

export class MinerGame extends BaseGame {
  readonly name = 'Idle Miner';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MinerState {
    const levels: MinerLevel[] = LEVELS.map((l) => ({ ...l }));

    return {
      resources: {},
      gold: 0,
      currentDepth: 1,
      levels,
      workers: 0,
      workerCost: 25,
      currentTool: { ...TOOLS[0] },
      availableTools: TOOLS.map((t) => ({ ...t })),
      miningPower: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private getCurrentLevel(data: MinerState): MinerLevel {
    return data.levels[data.currentDepth - 1];
  }

  private tickWorkers(data: MinerState): void {
    data.tickCount++;
    if (data.workers <= 0) return;

    const level = this.getCurrentLevel(data);
    // Workers mine automatically at reduced efficiency
    const workerEfficiency = 0.3;
    for (const [resource, baseYield] of Object.entries(level.resources)) {
      const mined = baseYield * data.workers * workerEfficiency * data.miningPower;
      data.resources[resource] = (data.resources[resource] ?? 0) + mined;
      const goldValue = mined * (RESOURCE_VALUES[resource] ?? 1);
      data.gold += goldValue;
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MinerState>();

    this.tickWorkers(data);

    switch (action.type) {
      case 'mine': {
        const level = this.getCurrentLevel(data);
        for (const [resource, baseYield] of Object.entries(level.resources)) {
          const mined = baseYield * data.miningPower;
          data.resources[resource] = (data.resources[resource] ?? 0) + mined;
          const goldValue = mined * (RESOURCE_VALUES[resource] ?? 1);
          data.gold += goldValue;
        }
        data.score += data.currentDepth;
        this.emitEvent('mine', playerId, { depth: data.currentDepth, level: level.name });
        break;
      }

      case 'hire': {
        const count = Math.max(1, Number(action.payload.count ?? 1));
        const totalCost = data.workerCost * count;
        if (data.gold < totalCost) return { success: false, error: 'Not enough gold' };
        data.gold -= totalCost;
        data.workers += count;
        // Worker cost increases with each hire
        data.workerCost = Math.floor(25 * Math.pow(1.1, data.workers));
        data.score += count * 5;
        this.emitEvent('hire', playerId, { workers: data.workers, count });
        break;
      }

      case 'buy_tool': {
        const toolId = String(action.payload.toolId);
        const tool = data.availableTools.find((t) => t.id === toolId);
        if (!tool) return { success: false, error: 'Unknown tool' };
        if (data.currentTool.id === toolId)
          return { success: false, error: 'Already using this tool' };
        if (data.gold < tool.cost) return { success: false, error: 'Not enough gold' };
        data.gold -= tool.cost;
        data.currentTool = { ...tool };
        data.miningPower = tool.miningPower;
        data.score += 25;
        this.emitEvent('buy_tool', playerId, { tool: tool.name });
        break;
      }

      case 'descend': {
        const nextDepth = data.currentDepth + 1;
        if (nextDepth > data.levels.length) {
          return { success: false, error: 'Already at maximum depth' };
        }
        const nextLevel = data.levels[nextDepth - 1];
        if (data.gold < nextLevel.unlockCost) {
          return { success: false, error: `Need ${nextLevel.unlockCost} gold to descend` };
        }
        data.gold -= nextLevel.unlockCost;
        data.currentDepth = nextDepth;
        data.score += 100;
        this.emitEvent('descend', playerId, { depth: nextDepth, level: nextLevel.name });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MinerState>();
    return data.currentDepth >= LEVELS.length && data.gold >= 1000000;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MinerState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

/**
 * FactoryIdleGame: Build and manage production lines. Place machines
 * that process raw resources into products, connect them together,
 * upgrade throughput, and sell products for profit.
 *
 * Actions: build_machine, connect, upgrade, sell
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Machine {
  id: string;
  type: string;
  name: string;
  level: number;
  inputType: string | null;
  outputType: string;
  productionRate: number; // units per tick
  connectedTo: string | null; // machine id this feeds into
  buffer: number;
  bufferMax: number;
  [key: string]: unknown;
}

interface MachineBlueprint {
  type: string;
  name: string;
  inputType: string | null;
  outputType: string;
  baseRate: number;
  baseCost: number;
  [key: string]: unknown;
}

interface FactoryState {
  money: number;
  totalMoney: number;
  machines: Machine[];
  inventory: Record<string, number>;
  machineCounter: number;
  blueprints: MachineBlueprint[];
  productValues: Record<string, number>;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const BLUEPRINTS: MachineBlueprint[] = [
  {
    type: 'ore_extractor',
    name: 'Ore Extractor',
    inputType: null,
    outputType: 'raw_ore',
    baseRate: 2,
    baseCost: 50,
  },
  {
    type: 'lumber_mill',
    name: 'Lumber Mill',
    inputType: null,
    outputType: 'raw_wood',
    baseRate: 2,
    baseCost: 50,
  },
  {
    type: 'smelter',
    name: 'Smelter',
    inputType: 'raw_ore',
    outputType: 'metal_ingot',
    baseRate: 1,
    baseCost: 150,
  },
  {
    type: 'sawmill',
    name: 'Sawmill',
    inputType: 'raw_wood',
    outputType: 'plank',
    baseRate: 1.5,
    baseCost: 120,
  },
  {
    type: 'assembler',
    name: 'Assembler',
    inputType: 'metal_ingot',
    outputType: 'component',
    baseRate: 0.5,
    baseCost: 400,
  },
  {
    type: 'workshop',
    name: 'Workshop',
    inputType: 'plank',
    outputType: 'furniture',
    baseRate: 0.5,
    baseCost: 350,
  },
  {
    type: 'electronics',
    name: 'Electronics Lab',
    inputType: 'component',
    outputType: 'circuit',
    baseRate: 0.3,
    baseCost: 1000,
  },
  {
    type: 'refinery',
    name: 'Refinery',
    inputType: 'circuit',
    outputType: 'processor',
    baseRate: 0.1,
    baseCost: 5000,
  },
];

const PRODUCT_VALUES: Record<string, number> = {
  raw_ore: 2,
  raw_wood: 2,
  metal_ingot: 10,
  plank: 8,
  component: 30,
  furniture: 25,
  circuit: 100,
  processor: 500,
};

export class FactoryIdleGame extends BaseGame {
  readonly name = 'Factory Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): FactoryState {
    return {
      money: 100,
      totalMoney: 100,
      machines: [],
      inventory: {},
      machineCounter: 0,
      blueprints: BLUEPRINTS.map((b) => ({ ...b })),
      productValues: { ...PRODUCT_VALUES },
      tickCount: 0,
      score: 0,
    };
  }

  private tickProduction(data: FactoryState): void {
    data.tickCount++;

    // Process machines in reverse dependency order (sources first)
    const sources = data.machines.filter((m) => m.inputType === null);
    const processors = data.machines.filter((m) => m.inputType !== null);

    // Source machines produce freely
    for (const machine of sources) {
      const produced = machine.productionRate;
      machine.buffer = Math.min(machine.bufferMax, machine.buffer + produced);
    }

    // Processing machines consume input from inventory or connected machines
    for (const machine of processors) {
      const inputAvailable = data.inventory[machine.inputType!] ?? 0;
      // Also check connected source buffers
      let connectedInput = 0;
      const feeder = data.machines.find((m) => m.connectedTo === machine.id);
      if (feeder && feeder.outputType === machine.inputType) {
        connectedInput = feeder.buffer;
      }

      const totalInput = inputAvailable + connectedInput;
      const canProduce = Math.min(machine.productionRate, totalInput);

      if (canProduce > 0) {
        // Consume from connected feeder first, then inventory
        let toConsume = canProduce;
        if (feeder && connectedInput > 0) {
          const fromFeeder = Math.min(toConsume, connectedInput);
          feeder.buffer -= fromFeeder;
          toConsume -= fromFeeder;
        }
        if (toConsume > 0 && machine.inputType) {
          data.inventory[machine.inputType] = (data.inventory[machine.inputType] ?? 0) - toConsume;
        }
        machine.buffer = Math.min(machine.bufferMax, machine.buffer + canProduce);
      }
    }

    // Flush buffers to inventory for unconnected machines
    for (const machine of data.machines) {
      if (!machine.connectedTo) {
        const output = machine.buffer;
        if (output > 0) {
          data.inventory[machine.outputType] = (data.inventory[machine.outputType] ?? 0) + output;
          machine.buffer = 0;
        }
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FactoryState>();

    this.tickProduction(data);

    switch (action.type) {
      case 'build_machine': {
        const machineType = String(action.payload.machineType);
        const blueprint = data.blueprints.find((b) => b.type === machineType);
        if (!blueprint) return { success: false, error: 'Unknown machine type' };

        const cost = blueprint.baseCost;
        if (data.money < cost) return { success: false, error: 'Not enough money' };

        data.money -= cost;
        data.machineCounter++;
        const machine: Machine = {
          id: `machine_${data.machineCounter}`,
          type: blueprint.type,
          name: blueprint.name,
          level: 1,
          inputType: blueprint.inputType,
          outputType: blueprint.outputType,
          productionRate: blueprint.baseRate,
          connectedTo: null,
          buffer: 0,
          bufferMax: 50,
        };
        data.machines.push(machine);
        data.score += 15;
        this.emitEvent('build_machine', playerId, { machine: machine.name, id: machine.id });
        break;
      }

      case 'connect': {
        const sourceId = String(action.payload.sourceId);
        const targetId = String(action.payload.targetId);
        const source = data.machines.find((m) => m.id === sourceId);
        const target = data.machines.find((m) => m.id === targetId);
        if (!source || !target) return { success: false, error: 'Machine not found' };
        if (target.inputType !== source.outputType) {
          return { success: false, error: 'Incompatible machine types' };
        }
        source.connectedTo = targetId;
        data.score += 5;
        this.emitEvent('connect', playerId, { source: source.name, target: target.name });
        break;
      }

      case 'upgrade': {
        const machineId = String(action.payload.machineId);
        const machine = data.machines.find((m) => m.id === machineId);
        if (!machine) return { success: false, error: 'Machine not found' };
        const blueprint = data.blueprints.find((b) => b.type === machine.type);
        if (!blueprint) return { success: false, error: 'No blueprint found' };

        const upgradeCost = Math.floor(blueprint.baseCost * Math.pow(1.5, machine.level));
        if (data.money < upgradeCost) return { success: false, error: 'Not enough money' };

        data.money -= upgradeCost;
        machine.level++;
        machine.productionRate = blueprint.baseRate * machine.level;
        machine.bufferMax = 50 * machine.level;
        data.score += 20;
        this.emitEvent('upgrade', playerId, { machine: machine.name, level: machine.level });
        break;
      }

      case 'sell': {
        const productType = String(action.payload.productType);
        const quantity = Number(action.payload.quantity ?? 0);
        const available = data.inventory[productType] ?? 0;

        if (available <= 0) return { success: false, error: 'Nothing to sell' };
        const sellAmount = quantity > 0 ? Math.min(quantity, available) : available;
        const value = (data.productValues[productType] ?? 1) * sellAmount;

        data.inventory[productType] = available - sellAmount;
        data.money += value;
        data.totalMoney += value;
        data.score += Math.floor(value / 10);
        this.emitEvent('sell', playerId, { product: productType, quantity: sellAmount, value });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FactoryState>();
    return data.totalMoney >= 1000000;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FactoryState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

/**
 * ReactorGame: Build and manage a nuclear reactor. Place fuel cells
 * and coolant, manage heat levels, generate power, and sell electricity
 * for upgrades. Balance heat output with cooling to avoid meltdowns.
 *
 * Actions: add_cell, add_coolant, upgrade, sell_power
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface FuelCell {
  id: string;
  type: string;
  powerOutput: number;
  heatGeneration: number;
  durability: number;
  maxDurability: number;
  [key: string]: unknown;
}

interface Coolant {
  id: string;
  type: string;
  coolingPower: number;
  [key: string]: unknown;
}

interface ReactorUpgrade {
  id: string;
  name: string;
  level: number;
  baseCost: number;
  effect: string;
  [key: string]: unknown;
}

interface ReactorState {
  power: number;
  totalPower: number;
  money: number;
  totalMoney: number;
  heat: number;
  maxHeat: number;
  fuelCells: FuelCell[];
  coolants: Coolant[];
  upgrades: ReactorUpgrade[];
  powerMultiplier: number;
  coolingMultiplier: number;
  fuelCellCounter: number;
  coolantCounter: number;
  meltdowns: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const FUEL_TYPES: Array<{
  type: string;
  powerOutput: number;
  heatGen: number;
  durability: number;
  cost: number;
}> = [
  { type: 'uranium_basic', powerOutput: 10, heatGen: 5, durability: 100, cost: 50 },
  { type: 'uranium_enriched', powerOutput: 25, heatGen: 15, durability: 80, cost: 200 },
  { type: 'plutonium', powerOutput: 60, heatGen: 40, durability: 60, cost: 800 },
  { type: 'thorium', powerOutput: 40, heatGen: 10, durability: 200, cost: 500 },
  { type: 'fusion_cell', powerOutput: 150, heatGen: 80, durability: 150, cost: 5000 },
];

const COOLANT_TYPES: Array<{ type: string; coolingPower: number; cost: number }> = [
  { type: 'water', coolingPower: 5, cost: 20 },
  { type: 'heavy_water', coolingPower: 15, cost: 100 },
  { type: 'liquid_nitrogen', coolingPower: 40, cost: 400 },
  { type: 'helium_3', coolingPower: 100, cost: 2000 },
];

export class ReactorGame extends BaseGame {
  readonly name = 'Reactor Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): ReactorState {
    const upgrades: ReactorUpgrade[] = [
      { id: 'heat_capacity', name: 'Heat Capacity', level: 0, baseCost: 100, effect: 'max_heat' },
      {
        id: 'power_efficiency',
        name: 'Power Efficiency',
        level: 0,
        baseCost: 200,
        effect: 'power_mult',
      },
      {
        id: 'cooling_efficiency',
        name: 'Cooling Efficiency',
        level: 0,
        baseCost: 150,
        effect: 'cool_mult',
      },
      {
        id: 'fuel_durability',
        name: 'Fuel Durability',
        level: 0,
        baseCost: 300,
        effect: 'durability',
      },
      { id: 'auto_sell', name: 'Auto Sell Rate', level: 0, baseCost: 500, effect: 'auto_sell' },
    ];

    return {
      power: 0,
      totalPower: 0,
      money: 100,
      totalMoney: 100,
      heat: 0,
      maxHeat: 100,
      fuelCells: [],
      coolants: [],
      upgrades,
      powerMultiplier: 1,
      coolingMultiplier: 1,
      fuelCellCounter: 0,
      coolantCounter: 0,
      meltdowns: 0,
      tickCount: 0,
      score: 0,
    };
  }

  private tickReactor(data: ReactorState): void {
    data.tickCount++;

    // Generate power and heat from fuel cells
    let totalPowerGen = 0;
    let totalHeatGen = 0;

    for (let i = data.fuelCells.length - 1; i >= 0; i--) {
      const cell = data.fuelCells[i];
      cell.durability--;
      if (cell.durability <= 0) {
        data.fuelCells.splice(i, 1);
        continue;
      }
      totalPowerGen += cell.powerOutput;
      totalHeatGen += cell.heatGeneration;
    }

    // Apply cooling
    let totalCooling = 0;
    for (const coolant of data.coolants) {
      totalCooling += coolant.coolingPower;
    }
    totalCooling *= data.coolingMultiplier;

    // Update heat
    data.heat = Math.max(0, data.heat + totalHeatGen - totalCooling);

    // Check for meltdown
    if (data.heat >= data.maxHeat) {
      data.meltdowns++;
      // Meltdown destroys half the fuel cells
      const toRemove = Math.ceil(data.fuelCells.length / 2);
      data.fuelCells.splice(0, toRemove);
      data.heat = data.maxHeat * 0.5;
    }

    // Generate power (reduced if overheating)
    const heatPenalty = data.heat > data.maxHeat * 0.8 ? 0.5 : 1;
    const powerGenerated = totalPowerGen * data.powerMultiplier * heatPenalty;
    data.power += powerGenerated;
    data.totalPower += powerGenerated;

    // Auto sell (if upgrade purchased)
    const autoSellUpgrade = data.upgrades.find((u) => u.id === 'auto_sell');
    if (autoSellUpgrade && autoSellUpgrade.level > 0) {
      const autoSellRate = autoSellUpgrade.level * 0.1;
      const autoSold = data.power * autoSellRate;
      if (autoSold > 0) {
        data.power -= autoSold;
        const value = autoSold * 0.5; // auto sell at half price
        data.money += value;
        data.totalMoney += value;
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ReactorState>();

    this.tickReactor(data);

    switch (action.type) {
      case 'add_cell': {
        const fuelType = String(action.payload.fuelType ?? 'uranium_basic');
        const fuelDef = FUEL_TYPES.find((f) => f.type === fuelType);
        if (!fuelDef) return { success: false, error: 'Unknown fuel type' };
        if (data.money < fuelDef.cost) return { success: false, error: 'Not enough money' };

        // Check durability upgrade bonus
        const durUpgrade = data.upgrades.find((u) => u.id === 'fuel_durability');
        const durBonus = durUpgrade ? durUpgrade.level * 0.2 : 0;

        data.money -= fuelDef.cost;
        data.fuelCellCounter++;
        const cell: FuelCell = {
          id: `fuel_${data.fuelCellCounter}`,
          type: fuelType,
          powerOutput: fuelDef.powerOutput,
          heatGeneration: fuelDef.heatGen,
          durability: Math.floor(fuelDef.durability * (1 + durBonus)),
          maxDurability: Math.floor(fuelDef.durability * (1 + durBonus)),
        };
        data.fuelCells.push(cell);
        data.score += 5;
        this.emitEvent('add_cell', playerId, { type: fuelType });
        break;
      }

      case 'add_coolant': {
        const coolantType = String(action.payload.coolantType ?? 'water');
        const coolantDef = COOLANT_TYPES.find((c) => c.type === coolantType);
        if (!coolantDef) return { success: false, error: 'Unknown coolant type' };
        if (data.money < coolantDef.cost) return { success: false, error: 'Not enough money' };

        data.money -= coolantDef.cost;
        data.coolantCounter++;
        const coolant: Coolant = {
          id: `coolant_${data.coolantCounter}`,
          type: coolantType,
          coolingPower: coolantDef.coolingPower,
        };
        data.coolants.push(coolant);
        data.score += 5;
        this.emitEvent('add_coolant', playerId, { type: coolantType });
        break;
      }

      case 'upgrade': {
        const upgradeId = String(action.payload.upgradeId);
        const upgrade = data.upgrades.find((u) => u.id === upgradeId);
        if (!upgrade) return { success: false, error: 'Unknown upgrade' };
        const cost = Math.floor(upgrade.baseCost * Math.pow(1.8, upgrade.level));
        if (data.money < cost) return { success: false, error: 'Not enough money' };

        data.money -= cost;
        upgrade.level++;

        // Apply upgrade effect
        switch (upgrade.effect) {
          case 'max_heat':
            data.maxHeat = 100 + upgrade.level * 50;
            break;
          case 'power_mult':
            data.powerMultiplier = 1 + upgrade.level * 0.25;
            break;
          case 'cool_mult':
            data.coolingMultiplier = 1 + upgrade.level * 0.2;
            break;
          case 'durability':
            // Applied when adding new cells
            break;
          case 'auto_sell':
            // Applied in tick
            break;
        }

        data.score += 20;
        this.emitEvent('upgrade', playerId, { upgrade: upgrade.name, level: upgrade.level });
        break;
      }

      case 'sell_power': {
        const amount = Number(action.payload.amount ?? data.power);
        const toSell = Math.min(amount, data.power);
        if (toSell <= 0) return { success: false, error: 'No power to sell' };

        const value = toSell * 1; // 1 money per power unit
        data.power -= toSell;
        data.money += value;
        data.totalMoney += value;
        data.score += Math.floor(value / 10);
        this.emitEvent('sell_power', playerId, { amount: toSell, value });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<ReactorState>();
    return data.totalPower >= 1e7;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ReactorState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

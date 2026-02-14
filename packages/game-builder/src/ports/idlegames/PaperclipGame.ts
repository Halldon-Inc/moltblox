/**
 * PaperclipGame: Universal Paperclips inspired. Start by making
 * paperclips manually, then automate with auto-clippers. Buy wire,
 * optimize pricing for demand, and unlock research projects
 * including quantum computing.
 *
 * Actions: make, buy_auto, buy_wire, adjust_price, research
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface ResearchProject {
  id: string;
  name: string;
  description: string;
  cost: number;
  costType: 'money' | 'creativity';
  purchased: boolean;
  effect: string;
  [key: string]: unknown;
}

interface PaperclipState {
  paperclips: number;
  totalPaperclips: number;
  money: number;
  wire: number;
  wirePrice: number;
  clipPrice: number;
  demand: number;
  autoClippers: number;
  autoClipperCost: number;
  megaClippers: number;
  megaClipperCost: number;
  creativity: number;
  creativityRate: number;
  research: ResearchProject[];
  productionMultiplier: number;
  marketingLevel: number;
  wireBuyerEnabled: boolean;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const RESEARCH_PROJECTS: Array<{
  id: string;
  name: string;
  description: string;
  cost: number;
  costType: 'money' | 'creativity';
  effect: string;
}> = [
  {
    id: 'improved_cutters',
    name: 'Improved Cutters',
    description: 'Double manual clip speed',
    cost: 500,
    costType: 'money',
    effect: 'double_manual',
  },
  {
    id: 'autoclipper_boost',
    name: 'Autoclipper Boost',
    description: 'Autoclippers 50% faster',
    cost: 1000,
    costType: 'money',
    effect: 'auto_boost',
  },
  {
    id: 'marketing_1',
    name: 'New Slogan',
    description: 'Increase demand by 25%',
    cost: 2500,
    costType: 'money',
    effect: 'marketing',
  },
  {
    id: 'wire_recycler',
    name: 'Wire Recycler',
    description: '10% chance to not consume wire',
    cost: 5000,
    costType: 'money',
    effect: 'wire_save',
  },
  {
    id: 'mega_clippers',
    name: 'MegaClippers',
    description: 'Unlock MegaClippers (500x power)',
    cost: 50,
    costType: 'creativity',
    effect: 'mega_unlock',
  },
  {
    id: 'quantum_computing',
    name: 'Quantum Computing',
    description: 'Creativity generation x5',
    cost: 100,
    costType: 'creativity',
    effect: 'quantum',
  },
  {
    id: 'hypno_drones',
    name: 'HypnoDrones',
    description: 'Demand always at maximum',
    cost: 200,
    costType: 'creativity',
    effect: 'max_demand',
  },
  {
    id: 'wire_buyer',
    name: 'Auto Wire Buyer',
    description: 'Automatically purchase wire',
    cost: 150,
    costType: 'creativity',
    effect: 'auto_wire',
  },
];

export class PaperclipGame extends BaseGame {
  readonly name = 'Universal Paperclips';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): PaperclipState {
    const research: ResearchProject[] = RESEARCH_PROJECTS.map((r) => ({
      ...r,
      purchased: false,
    }));

    return {
      paperclips: 0,
      totalPaperclips: 0,
      money: 0,
      wire: 1000,
      wirePrice: 15,
      clipPrice: 0.25,
      demand: 1,
      autoClippers: 0,
      autoClipperCost: 5,
      megaClippers: 0,
      megaClipperCost: 50000,
      creativity: 0,
      creativityRate: 0,
      research,
      productionMultiplier: 1,
      marketingLevel: 0,
      wireBuyerEnabled: false,
      tickCount: 0,
      score: 0,
    };
  }

  private calculateDemand(data: PaperclipState): number {
    const hypno = data.research.find((r) => r.id === 'hypno_drones');
    if (hypno?.purchased) return 10;
    // Demand inversely proportional to price, boosted by marketing
    const baseDemand = Math.max(0.1, (1.1 - data.clipPrice) * 10);
    const marketingBoost = 1 + data.marketingLevel * 0.25;
    return baseDemand * marketingBoost;
  }

  private tickProduction(data: PaperclipState): void {
    data.tickCount++;

    // Auto wire buyer
    if (data.wireBuyerEnabled && data.wire < 500 && data.money >= data.wirePrice) {
      const spools = Math.min(5, Math.floor(data.money / data.wirePrice));
      data.wire += spools * 1000;
      data.money -= spools * data.wirePrice;
    }

    // Auto clippers produce paperclips
    const autoBoost = data.research.find((r) => r.id === 'autoclipper_boost');
    const autoRate = data.autoClippers * (autoBoost?.purchased ? 1.5 : 1);

    // Mega clippers
    const megaRate = data.megaClippers * 500;

    const totalAutoProduction = (autoRate + megaRate) * data.productionMultiplier;
    const wireNeeded = totalAutoProduction;
    const wireSave = data.research.find((r) => r.id === 'wire_recycler');
    const saveChance = wireSave?.purchased ? 0.1 : 0;
    const actualWireUsed = wireNeeded * (1 - saveChance);

    if (data.wire >= actualWireUsed && totalAutoProduction > 0) {
      data.wire -= actualWireUsed;
      data.paperclips += totalAutoProduction;
      data.totalPaperclips += totalAutoProduction;
    }

    // Sell paperclips based on demand
    data.demand = this.calculateDemand(data);
    const sold = Math.min(data.paperclips, Math.floor(data.demand * 10));
    if (sold > 0) {
      data.paperclips -= sold;
      data.money += sold * data.clipPrice;
    }

    // Creativity generation (unlocked after certain total paperclips)
    if (data.totalPaperclips >= 10000) {
      const quantumBoost = data.research.find((r) => r.id === 'quantum_computing');
      data.creativityRate = quantumBoost?.purchased ? 5 : 1;
      data.creativity += data.creativityRate;
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PaperclipState>();

    this.tickProduction(data);

    switch (action.type) {
      case 'make': {
        if (data.wire < 1) return { success: false, error: 'No wire available' };
        const manualBoost = data.research.find((r) => r.id === 'improved_cutters');
        const amount = (manualBoost?.purchased ? 2 : 1) * data.productionMultiplier;
        data.wire -= 1;
        data.paperclips += amount;
        data.totalPaperclips += amount;
        data.score += 1;
        this.emitEvent('make', playerId, { amount });
        break;
      }

      case 'buy_auto': {
        const type = String(action.payload.type ?? 'auto');
        if (type === 'mega') {
          const megaUnlocked = data.research.find((r) => r.id === 'mega_clippers');
          if (!megaUnlocked?.purchased)
            return { success: false, error: 'MegaClippers not researched' };
          if (data.money < data.megaClipperCost)
            return { success: false, error: 'Not enough money' };
          data.money -= data.megaClipperCost;
          data.megaClippers++;
          data.megaClipperCost = Math.floor(data.megaClipperCost * 1.07);
          data.score += 100;
          this.emitEvent('buy_mega', playerId, { megaClippers: data.megaClippers });
        } else {
          if (data.money < data.autoClipperCost)
            return { success: false, error: 'Not enough money' };
          data.money -= data.autoClipperCost;
          data.autoClippers++;
          data.autoClipperCost = Math.floor(data.autoClipperCost * 1.1);
          data.score += 10;
          this.emitEvent('buy_auto', playerId, { autoClippers: data.autoClippers });
        }
        break;
      }

      case 'buy_wire': {
        const spools = Math.max(1, Number(action.payload.spools ?? 1));
        const cost = spools * data.wirePrice;
        if (data.money < cost) return { success: false, error: 'Not enough money' };
        data.money -= cost;
        data.wire += spools * 1000;
        this.emitEvent('buy_wire', playerId, { spools, wire: data.wire });
        break;
      }

      case 'adjust_price': {
        const newPrice = Number(action.payload.price);
        if (isNaN(newPrice) || newPrice < 0.01 || newPrice > 10) {
          return { success: false, error: 'Price must be between 0.01 and 10.00' };
        }
        data.clipPrice = Math.round(newPrice * 100) / 100;
        this.emitEvent('adjust_price', playerId, { price: data.clipPrice });
        break;
      }

      case 'research': {
        const projectId = String(action.payload.projectId);
        const project = data.research.find((r) => r.id === projectId);
        if (!project) return { success: false, error: 'Unknown research project' };
        if (project.purchased) return { success: false, error: 'Already researched' };

        if (project.costType === 'money') {
          if (data.money < project.cost) return { success: false, error: 'Not enough money' };
          data.money -= project.cost;
        } else {
          if (data.creativity < project.cost)
            return { success: false, error: 'Not enough creativity' };
          data.creativity -= project.cost;
        }

        project.purchased = true;

        // Apply immediate effects
        switch (project.effect) {
          case 'marketing':
            data.marketingLevel++;
            break;
          case 'auto_wire':
            data.wireBuyerEnabled = true;
            break;
        }

        data.score += 100;
        this.emitEvent('research', playerId, { project: project.name });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PaperclipState>();
    return data.totalPaperclips >= 1e10;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PaperclipState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}

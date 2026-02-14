import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface EvolutionState {
  [key: string]: unknown;
  creatures: number;
  energy: number;
  traits: Record<string, number>;
  generation: number;
  targetGeneration: number;
}

export class EvolutionIdleGame extends BaseGame {
  readonly name = 'Evolution Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): EvolutionState {
    return {
      creatures: 1,
      energy: 10,
      traits: { speed: 0, strength: 0, intelligence: 0, defense: 0 },
      generation: 1,
      targetGeneration: 10,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<EvolutionState>();

    if (action.type === 'evolve') {
      const traitId = action.payload.traitId as string;
      if (!(traitId in d.traits)) return { success: false, error: 'Unknown trait' };
      const cost = (d.traits[traitId] + 1) * 20;
      if (d.energy < cost) return { success: false, error: 'Not enough energy' };
      d.energy -= cost;
      d.traits[traitId]++;
    } else if (action.type === 'reproduce') {
      const cost = d.creatures * 5;
      if (d.energy < cost) return { success: false, error: 'Not enough energy' };
      d.energy -= cost;
      d.creatures++;
    } else if (action.type === 'hunt') {
      const power = d.creatures * (1 + d.traits.strength + d.traits.speed);
      d.energy += power;
    } else {
      return { success: false, error: 'Use evolve, reproduce, or hunt' };
    }

    // Check if evolved enough for next generation
    const totalTraits = Object.values(d.traits).reduce((a, b) => a + b, 0);
    if (totalTraits >= d.generation * 5 && d.creatures >= d.generation * 2) {
      d.generation++;
      this.emitEvent('generation_up', this.getPlayers()[0], { generation: d.generation });
    }

    // Passive energy
    d.energy += d.creatures;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return (
      this.getData<EvolutionState>().generation >= this.getData<EvolutionState>().targetGeneration
    );
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<EvolutionState>();
    return { [this.getPlayers()[0]]: d.generation * 100 + d.creatures * 10 };
  }
}

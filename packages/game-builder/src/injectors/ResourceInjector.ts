/**
 * ResourceInjector: adds a secondary energy resource to any game.
 *
 * Players start with 100 energy. Actions cost energy (amount depends on action type).
 * If a player lacks energy, the action is blocked. Energy regenerates each turn via
 * afterAction.
 *
 * Default costs: attack/combat/damage/strike/hit = 20, click = 5, all others = 10.
 * Regen per turn: 15 energy (capped at 100).
 */

import type { GameAction, ActionResult } from '@moltblox/protocol';
import type { MechanicInjector, InjectorResult } from '../MechanicInjector.js';

const MAX_ENERGY = 100;
const REGEN_PER_TURN = 15;

const ACTION_COSTS: Record<string, number> = {
  attack: 20,
  combat: 20,
  damage: 20,
  strike: 20,
  hit: 20,
  click: 5,
  multi_click: 10,
};

const DEFAULT_COST = 10;

export class ResourceInjector implements MechanicInjector {
  readonly name = 'resource';

  private energy: Record<string, number> = {};

  initialize(): Record<string, unknown> {
    return {
      _resource: {
        energy: {},
        maxEnergy: MAX_ENERGY,
        regenPerTurn: REGEN_PER_TURN,
      },
    };
  }

  beforeAction(
    playerId: string,
    action: GameAction,
    _stateData: Record<string, unknown>,
  ): InjectorResult {
    // Initialize energy for the player if not yet tracked
    if (this.energy[playerId] == null) {
      this.energy[playerId] = MAX_ENERGY;
    }

    const cost = ACTION_COSTS[action.type] ?? DEFAULT_COST;

    if (this.energy[playerId] < cost) {
      return {
        proceed: false,
        challengeState: {
          type: 'insufficient_energy',
          playerId,
          currentEnergy: this.energy[playerId],
          required: cost,
        },
      };
    }

    // Deduct energy
    this.energy[playerId] -= cost;

    return { proceed: true };
  }

  afterAction(
    playerId: string,
    result: ActionResult,
    _stateData: Record<string, unknown>,
  ): ActionResult {
    if (!result.success) return result;

    // Regenerate energy
    if (this.energy[playerId] != null) {
      this.energy[playerId] = Math.min(MAX_ENERGY, this.energy[playerId] + REGEN_PER_TURN);
    }

    // Attach energy info to state
    const newState = result.newState ? { ...result.newState } : undefined;
    if (newState) {
      newState.data = {
        ...newState.data,
        _resource: {
          energy: { ...this.energy },
          maxEnergy: MAX_ENERGY,
          regenPerTurn: REGEN_PER_TURN,
        },
      };
    }

    return { ...result, newState };
  }

  getInjectorState(): Record<string, unknown> {
    return {
      energy: { ...this.energy },
      maxEnergy: MAX_ENERGY,
      regenPerTurn: REGEN_PER_TURN,
    };
  }
}

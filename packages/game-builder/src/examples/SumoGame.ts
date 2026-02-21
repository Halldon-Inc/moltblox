/**
 * SumoGame: Sumo wrestling with ring-out mechanics
 *
 * Two wrestlers on a linear ring. Push your opponent past the edge
 * to win. Grips enhance push/pull distance. Throws can send opponents
 * flying. The initial tachiai charge is a powerful opening move.
 *
 * Actions: push, pull, grip, throw, sidestep, slap, charge
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SumoConfig {
  ringSize?: number;
  weightClass?: 'light' | 'medium' | 'heavy';
  tachiaiBonusWindow?: number;
  balanceSensitivity?: number;
  theme?: {
    dohyoColors?: Record<string, string>;
    mawashiColors?: Record<string, string>;
    arenaBackground?: string;
  };
  gameplay?: {
    pushForce?: number;
    pushStaminaCost?: number;
    pullStaminaCost?: number;
    gripStaminaCost?: number;
    throwStaminaCost?: number;
    slapStaminaCost?: number;
    chargeStaminaCost?: number;
    balanceThreshold?: number;
    pushBalanceDamage?: number;
    slapBalanceDamage?: number;
    chargeBalanceDamage?: number;
    throwBalanceDamage?: number;
    staminaRegenRate?: number;
    balanceRegenRate?: number;
    maxBalance?: number;
    weightClasses?: Record<string, { str: number; balance: number; speed: number }>;
  };
  content?: {
    techniqueList?: string[];
  };
}

interface WeightProfile {
  str: number;
  balance: number;
  speed: number;
}

const DEFAULT_WEIGHT_PROFILES: Record<string, WeightProfile> = {
  light: { str: 6, balance: 10, speed: 10 },
  medium: { str: 8, balance: 8, speed: 8 },
  heavy: { str: 12, balance: 6, speed: 5 },
};

const DEFAULT_PUSH_STAMINA_COST = 5;
const DEFAULT_PUSH_BALANCE_DAMAGE = 6;
const DEFAULT_SLAP_STAMINA_COST = 3;
const DEFAULT_SLAP_BALANCE_DAMAGE = 6;
const DEFAULT_CHARGE_STAMINA_COST = 5;
const DEFAULT_CHARGE_BALANCE_DAMAGE = 12;
const DEFAULT_THROW_BALANCE_DAMAGE = 18;
const DEFAULT_STAMINA_REGEN = 12;
const DEFAULT_BALANCE_REGEN = 8;
const DEFAULT_MAX_BALANCE = 150;
const DEFAULT_BALANCE_THRESHOLD = 30;

interface Wrestler {
  id: string;
  position: number;
  balance: number;
  stamina: number;
  maxStamina: number;
  grip: string | null; // null, 'mawashi', 'arm'
  tachiai: boolean;
  stats: WeightProfile;
  lastAction: string | null;
  pendingCharge: boolean; // true if this wrestler just charged (for sidestep resolution)
  [key: string]: unknown;
}

interface SumoState {
  wrestlers: Record<string, Wrestler>;
  ringSize: number;
  tachiaiBonusWindow: number;
  balanceSensitivity: number;
  turnCount: number;
  matchOver: boolean;
  winnerId: string | null;
  totalScore: Record<string, number>;
  [key: string]: unknown;
}

export class SumoGame extends BaseGame {
  readonly name = 'Sumo';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): SumoState {
    const cfg = this.config as SumoConfig;
    const ringSize = cfg.ringSize ?? 10;
    const weightClass = cfg.weightClass ?? 'medium';
    const tachiaiBonusWindow = cfg.tachiaiBonusWindow ?? 1;
    const balanceSensitivity = cfg.balanceSensitivity ?? 5;

    const weightProfiles = cfg.gameplay?.weightClasses ?? DEFAULT_WEIGHT_PROFILES;
    const stats = weightProfiles[weightClass] ?? DEFAULT_WEIGHT_PROFILES.medium;

    const ids = playerIds.length === 1 ? [...playerIds, 'cpu'] : playerIds;
    const wrestlers: Record<string, Wrestler> = {};
    const totalScore: Record<string, number> = {};

    // Place wrestlers on opposite sides of center
    const startOffset = Math.max(1, Math.floor(ringSize / 3));

    for (let i = 0; i < ids.length; i++) {
      const pid = ids[i];
      const maxBalance = (cfg.gameplay?.maxBalance as number) ?? DEFAULT_MAX_BALANCE;
      wrestlers[pid] = {
        id: pid,
        position: i === 0 ? -startOffset : startOffset,
        balance: maxBalance,
        stamina: 120,
        maxStamina: 120,
        grip: null,
        tachiai: true,
        stats: { ...stats },
        lastAction: null,
        pendingCharge: false,
      };
      totalScore[pid] = 0;
    }

    return {
      wrestlers,
      ringSize,
      tachiaiBonusWindow,
      balanceSensitivity,
      turnCount: 0,
      matchOver: false,
      winnerId: null,
      totalScore,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SumoState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }

    const wrestler = data.wrestlers[playerId];
    if (!wrestler) {
      return { success: false, error: 'Wrestler not in match' };
    }

    // Stamina check (except slap and push which are always available at 0)
    const noStaminaActions = ['slap', 'push'];
    if (wrestler.stamina <= 0 && !noStaminaActions.includes(action.type)) {
      return {
        success: false,
        error: 'Not enough stamina, can only slap or push',
      };
    }

    let result: ActionResult;

    switch (action.type) {
      case 'push':
        result = this.handlePush(playerId, data);
        break;
      case 'pull':
        result = this.handlePull(playerId, data);
        break;
      case 'grip':
        result = this.handleGrip(playerId, action, data);
        break;
      case 'throw':
        result = this.handleThrow(playerId, data);
        break;
      case 'sidestep':
        result = this.handleSidestep(playerId, data);
        break;
      case 'slap':
        result = this.handleSlap(playerId, data);
        break;
      case 'charge':
        result = this.handleCharge(playerId, data);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action.type}` };
    }

    return result;
  }

  private getOpponent(playerId: string, data: SumoState): Wrestler | null {
    const opp = Object.values(data.wrestlers).find((w) => w.id !== playerId);
    return opp ?? null;
  }

  private getDirection(from: Wrestler, to: Wrestler): number {
    // Returns +1 if opponent is to the right, -1 if to the left
    return to.position > from.position ? 1 : -1;
  }

  private consumeStamina(wrestler: Wrestler, amount: number): void {
    wrestler.stamina = Math.max(0, wrestler.stamina - amount);
  }

  private regenStamina(wrestler: Wrestler): void {
    const cfg = this.config as SumoConfig;
    const regen = (cfg.gameplay?.staminaRegenRate as number) ?? DEFAULT_STAMINA_REGEN;
    wrestler.stamina = Math.min(wrestler.maxStamina, wrestler.stamina + regen);
  }

  private regenBalance(wrestler: Wrestler): void {
    const cfg = this.config as SumoConfig;
    const regen = (cfg.gameplay?.balanceRegenRate as number) ?? DEFAULT_BALANCE_REGEN;
    const maxBal = (cfg.gameplay?.maxBalance as number) ?? DEFAULT_MAX_BALANCE;
    wrestler.balance = Math.min(maxBal, wrestler.balance + regen);
  }

  private checkRingOut(data: SumoState): void {
    for (const w of Object.values(data.wrestlers)) {
      if (Math.abs(w.position) >= data.ringSize) {
        data.matchOver = true;
        const winner = Object.values(data.wrestlers).find((wr) => wr.id !== w.id);
        if (winner) {
          data.winnerId = winner.id;
          // Fewer turns = higher score
          data.totalScore[winner.id] =
            (data.totalScore[winner.id] ?? 0) + Math.max(100, 500 - data.turnCount * 10);
          this.emitEvent('ring_out', w.id, { position: w.position });
          this.emitEvent('match_won', winner.id, { turns: data.turnCount });
        }
        return;
      }
    }
  }

  private isVulnerable(wrestler: Wrestler): boolean {
    const cfg = this.config as SumoConfig;
    const threshold = (cfg.gameplay?.balanceThreshold as number) ?? DEFAULT_BALANCE_THRESHOLD;
    return wrestler.balance < threshold;
  }

  private finalizeTurn(data: SumoState): void {
    data.turnCount++;
    // End-of-turn regen
    for (const w of Object.values(data.wrestlers)) {
      this.regenStamina(w);
      this.regenBalance(w);
      // After first action, tachiai is consumed
      if (!w.tachiai) {
        // already consumed
      }
    }
    this.checkRingOut(data);
    this.setData(data);
  }

  private handlePush(playerId: string, data: SumoState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const dir = this.getDirection(wrestler, opponent);
    let pushDist = 1;

    // Grip bonus
    if (wrestler.grip) {
      pushDist = 2;
    }

    // Vulnerable bonus (reduced multiplier)
    if (this.isVulnerable(opponent)) {
      pushDist += 1;
    }

    const cfg = this.config as SumoConfig;
    opponent.position += dir * pushDist;
    opponent.balance = Math.max(
      0,
      opponent.balance -
        ((cfg.gameplay?.pushBalanceDamage as number) ?? DEFAULT_PUSH_BALANCE_DAMAGE),
    );
    wrestler.lastAction = 'push';
    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.pushStaminaCost as number) ?? DEFAULT_PUSH_STAMINA_COST,
    );

    this.emitEvent('push', playerId, { distance: pushDist, targetPos: opponent.position });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handlePull(playerId: string, data: SumoState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const dir = this.getDirection(wrestler, opponent);
    let pullDist = 1;

    if (wrestler.grip) {
      pullDist = 2;
    }

    const cfg = this.config as SumoConfig;
    opponent.position -= dir * pullDist;
    wrestler.lastAction = 'pull';
    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.pullStaminaCost as number) ?? DEFAULT_PUSH_STAMINA_COST,
    );

    this.emitEvent('pull', playerId, { distance: pullDist, targetPos: opponent.position });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleGrip(playerId: string, action: GameAction, data: SumoState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const gripType = (action.payload?.type as string) ?? 'arm';

    if (gripType !== 'mawashi' && gripType !== 'arm') {
      return { success: false, error: 'Invalid grip type' };
    }

    const cfg = this.config as SumoConfig;
    wrestler.grip = gripType;
    wrestler.lastAction = 'grip';
    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.gripStaminaCost as number) ?? DEFAULT_PUSH_STAMINA_COST,
    );

    this.emitEvent('grip', playerId, { type: gripType });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleThrow(playerId: string, data: SumoState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    if (!wrestler.grip) {
      return { success: false, error: 'Need a grip to throw' };
    }

    const cfg = this.config as SumoConfig;
    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.throwStaminaCost as number) ?? DEFAULT_PUSH_STAMINA_COST,
    );
    const chance = Math.min(
      95,
      Math.max(10, 70 + (wrestler.stats.str - opponent.balance * 0.1) * 2),
    );
    const success = Math.random() * 100 < chance;

    if (success) {
      const dir = this.getDirection(wrestler, opponent);
      let throwDist = 2;
      if (this.isVulnerable(opponent)) {
        throwDist += 1;
      }
      opponent.position += dir * throwDist;
      opponent.balance = Math.max(
        0,
        opponent.balance -
          ((cfg.gameplay?.throwBalanceDamage as number) ?? DEFAULT_THROW_BALANCE_DAMAGE),
      );
      this.emitEvent('throw_success', playerId, {
        distance: throwDist,
        targetPos: opponent.position,
      });
    } else {
      this.emitEvent('throw_fail', playerId, {});
    }

    wrestler.lastAction = 'throw';
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleSidestep(playerId: string, data: SumoState): ActionResult {
    const cfg = this.config as SumoConfig;
    const wrestler = data.wrestlers[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.pushStaminaCost as number) ?? DEFAULT_PUSH_STAMINA_COST,
    );

    // Dodge chance: 80% + speed*2%
    const dodgeChance = Math.min(95, 80 + wrestler.stats.speed * 2);
    const dodged = Math.random() * 100 < dodgeChance;

    if (dodged && opponent.pendingCharge) {
      // Opponent's charge goes through, they move +2 toward the edge they were charging
      const chargeDir = this.getDirection(opponent, wrestler);
      opponent.position += chargeDir * 2;
      this.emitEvent('sidestep_success', playerId, { opponentPos: opponent.position });
    } else {
      this.emitEvent('sidestep', playerId, { dodged });
    }

    // Reset pending charge
    opponent.pendingCharge = false;
    wrestler.lastAction = 'sidestep';
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleSlap(playerId: string, data: SumoState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const cfg = this.config as SumoConfig;
    opponent.grip = null;
    opponent.balance = Math.max(
      0,
      opponent.balance -
        ((cfg.gameplay?.slapBalanceDamage as number) ?? DEFAULT_SLAP_BALANCE_DAMAGE),
    );

    wrestler.lastAction = 'slap';
    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.slapStaminaCost as number) ?? DEFAULT_SLAP_STAMINA_COST,
    );

    this.emitEvent('slap', playerId, { balance: opponent.balance });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleCharge(playerId: string, data: SumoState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    if (!wrestler.tachiai) {
      return { success: false, error: 'Charge only available on first turn (tachiai)' };
    }

    const cfg = this.config as SumoConfig;
    wrestler.tachiai = false;
    this.consumeStamina(
      wrestler,
      (cfg.gameplay?.chargeStaminaCost as number) ?? DEFAULT_CHARGE_STAMINA_COST,
    );

    const dir = this.getDirection(wrestler, opponent);
    let pushDist = 2;

    // Bonus window check
    if (data.turnCount <= data.tachiaiBonusWindow) {
      pushDist += 1;
    }

    if (this.isVulnerable(opponent)) {
      pushDist += 1;
    }

    opponent.position += dir * pushDist;
    opponent.balance = Math.max(
      0,
      opponent.balance -
        ((cfg.gameplay?.chargeBalanceDamage as number) ?? DEFAULT_CHARGE_BALANCE_DAMAGE),
    );
    wrestler.pendingCharge = true;
    wrestler.lastAction = 'charge';

    this.emitEvent('charge', playerId, { distance: pushDist, targetPos: opponent.position });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<SumoState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<SumoState>();
    return data.winnerId;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SumoState>();
    return { ...data.totalScore };
  }
}

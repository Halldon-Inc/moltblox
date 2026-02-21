/**
 * WrestlerGame - Pro wrestling with grapple system
 *
 * Features a momentum system, crowd meter, pin attempts with
 * referee counting, rope breaks, finishers, and multiple match types
 * (singles, tag, royal rumble, cage).
 *
 * Actions: strike, grapple, irish_whip, pin, rope_break,
 *          tag_partner, climb_turnbuckle, finisher, kick_out
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface WrestlerConfig {
  matchType?: 'singles' | 'tag' | 'royal-rumble' | 'cage';
  pinCount?: number;
  finisherThreshold?: number;
  ropeBreaks?: number;
  theme?: {
    ringBackground?: string;
    wrestlerColors?: Record<string, string>;
    crowdEffectColor?: string;
  };
  gameplay?: {
    wrestlerHp?: number;
    wrestlerStamina?: number;
    grapplingDamage?: number;
    aerialDamage?: number;
    finisherDamage?: number;
    pinThreshold?: number;
    staminaDrain?: Record<string, number>;
    momentumGains?: Record<string, number>;
    strikeDamage?: Record<string, number>;
    staminaRegen?: number;
    tagPartnerHealRate?: number;
  };
  content?: {
    moveSet?: string[];
    specialMoves?: Record<string, { damage: number; staminaCost: number }>;
  };
}

interface Wrestler {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  momentum: number;
  position: string;
  ropeBreaksLeft: number;
  eliminated: boolean;
  tagPartner?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

interface Referee {
  position: string;
  counting: boolean;
  count: number;
  targetId: string | null;
  [key: string]: unknown;
}

interface WrestlerState {
  wrestlers: Record<string, Wrestler>;
  crowdMeter: number;
  referee: Referee;
  matchType: string;
  turnOrder: string[];
  currentTurnIndex: number;
  matchOver: boolean;
  pinAttemptActive: boolean;
  pinAttacker: string | null;
  pinDefender: string | null;
  finisherThreshold: number;
  [key: string]: unknown;
}

const DEFAULT_STRIKE_DAMAGE: Record<string, number> = {
  punch: 5,
  kick: 7,
  chop: 6,
};

const DEFAULT_STAMINA_COSTS: Record<string, number> = {
  strike: 5,
  grapple: 15,
  irish_whip: 10,
  finisher: 25,
  climb_turnbuckle: 10,
  pin: 5,
  tag_partner: 0,
  rope_break: 0,
  kick_out: 10,
};

const DEFAULT_MOMENTUM_GAINS: Record<string, number> = {
  strike: 5,
  grapple: 10,
  climb_turnbuckle: 15,
  finisher: 20,
};

const DEFAULT_WRESTLER_HP = 100;
const DEFAULT_WRESTLER_STAMINA = 100;
const DEFAULT_GRAPPLING_DAMAGE = 12;
const DEFAULT_AERIAL_DAMAGE = 15;
const DEFAULT_FINISHER_DAMAGE = 30;
const DEFAULT_STAMINA_REGEN = 5;
const DEFAULT_TAG_HEAL_RATE = 3;

export class WrestlerGame extends BaseGame {
  readonly name = 'Wrestler';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): WrestlerState {
    const cfg = this.config as WrestlerConfig;
    const matchType = cfg.matchType ?? 'singles';
    const finisherThreshold = cfg.finisherThreshold ?? 80;
    const ropeBreaks = cfg.ropeBreaks ?? 3;

    // Auto-CPU for solo play
    const allIds = [...playerIds];
    if (playerIds.length === 1) {
      allIds.push('cpu');
    }

    const wrestlerHp = (cfg.gameplay?.wrestlerHp as number) ?? DEFAULT_WRESTLER_HP;
    const wrestlerStamina = (cfg.gameplay?.wrestlerStamina as number) ?? DEFAULT_WRESTLER_STAMINA;

    const wrestlers: Record<string, Wrestler> = {};
    for (const pid of allIds) {
      wrestlers[pid] = {
        hp: wrestlerHp,
        maxHp: wrestlerHp,
        stamina: wrestlerStamina,
        maxStamina: wrestlerStamina,
        momentum: 0,
        position: 'center',
        ropeBreaksLeft: matchType === 'cage' ? 0 : ropeBreaks,
        eliminated: false,
        isActive: true,
      };
    }

    // For tag matches, set up partners
    if (matchType === 'tag' && allIds.length >= 2) {
      // First half vs second half
      const half = Math.ceil(allIds.length / 2);
      for (let i = 0; i < allIds.length; i++) {
        const pid = allIds[i];
        if (i < half) {
          wrestlers[pid].tagPartner = playerIds[i + half] ?? undefined;
          wrestlers[pid].isActive = i === 0;
        } else {
          wrestlers[pid].tagPartner = playerIds[i - half] ?? undefined;
          wrestlers[pid].isActive = i === half;
        }
      }
    }

    const turnOrder = allIds.filter((pid) => {
      if (matchType === 'tag') return wrestlers[pid].isActive;
      return true;
    });

    const state: WrestlerState = {
      wrestlers,
      crowdMeter: 0,
      referee: {
        position: 'center',
        counting: false,
        count: 0,
        targetId: null,
      },
      matchType,
      turnOrder,
      currentTurnIndex: 0,
      matchOver: false,
      pinAttemptActive: false,
      pinAttacker: null,
      pinDefender: null,
      finisherThreshold,
    };

    return state;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WrestlerState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }

    const wrestler = data.wrestlers[playerId];
    if (!wrestler) {
      return { success: false, error: 'Wrestler not found' };
    }

    if (wrestler.eliminated) {
      return { success: false, error: 'Wrestler has been eliminated' };
    }

    // If a pin is active, only the defender can kick_out or rope_break
    if (data.pinAttemptActive) {
      if (playerId === data.pinDefender) {
        if (action.type === 'kick_out') {
          return this.handleKickOut(playerId, data);
        }
        if (action.type === 'rope_break') {
          return this.handleRopeBreak(playerId, data);
        }
        return { success: false, error: 'You can only kick out or use a rope break during a pin' };
      }
      return { success: false, error: 'Pin attempt in progress, waiting for defender response' };
    }

    // Tag match: only active wrestlers can act (except tag_partner)
    if (data.matchType === 'tag' && !wrestler.isActive && action.type !== 'tag_partner') {
      return { success: false, error: 'Not the active wrestler. Use tag_partner to switch in.' };
    }

    // Stamina check
    const cost = this.getStaminaCosts()[action.type] ?? 0;
    if (wrestler.stamina < cost) {
      return { success: false, error: 'Not enough stamina' };
    }

    switch (action.type) {
      case 'strike':
        return this.handleStrike(playerId, action, data);
      case 'grapple':
        return this.handleGrapple(playerId, data);
      case 'irish_whip':
        return this.handleIrishWhip(playerId, action, data);
      case 'pin':
        return this.handlePin(playerId, data);
      case 'rope_break':
        return this.handleRopeBreak(playerId, data);
      case 'tag_partner':
        return this.handleTagPartner(playerId, data);
      case 'climb_turnbuckle':
        return this.handleClimbTurnbuckle(playerId, data);
      case 'finisher':
        return this.handleFinisher(playerId, data);
      case 'kick_out':
        return { success: false, error: 'No pin attempt to kick out of' };
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private getStaminaCosts(): Record<string, number> {
    const cfg = this.config as WrestlerConfig;
    return cfg.gameplay?.staminaDrain ?? DEFAULT_STAMINA_COSTS;
  }

  private getStrikeDamage(): Record<string, number> {
    const cfg = this.config as WrestlerConfig;
    return cfg.gameplay?.strikeDamage ?? DEFAULT_STRIKE_DAMAGE;
  }

  private getMomentumGains(): Record<string, number> {
    const cfg = this.config as WrestlerConfig;
    return cfg.gameplay?.momentumGains ?? DEFAULT_MOMENTUM_GAINS;
  }

  private getOpponent(playerId: string, data: WrestlerState): Wrestler | null {
    const opponents = Object.entries(data.wrestlers).filter(
      ([id, w]) => id !== playerId && !w.eliminated && w.isActive !== false,
    );
    if (opponents.length === 0) return null;
    // In tag, filter to active opponents
    if (data.matchType === 'tag') {
      const active = opponents.filter(([, w]) => w.isActive);
      if (active.length > 0) return active[0][1];
    }
    return opponents[0][1];
  }

  private getOpponentId(playerId: string, data: WrestlerState): string | null {
    const opponents = Object.entries(data.wrestlers).filter(
      ([id, w]) => id !== playerId && !w.eliminated,
    );
    if (opponents.length === 0) return null;
    if (data.matchType === 'tag') {
      const active = opponents.filter(([, w]) => w.isActive);
      if (active.length > 0) return active[0][0];
    }
    return opponents[0][0];
  }

  private getMomentumMultiplier(data: WrestlerState): number {
    // High crowd meter gives +50% momentum gain
    if (data.crowdMeter > 50) return 1.5;
    if (data.crowdMeter < -50) return 0.75;
    return 1.0;
  }

  private handleStrike(playerId: string, action: GameAction, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const strikeType = (action.payload.type as string) || 'punch';
    const damage = this.getStrikeDamage()[strikeType] ?? 5;

    const opponentId = this.getOpponentId(playerId, data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;

    if (!opponent) {
      return { success: false, error: 'No opponent available' };
    }

    wrestler.stamina -= this.getStaminaCosts().strike;
    opponent.hp -= damage;

    const momentumGain = Math.floor(
      (this.getMomentumGains().strike ?? 5) * this.getMomentumMultiplier(data),
    );
    wrestler.momentum = Math.min(100, wrestler.momentum + momentumGain);

    // Crowd reacts to strikes
    data.crowdMeter = Math.min(100, data.crowdMeter + 2);

    this.emitEvent('strike', playerId, { type: strikeType, damage, target: opponentId });

    this.advanceTurn(data);
    this.regenStamina(data);
    this.regenTagPartners(data);
    this.checkElimination(opponentId!, data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleGrapple(playerId: string, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponentId = this.getOpponentId(playerId, data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;

    if (!opponent) {
      return { success: false, error: 'No opponent available' };
    }

    // Grapple check: compare power before stamina deduction (initiator advantage).
    const wrestlerPower = wrestler.stamina + wrestler.momentum;
    const opponentPower = opponent.stamina + opponent.momentum;

    wrestler.stamina -= this.getStaminaCosts().grapple;

    const cfg = this.config as WrestlerConfig;
    if (wrestlerPower >= opponentPower) {
      const damage = (cfg.gameplay?.grapplingDamage as number) ?? DEFAULT_GRAPPLING_DAMAGE;
      opponent.hp -= damage;

      const momentumGain = Math.floor(
        (this.getMomentumGains().grapple ?? 10) * this.getMomentumMultiplier(data),
      );
      wrestler.momentum = Math.min(100, wrestler.momentum + momentumGain);
      data.crowdMeter = Math.min(100, data.crowdMeter + 5);

      this.emitEvent('grapple_success', playerId, { damage, target: opponentId });
      this.checkElimination(opponentId!, data);
    } else {
      // Grapple failed: opponent reverses
      const reverseDamage = 5;
      wrestler.hp -= reverseDamage;
      opponent.momentum = Math.min(100, opponent.momentum + 5);
      data.crowdMeter = Math.min(100, data.crowdMeter + 3);

      this.emitEvent('grapple_reversed', playerId, { damage: reverseDamage });
    }

    this.advanceTurn(data);
    this.regenStamina(data);
    this.regenTagPartners(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleIrishWhip(playerId: string, action: GameAction, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const direction = (action.payload.direction as string) || 'ropes';
    const opponentId = this.getOpponentId(playerId, data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;

    if (!opponent) {
      return { success: false, error: 'No opponent available' };
    }

    wrestler.stamina -= this.getStaminaCosts().irish_whip;

    const damage = direction === 'corner' ? 10 : 8;
    opponent.hp -= damage;
    opponent.position = direction === 'corner' ? 'corner' : 'ropes';

    data.crowdMeter = Math.min(100, data.crowdMeter + 3);

    this.emitEvent('irish_whip', playerId, { direction, damage, target: opponentId });

    this.advanceTurn(data);
    this.regenStamina(data);
    this.regenTagPartners(data);
    this.checkElimination(opponentId!, data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handlePin(playerId: string, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];
    const opponentId = this.getOpponentId(playerId, data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;

    if (!opponent) {
      return { success: false, error: 'No opponent available' };
    }

    wrestler.stamina -= this.getStaminaCosts().pin;

    data.pinAttemptActive = true;
    data.pinAttacker = playerId;
    data.pinDefender = opponentId!;
    data.referee.counting = true;
    data.referee.count = 0;
    data.referee.targetId = opponentId!;

    this.emitEvent('pin_attempt', playerId, { target: opponentId });

    // Auto-resolve if defender is the CPU (REST API cannot wait for separate action)
    if (opponentId === 'cpu') {
      this.resolveCpuPinDefense(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  /**
   * Immediately resolve pin defense for the CPU opponent.
   * Escape chance scales with remaining stamina:
   *   > 50% max stamina: 80% escape
   *   25-50%: 50% escape
   *   < 25%: 20% escape
   * On success: pin cleared, CPU loses stamina, pinner is stunned (turn skipped).
   * On failure: CPU is pinned, match may end.
   */
  private resolveCpuPinDefense(data: WrestlerState): void {
    const cpu = data.wrestlers['cpu'];
    if (!cpu) return;

    const staminaRatio = cpu.stamina / cpu.maxStamina;
    let escapeChance: number;
    if (staminaRatio > 0.5) {
      escapeChance = 0.8;
    } else if (staminaRatio > 0.25) {
      escapeChance = 0.5;
    } else {
      escapeChance = 0.2;
    }

    const escaped = Math.random() < escapeChance;

    if (escaped) {
      // CPU kicks out
      data.pinAttemptActive = false;
      data.pinAttacker = null;
      data.pinDefender = null;
      data.referee.counting = false;
      data.referee.count = 0;
      data.referee.targetId = null;

      cpu.stamina = Math.max(0, cpu.stamina - this.getStaminaCosts().kick_out);
      cpu.momentum = Math.min(100, cpu.momentum + 5);
      data.crowdMeter = Math.min(100, data.crowdMeter + 10);

      this.emitEvent('kick_out', 'cpu', { success: true, escapeChance });

      // Advance turn past the pinner (stun effect)
      this.advanceTurn(data);
      this.regenStamina(data);
      this.regenTagPartners(data);
    } else {
      // CPU fails to kick out: pinned and eliminated
      data.referee.count = 3;
      data.pinAttemptActive = false;
      data.pinAttacker = null;
      data.pinDefender = null;
      data.referee.counting = false;
      data.referee.targetId = null;

      cpu.eliminated = true;
      data.turnOrder = data.turnOrder.filter((id) => id !== 'cpu');
      if (data.currentTurnIndex >= data.turnOrder.length && data.turnOrder.length > 0) {
        data.currentTurnIndex = 0;
      }

      this.emitEvent('pinned', 'cpu', { count: 3 });
      this.checkMatchEnd(data);
    }
  }

  private handleKickOut(playerId: string, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];

    // Kick out success chance = hp / maxHp
    // After finisher: half success rate
    const successChance = wrestler.hp / wrestler.maxHp;

    // Deterministic for testability: succeed if HP > 20%
    if (wrestler.hp > wrestler.maxHp * 0.2) {
      // Successful kick out
      data.pinAttemptActive = false;
      data.pinAttacker = null;
      data.pinDefender = null;
      data.referee.counting = false;
      data.referee.count = 0;
      data.referee.targetId = null;

      wrestler.stamina -= this.getStaminaCosts().kick_out;
      wrestler.momentum = Math.min(100, wrestler.momentum + 5);
      data.crowdMeter = Math.min(100, data.crowdMeter + 10);

      this.emitEvent('kick_out', playerId, { successChance });

      this.advanceTurn(data);
      this.regenStamina(data);
      this.regenTagPartners(data);
    } else {
      // Failed to kick out: count reaches 3 (pinned)
      data.referee.count = 3;
      data.pinAttemptActive = false;

      wrestler.eliminated = true;
      this.emitEvent('pinned', playerId, { count: 3 });

      this.checkMatchEnd(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleRopeBreak(playerId: string, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];

    if (data.matchType === 'cage') {
      return { success: false, error: 'No rope breaks in cage matches' };
    }

    if (wrestler.ropeBreaksLeft <= 0) {
      return { success: false, error: 'No rope breaks remaining' };
    }

    wrestler.ropeBreaksLeft--;

    if (data.pinAttemptActive && data.pinDefender === playerId) {
      data.pinAttemptActive = false;
      data.pinAttacker = null;
      data.pinDefender = null;
      data.referee.counting = false;
      data.referee.count = 0;
      data.referee.targetId = null;

      this.emitEvent('rope_break', playerId, { remaining: wrestler.ropeBreaksLeft });
    } else {
      this.emitEvent('rope_break', playerId, { remaining: wrestler.ropeBreaksLeft });
    }

    this.advanceTurn(data);
    this.regenStamina(data);
    this.regenTagPartners(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleTagPartner(playerId: string, data: WrestlerState): ActionResult {
    if (data.matchType !== 'tag') {
      return { success: false, error: 'Tag is only available in tag matches' };
    }

    const wrestler = data.wrestlers[playerId];
    const partnerId = wrestler.tagPartner;

    if (!partnerId || !data.wrestlers[partnerId]) {
      return { success: false, error: 'No tag partner available' };
    }

    const partner = data.wrestlers[partnerId];
    if (partner.eliminated) {
      return { success: false, error: 'Tag partner has been eliminated' };
    }

    wrestler.isActive = false;
    partner.isActive = true;

    // Rebuild turn order
    data.turnOrder = Object.entries(data.wrestlers)
      .filter(([, w]) => w.isActive && !w.eliminated)
      .map(([id]) => id);
    data.currentTurnIndex = 0;

    this.emitEvent('tag', playerId, { partner: partnerId });

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleClimbTurnbuckle(playerId: string, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];

    wrestler.stamina -= this.getStaminaCosts().climb_turnbuckle;
    wrestler.position = 'turnbuckle';

    // Cage match: escape attempt if momentum >= 90
    if (data.matchType === 'cage' && wrestler.momentum >= 90) {
      // Successful cage escape
      this.emitEvent('cage_escape', playerId, {});
      data.matchOver = true;

      // Mark all others as eliminated
      for (const [id, w] of Object.entries(data.wrestlers)) {
        if (id !== playerId) {
          w.eliminated = true;
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const momentumGain = Math.floor(
      (this.getMomentumGains().climb_turnbuckle ?? 15) * this.getMomentumMultiplier(data),
    );
    wrestler.momentum = Math.min(100, wrestler.momentum + momentumGain);
    data.crowdMeter = Math.min(100, data.crowdMeter + 8);

    // High-risk aerial attack
    const opponentId = this.getOpponentId(playerId, data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;

    if (opponent) {
      const aerialCfg = this.config as WrestlerConfig;
      const damage = (aerialCfg.gameplay?.aerialDamage as number) ?? DEFAULT_AERIAL_DAMAGE;
      opponent.hp -= damage;
      this.emitEvent('aerial_attack', playerId, { damage, target: opponentId });
      this.checkElimination(opponentId!, data);
    }

    this.advanceTurn(data);
    this.regenStamina(data);
    this.regenTagPartners(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFinisher(playerId: string, data: WrestlerState): ActionResult {
    const wrestler = data.wrestlers[playerId];

    if (wrestler.momentum < data.finisherThreshold) {
      return {
        success: false,
        error: `Need ${data.finisherThreshold} momentum for finisher (currently ${wrestler.momentum})`,
      };
    }

    const opponentId = this.getOpponentId(playerId, data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;

    if (!opponent) {
      return { success: false, error: 'No opponent available' };
    }

    wrestler.stamina -= this.getStaminaCosts().finisher;
    wrestler.momentum = 0;

    const finCfg = this.config as WrestlerConfig;
    const damage = (finCfg.gameplay?.finisherDamage as number) ?? DEFAULT_FINISHER_DAMAGE;
    opponent.hp -= damage;

    data.crowdMeter = Math.min(100, data.crowdMeter + 20);

    this.emitEvent('finisher', playerId, { damage, target: opponentId });

    // Auto-pin setup after finisher
    if (opponent.hp > 0) {
      data.pinAttemptActive = true;
      data.pinAttacker = playerId;
      data.pinDefender = opponentId!;
      data.referee.counting = true;
      data.referee.count = 0;
      data.referee.targetId = opponentId!;

      this.emitEvent('pin_after_finisher', playerId, { target: opponentId });

      // Auto-resolve if defender is the CPU
      if (opponentId === 'cpu') {
        this.resolveCpuPinDefense(data);
      }
    } else {
      opponent.hp = 0;
      opponent.eliminated = true;
      this.emitEvent('knocked_out', opponentId!, {});
      this.checkMatchEnd(data);
    }

    this.regenStamina(data);
    this.regenTagPartners(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private advanceTurn(data: WrestlerState): void {
    if (data.turnOrder.length > 0) {
      data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
    }
    // Auto-run CPU turn if it's the CPU's turn
    if (
      !data.matchOver &&
      data.turnOrder.length > 0 &&
      data.turnOrder[data.currentTurnIndex] === 'cpu'
    ) {
      this.runCpuTurn(data);
    }
  }

  private runCpuTurn(data: WrestlerState): void {
    const cpu = data.wrestlers['cpu'];
    if (!cpu || cpu.eliminated || data.matchOver) return;

    const opponentId = this.getOpponentId('cpu', data);
    const opponent = opponentId ? data.wrestlers[opponentId] : null;
    if (!opponent) return;

    // Handle pin defense: CPU auto kicks out
    if (data.pinAttemptActive && data.pinDefender === 'cpu') {
      const kickOutChance = Math.max(0.2, cpu.hp / cpu.maxHp);
      if (Math.random() < kickOutChance) {
        data.pinAttemptActive = false;
        data.pinAttacker = null;
        data.pinDefender = null;
        data.referee.counting = false;
        data.referee.count = 0;
        data.referee.targetId = null;
        cpu.stamina -= this.getStaminaCosts().kick_out;
        this.emitEvent('kick_out', 'cpu', { success: true });
      } else {
        data.referee.count = 3;
        cpu.eliminated = true;
        data.turnOrder = data.turnOrder.filter((id) => id !== 'cpu');
        data.pinAttemptActive = false;
        this.emitEvent('pinned', 'cpu', { by: data.pinAttacker });
        this.checkMatchEnd(data);
      }
      if (data.turnOrder.length > 0) {
        data.currentTurnIndex = data.currentTurnIndex % data.turnOrder.length;
      }
      return;
    }

    // Simple weighted AI
    const roll = Math.random();
    const cpuCfg = this.config as WrestlerConfig;
    if (
      cpu.momentum >= (data.finisherThreshold ?? 80) &&
      cpu.stamina >= this.getStaminaCosts().finisher
    ) {
      const damage = (cpuCfg.gameplay?.finisherDamage as number) ?? DEFAULT_FINISHER_DAMAGE;
      opponent.hp = Math.max(0, opponent.hp - damage);
      cpu.stamina -= this.getStaminaCosts().finisher;
      cpu.momentum = 0;
      data.crowdMeter = Math.min(100, data.crowdMeter + 20);
      this.emitEvent('finisher', 'cpu', { damage, target: opponentId });
      if (opponent.hp > 0) {
        data.pinAttemptActive = true;
        data.pinAttacker = 'cpu';
        data.pinDefender = opponentId!;
        data.referee.counting = true;
        data.referee.count = 0;
        data.referee.targetId = opponentId!;
      } else {
        opponent.eliminated = true;
        this.emitEvent('knocked_out', opponentId!, {});
        this.checkMatchEnd(data);
      }
    } else if (opponent.hp <= 20 && cpu.stamina >= this.getStaminaCosts().pin && roll < 0.6) {
      // Pin when opponent is weak
      data.pinAttemptActive = true;
      data.pinAttacker = 'cpu';
      data.pinDefender = opponentId!;
      data.referee.counting = true;
      data.referee.count = 0;
      data.referee.targetId = opponentId!;
      cpu.stamina -= this.getStaminaCosts().pin;
      this.emitEvent('pin_attempt', 'cpu', { target: opponentId });
    } else if (roll < 0.4) {
      // Strike
      const types = ['punch', 'kick', 'chop'];
      const t = types[Math.floor(Math.random() * types.length)];
      const damage = this.getStrikeDamage()[t] ?? 5;
      opponent.hp = Math.max(0, opponent.hp - damage);
      cpu.stamina -= this.getStaminaCosts().strike;
      const momentumGain = Math.floor(
        (this.getMomentumGains().strike ?? 5) * this.getMomentumMultiplier(data),
      );
      cpu.momentum = Math.min(100, cpu.momentum + momentumGain);
      data.crowdMeter = Math.min(100, data.crowdMeter + 2);
      this.emitEvent('strike', 'cpu', { type: t, damage, target: opponentId });
      this.checkElimination(opponentId!, data);
    } else if (roll < 0.7 && cpu.stamina >= this.getStaminaCosts().grapple) {
      // Grapple
      const grappleSuccess = Math.random() < 0.6;
      if (grappleSuccess) {
        const damage = (cpuCfg.gameplay?.grapplingDamage as number) ?? DEFAULT_GRAPPLING_DAMAGE;
        opponent.hp = Math.max(0, opponent.hp - damage);
        const momentumGain = Math.floor(
          (this.getMomentumGains().grapple ?? 10) * this.getMomentumMultiplier(data),
        );
        cpu.momentum = Math.min(100, cpu.momentum + momentumGain);
        this.emitEvent('grapple', 'cpu', { success: true, damage, target: opponentId });
      } else {
        cpu.stamina -= 5;
        this.emitEvent('grapple', 'cpu', { success: false });
      }
      cpu.stamina -= this.getStaminaCosts().grapple;
      this.checkElimination(opponentId!, data);
    } else {
      // Irish whip
      const damage = 8;
      opponent.hp = Math.max(0, opponent.hp - damage);
      cpu.stamina -= this.getStaminaCosts().irish_whip;
      data.crowdMeter = Math.min(100, data.crowdMeter + 3);
      this.emitEvent('irish_whip', 'cpu', { damage, target: opponentId });
      this.checkElimination(opponentId!, data);
    }

    this.regenStamina(data);
    this.regenTagPartners(data);

    // Advance past CPU's turn
    if (data.turnOrder.length > 0 && !data.matchOver) {
      data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
    }
  }

  private regenStamina(data: WrestlerState): void {
    const cfg = this.config as WrestlerConfig;
    const regenRate = (cfg.gameplay?.staminaRegen as number) ?? DEFAULT_STAMINA_REGEN;
    for (const wrestler of Object.values(data.wrestlers)) {
      if (!wrestler.eliminated) {
        wrestler.stamina = Math.min(wrestler.maxStamina, wrestler.stamina + regenRate);
      }
    }
  }

  private regenTagPartners(data: WrestlerState): void {
    if (data.matchType !== 'tag') return;
    const cfg = this.config as WrestlerConfig;
    const healRate = (cfg.gameplay?.tagPartnerHealRate as number) ?? DEFAULT_TAG_HEAL_RATE;
    for (const wrestler of Object.values(data.wrestlers)) {
      if (!wrestler.eliminated && !wrestler.isActive) {
        wrestler.hp = Math.min(wrestler.maxHp, wrestler.hp + healRate);
      }
    }
  }

  private checkElimination(wrestlerId: string, data: WrestlerState): void {
    const wrestler = data.wrestlers[wrestlerId];
    if (!wrestler || wrestler.hp > 0) return;

    // In royal rumble, eliminated when HP <= 0
    if (data.matchType === 'royal-rumble') {
      wrestler.hp = 0;
      wrestler.eliminated = true;
      this.emitEvent('eliminated', wrestlerId, { matchType: 'royal-rumble' });
      data.turnOrder = data.turnOrder.filter((id) => id !== wrestlerId);
      if (data.currentTurnIndex >= data.turnOrder.length) {
        data.currentTurnIndex = 0;
      }
      this.checkMatchEnd(data);
    }
    // In other modes, HP can go to 0 but wrestler is not auto-eliminated
    // They must be pinned
    if (wrestler.hp < 0) {
      wrestler.hp = 0;
    }
  }

  private checkMatchEnd(data: WrestlerState): void {
    const active = Object.entries(data.wrestlers).filter(([, w]) => !w.eliminated);

    if (data.matchType === 'royal-rumble') {
      if (active.length <= 1) {
        data.matchOver = true;
      }
    } else if (data.matchType === 'tag') {
      // Check if one team is fully eliminated
      const teams: Record<string, boolean> = {};
      for (const [id, w] of Object.entries(data.wrestlers)) {
        const teamKey = w.tagPartner ? [id, w.tagPartner].sort().join('-') : id;
        if (!teams[teamKey]) {
          teams[teamKey] = false;
        }
        if (!w.eliminated) {
          teams[teamKey] = true;
        }
      }
      const teamsAlive = Object.values(teams).filter((alive) => alive).length;
      if (teamsAlive <= 1) {
        data.matchOver = true;
      }
    } else {
      // Singles or cage
      if (active.length <= 1) {
        data.matchOver = true;
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<WrestlerState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<WrestlerState>();
    const active = Object.entries(data.wrestlers).filter(([, w]) => !w.eliminated);

    if (active.length === 1) {
      return active[0][0];
    }

    // If multiple still active, highest HP wins
    let bestId: string | null = null;
    let bestHp = -1;
    for (const [id, w] of active) {
      if (w.hp > bestHp) {
        bestHp = w.hp;
        bestId = id;
      }
    }
    return bestId;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<WrestlerState>();
    const scores: Record<string, number> = {};
    for (const [id, w] of Object.entries(data.wrestlers)) {
      scores[id] = w.momentum + (w.eliminated ? 0 : 100) + (w.hp > 0 ? w.hp : 0);
    }
    return scores;
  }
}

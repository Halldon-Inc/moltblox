/**
 * MartialArtsGame: Stance-based fighting with multiple martial arts styles
 *
 * Players choose from kung-fu, karate, muay-thai, capoeira, or judo.
 * Each stance provides unique stat profiles. Switching stances mid-fight
 * enables cross-stance "flow combos" for bonus damage.
 *
 * Actions: switch_stance, strike, kick, sweep, clinch, throw, counter, special
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MartialArtsConfig {
  availableStyles?: string[];
  stanceSwitchCooldown?: number;
  flowBonusMultiplier?: number;
  roundsToWin?: number;
  theme?: {
    dojoBackground?: string;
    beltColors?: Record<string, string>;
    stanceEffectColor?: string;
  };
  gameplay?: {
    fighterHp?: number;
    fighterStamina?: number;
    kiCosts?: Record<string, number>;
    blockReduction?: number;
    comboLimit?: number;
    specialStaminaCost?: number;
    knockdownChance?: number;
    counterMultiplier?: number;
    stanceProfiles?: Record<string, { atk: number; def: number; spd: number }>;
  };
  content?: {
    styleDefinitions?: Record<string, { atk: number; def: number; spd: number }>;
    techniqueList?: string[];
  };
}

interface StanceProfile {
  atk: number;
  def: number;
  spd: number;
}

const DEFAULT_STANCE_PROFILES: Record<string, StanceProfile> = {
  'kung-fu': { atk: 8, def: 8, spd: 8 },
  karate: { atk: 12, def: 6, spd: 6 },
  'muay-thai': { atk: 10, def: 4, spd: 10 },
  capoeira: { atk: 6, def: 6, spd: 12 },
  judo: { atk: 7, def: 10, spd: 7 },
};

const DEFAULT_FIGHTER_HP = 100;
const DEFAULT_FIGHTER_STAMINA = 100;
const DEFAULT_SPECIAL_STAMINA_COST = 30;
const DEFAULT_KNOCKDOWN_CHANCE = 0.6;
const DEFAULT_COUNTER_MULTIPLIER = 1.5;
const DEFAULT_COMBO_LIMIT = 10;

interface MAFighter {
  id: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  stance: string;
  stanceCooldown: number;
  comboChain: string[];
  roundWins: number;
  lastAction: string | null;
  skipNextTurn: boolean;
  alive: boolean;
  [key: string]: unknown;
}

interface MartialArtsState {
  fighters: Record<string, MAFighter>;
  currentRound: number;
  roundOver: boolean;
  matchOver: boolean;
  roundsToWin: number;
  availableStyles: string[];
  stanceSwitchCooldown: number;
  flowBonusMultiplier: number;
  totalScore: Record<string, number>;
  [key: string]: unknown;
}

export class MartialArtsGame extends BaseGame {
  readonly name = 'Martial Arts';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): MartialArtsState {
    const cfg = this.config as MartialArtsConfig;
    const availableStyles = cfg.availableStyles ?? [
      'kung-fu',
      'karate',
      'muay-thai',
      'capoeira',
      'judo',
    ];
    const stanceSwitchCooldown = cfg.stanceSwitchCooldown ?? 2;
    const flowBonusMultiplier = cfg.flowBonusMultiplier ?? 1.5;
    const roundsToWin = cfg.roundsToWin ?? 2;

    const fighterHp = (cfg.gameplay?.fighterHp as number) ?? DEFAULT_FIGHTER_HP;
    const fighterStamina = (cfg.gameplay?.fighterStamina as number) ?? DEFAULT_FIGHTER_STAMINA;

    const fighters: Record<string, MAFighter> = {};
    const totalScore: Record<string, number> = {};
    const ids = playerIds.length === 1 ? [...playerIds, 'cpu'] : playerIds;

    for (const pid of ids) {
      fighters[pid] = {
        id: pid,
        hp: fighterHp,
        maxHp: fighterHp,
        stamina: fighterStamina,
        maxStamina: fighterStamina,
        stance: availableStyles[0],
        stanceCooldown: 0,
        comboChain: [],
        roundWins: 0,
        lastAction: null,
        skipNextTurn: false,
        alive: true,
      };
      totalScore[pid] = 0;
    }

    return {
      fighters,
      currentRound: 1,
      roundOver: false,
      matchOver: false,
      roundsToWin,
      availableStyles,
      stanceSwitchCooldown,
      flowBonusMultiplier,
      totalScore,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MartialArtsState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }
    if (data.roundOver) {
      if (action.type === 'next_round') {
        return this.handleNextRound(data);
      }
      return { success: false, error: 'Round is over' };
    }

    const fighter = data.fighters[playerId];
    if (!fighter || !fighter.alive) {
      return { success: false, error: 'Fighter not active' };
    }
    if (fighter.skipNextTurn) {
      fighter.skipNextTurn = false;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Decrease cooldowns each action
    if (fighter.stanceCooldown > 0) {
      fighter.stanceCooldown--;
    }

    let result: ActionResult;

    switch (action.type) {
      case 'switch_stance':
        result = this.handleSwitchStance(playerId, action, data);
        break;
      case 'strike':
      case 'kick':
        result = this.handleBasicAttack(playerId, action.type, data);
        break;
      case 'sweep':
        result = this.handleSweep(playerId, data);
        break;
      case 'clinch':
        result = this.handleBasicAttack(playerId, 'clinch', data);
        break;
      case 'throw':
        result = this.handleBasicAttack(playerId, 'throw', data);
        break;
      case 'counter':
        result = this.handleCounter(playerId, data);
        break;
      case 'special':
        result = this.handleSpecial(playerId, data);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action.type}` };
    }

    return result;
  }

  private getOpponent(playerId: string, data: MartialArtsState): MAFighter | null {
    const opponents = Object.values(data.fighters).filter((f) => f.id !== playerId && f.alive);
    return opponents[0] ?? null;
  }

  private getStanceProfile(stance: string): StanceProfile {
    const cfg = this.config as MartialArtsConfig;
    const profiles =
      cfg.gameplay?.stanceProfiles ?? cfg.content?.styleDefinitions ?? DEFAULT_STANCE_PROFILES;
    return profiles[stance] ?? { atk: 8, def: 8, spd: 8 };
  }

  private calculateDamage(attacker: MAFighter, defender: MAFighter): number {
    const atkProfile = this.getStanceProfile(attacker.stance);
    const defProfile = this.getStanceProfile(defender.stance);
    return Math.max(
      1,
      Math.floor(atkProfile.atk * (1 + atkProfile.spd * 0.05) - defProfile.def * 0.5),
    );
  }

  private checkFlowCombo(fighter: MAFighter): boolean {
    const chain = fighter.comboChain;
    if (chain.length < 3) return false;
    const last3 = chain.slice(-3);
    const uniqueStances = new Set(last3);
    return uniqueStances.size >= 3;
  }

  private applyDamage(
    playerId: string,
    damage: number,
    data: MartialArtsState,
    opponent: MAFighter,
  ): void {
    opponent.hp -= damage;
    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;

    if (opponent.hp <= 0) {
      opponent.hp = 0;
      opponent.alive = false;
      const winner = data.fighters[playerId];
      winner.roundWins++;
      data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + 100;
      data.roundOver = true;

      if (winner.roundWins >= data.roundsToWin) {
        data.matchOver = true;
        this.emitEvent('match_won', playerId, { rounds: winner.roundWins });
      } else {
        this.emitEvent('round_won', playerId, { round: data.currentRound });
      }
    }
  }

  private handleSwitchStance(
    playerId: string,
    action: GameAction,
    data: MartialArtsState,
  ): ActionResult {
    const fighter = data.fighters[playerId];
    const newStyle = action.payload?.style as string;

    if (!newStyle || !data.availableStyles.includes(newStyle)) {
      return { success: false, error: 'Invalid style' };
    }
    if (fighter.stance === newStyle) {
      return { success: false, error: 'Already in that stance' };
    }
    if (fighter.stanceCooldown > 0) {
      return { success: false, error: 'Stance switch on cooldown' };
    }

    fighter.stance = newStyle;
    fighter.stanceCooldown = data.stanceSwitchCooldown;
    fighter.lastAction = 'switch_stance';

    this.emitEvent('stance_switched', playerId, { style: newStyle });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleBasicAttack(
    playerId: string,
    moveType: string,
    data: MartialArtsState,
  ): ActionResult {
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) {
      return { success: false, error: 'No opponent' };
    }

    let damage = this.calculateDamage(fighter, opponent);

    const cfg = this.config as MartialArtsConfig;
    const comboLimit = (cfg.gameplay?.comboLimit as number) ?? DEFAULT_COMBO_LIMIT;
    fighter.comboChain.push(fighter.stance);
    if (fighter.comboChain.length > comboLimit) {
      fighter.comboChain = fighter.comboChain.slice(-comboLimit);
    }

    // Flow combo check
    if (this.checkFlowCombo(fighter)) {
      damage = Math.floor(damage * data.flowBonusMultiplier);
      this.emitEvent('flow_combo', playerId, { damage });
    }

    fighter.lastAction = moveType;
    this.emitEvent('attack', playerId, { moveType, damage });
    this.applyDamage(playerId, damage, data, opponent);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSweep(playerId: string, data: MartialArtsState): ActionResult {
    const cfg = this.config as MartialArtsConfig;
    const comboLimit = (cfg.gameplay?.comboLimit as number) ?? DEFAULT_COMBO_LIMIT;
    const knockdownChance = (cfg.gameplay?.knockdownChance as number) ?? DEFAULT_KNOCKDOWN_CHANCE;
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) {
      return { success: false, error: 'No opponent' };
    }

    fighter.comboChain.push(fighter.stance);
    if (fighter.comboChain.length > comboLimit) {
      fighter.comboChain = fighter.comboChain.slice(-comboLimit);
    }

    let damage = this.calculateDamage(fighter, opponent);

    if (this.checkFlowCombo(fighter)) {
      damage = Math.floor(damage * data.flowBonusMultiplier);
    }

    const knockdown = Math.random() < knockdownChance;
    if (knockdown) {
      opponent.skipNextTurn = true;
      this.emitEvent('knockdown', playerId, { target: opponent.id });
    }

    fighter.lastAction = 'sweep';
    this.emitEvent('attack', playerId, { moveType: 'sweep', damage, knockdown });
    this.applyDamage(playerId, damage, data, opponent);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleCounter(playerId: string, data: MartialArtsState): ActionResult {
    const cfg = this.config as MartialArtsConfig;
    const comboLimit = (cfg.gameplay?.comboLimit as number) ?? DEFAULT_COMBO_LIMIT;
    const counterMult = (cfg.gameplay?.counterMultiplier as number) ?? DEFAULT_COUNTER_MULTIPLIER;
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) {
      return { success: false, error: 'No opponent' };
    }

    fighter.comboChain.push(fighter.stance);
    if (fighter.comboChain.length > comboLimit) {
      fighter.comboChain = fighter.comboChain.slice(-comboLimit);
    }

    const attackActions = ['strike', 'kick', 'sweep', 'clinch', 'throw', 'special'];
    if (opponent.lastAction && attackActions.includes(opponent.lastAction)) {
      let damage = Math.floor(this.calculateDamage(fighter, opponent) * counterMult);

      if (this.checkFlowCombo(fighter)) {
        damage = Math.floor(damage * data.flowBonusMultiplier);
      }

      fighter.lastAction = 'counter';
      this.emitEvent('counter', playerId, { damage });
      this.applyDamage(playerId, damage, data, opponent);
    } else {
      // Wasted turn
      fighter.lastAction = 'counter';
      this.emitEvent('counter_missed', playerId, {});
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSpecial(playerId: string, data: MartialArtsState): ActionResult {
    const cfg = this.config as MartialArtsConfig;
    const specialCost =
      (cfg.gameplay?.specialStaminaCost as number) ?? DEFAULT_SPECIAL_STAMINA_COST;
    const comboLimit = (cfg.gameplay?.comboLimit as number) ?? DEFAULT_COMBO_LIMIT;
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) {
      return { success: false, error: 'No opponent' };
    }

    if (fighter.stamina < specialCost) {
      return { success: false, error: 'Not enough stamina' };
    }

    fighter.stamina -= specialCost;
    const atkProfile = this.getStanceProfile(fighter.stance);
    let damage = atkProfile.atk * 2;

    fighter.comboChain.push(fighter.stance);
    if (fighter.comboChain.length > comboLimit) {
      fighter.comboChain = fighter.comboChain.slice(-comboLimit);
    }

    if (this.checkFlowCombo(fighter)) {
      damage = Math.floor(damage * data.flowBonusMultiplier);
    }

    fighter.lastAction = 'special';
    this.emitEvent('special', playerId, { damage, stance: fighter.stance });
    this.applyDamage(playerId, damage, data, opponent);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleNextRound(data: MartialArtsState): ActionResult {
    if (!data.roundOver || data.matchOver) {
      return { success: false, error: 'Cannot start next round' };
    }

    data.currentRound++;
    data.roundOver = false;

    for (const fighter of Object.values(data.fighters)) {
      fighter.hp = fighter.maxHp;
      fighter.stamina = fighter.maxStamina;
      fighter.alive = true;
      fighter.comboChain = [];
      fighter.lastAction = null;
      fighter.skipNextTurn = false;
      fighter.stanceCooldown = 0;
    }

    this.emitEvent('round_started', undefined, { round: data.currentRound });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MartialArtsState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<MartialArtsState>();
    let bestPlayer: string | null = null;
    let bestWins = -1;
    for (const fighter of Object.values(data.fighters)) {
      if (fighter.roundWins > bestWins) {
        bestWins = fighter.roundWins;
        bestPlayer = fighter.id;
      }
    }
    return bestPlayer;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MartialArtsState>();
    return { ...data.totalScore };
  }
}

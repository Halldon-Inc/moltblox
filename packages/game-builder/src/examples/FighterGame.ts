/**
 * FighterGame - Action-based combat game
 *
 * Supports three modes:
 * - 1v1: Two fighters with HP, stamina, and rock-paper-scissors countering
 * - Beat-em-up: Player vs waves of weaker enemies with combo chains
 * - Arena: Free-for-all with 2-4 players, last standing wins
 *
 * Combat uses a counter system: light beats grab, grab beats block,
 * block beats heavy, heavy beats light. Special moves cost stamina.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface FighterConfig {
  fightStyle?: 'beat-em-up' | '1v1' | 'arena';
  roundsToWin?: number;
  roundTime?: number;
  enableSpecials?: boolean;
  comboSystem?: 'chain' | 'cancel' | 'juggle';
}

type AttackType = 'light' | 'heavy' | 'grab' | 'special';

interface Fighter {
  id: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  comboCount: number;
  lastMove: string | null;
  isBlocking: boolean;
  roundWins: number;
  alive: boolean;
  [key: string]: unknown;
}

interface WaveEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  alive: boolean;
  [key: string]: unknown;
}

interface FighterState {
  fighters: Record<string, Fighter>;
  mode: 'beat-em-up' | '1v1' | 'arena';
  roundsToWin: number;
  roundTime: number;
  enableSpecials: boolean;
  comboSystem: 'chain' | 'cancel' | 'juggle';
  currentRound: number;
  turnCount: number;
  waveEnemies: WaveEnemy[];
  currentWave: number;
  totalScore: Record<string, number>;
  roundOver: boolean;
  matchOver: boolean;
  [key: string]: unknown;
}

// Counter relationships: light > grab > block > heavy > light
const COUNTER_MAP: Record<string, string> = {
  light: 'grab',
  grab: 'block',
  block: 'heavy',
  heavy: 'light',
};

const ATTACK_DAMAGE: Record<string, number> = {
  light: 8,
  heavy: 18,
  grab: 12,
  special: 25,
};

const SPECIAL_STAMINA_COST = 30;

const WAVE_TEMPLATES = [
  [
    { name: 'Thug', hp: 30, atk: 5 },
    { name: 'Thug', hp: 30, atk: 5 },
  ],
  [
    { name: 'Brawler', hp: 50, atk: 8 },
    { name: 'Brawler', hp: 50, atk: 8 },
    { name: 'Thug', hp: 30, atk: 5 },
  ],
  [{ name: 'Champion', hp: 100, atk: 15 }],
];

export class FighterGame extends BaseGame {
  readonly name = 'Fighter';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): FighterState {
    const cfg = this.config as FighterConfig;
    const mode = cfg.fightStyle ?? '1v1';
    const roundsToWin = cfg.roundsToWin ?? 2;
    const roundTime = cfg.roundTime ?? 60;
    const enableSpecials = cfg.enableSpecials ?? true;
    const comboSystem = cfg.comboSystem ?? 'chain';

    const fighters: Record<string, Fighter> = {};
    for (const pid of playerIds) {
      fighters[pid] = {
        id: pid,
        hp: 100,
        maxHp: 100,
        stamina: 100,
        maxStamina: 100,
        comboCount: 0,
        lastMove: null,
        isBlocking: false,
        roundWins: 0,
        alive: true,
      };
    }

    const totalScore: Record<string, number> = {};
    for (const pid of playerIds) {
      totalScore[pid] = 0;
    }

    const state: FighterState = {
      fighters,
      mode,
      roundsToWin,
      roundTime,
      enableSpecials,
      comboSystem,
      currentRound: 1,
      turnCount: 0,
      waveEnemies: [],
      currentWave: 0,
      totalScore,
      roundOver: false,
      matchOver: false,
    };

    if (mode === 'beat-em-up') {
      this.spawnWave(state);
    }

    return state;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FighterState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }

    switch (action.type) {
      case 'attack':
        return this.handleAttack(playerId, action, data);
      case 'block':
        return this.handleBlock(playerId, data);
      case 'next_round':
        return this.handleNextRound(playerId, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleAttack(playerId: string, action: GameAction, data: FighterState): ActionResult {
    const fighter = data.fighters[playerId];
    if (!fighter || !fighter.alive) {
      return { success: false, error: 'Fighter not active' };
    }
    if (data.roundOver) {
      return { success: false, error: 'Round is over' };
    }

    const attackType = (action.payload.attackType as AttackType) || 'light';
    if (!['light', 'heavy', 'grab', 'special'].includes(attackType)) {
      return { success: false, error: 'Invalid attack type' };
    }

    if (attackType === 'special') {
      if (!data.enableSpecials) {
        return { success: false, error: 'Specials are disabled' };
      }
      if (fighter.stamina < SPECIAL_STAMINA_COST) {
        return { success: false, error: 'Not enough stamina' };
      }
      fighter.stamina -= SPECIAL_STAMINA_COST;
    }

    fighter.isBlocking = false;

    if (data.mode === 'beat-em-up') {
      return this.resolveBeatEmUpAttack(playerId, fighter, attackType, data);
    }

    return this.resolvePvPAttack(playerId, fighter, attackType, data);
  }

  private resolveBeatEmUpAttack(
    playerId: string,
    fighter: Fighter,
    attackType: AttackType,
    data: FighterState,
  ): ActionResult {
    const aliveEnemies = data.waveEnemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies to attack' };
    }

    const target = aliveEnemies[0];
    let damage = ATTACK_DAMAGE[attackType] || 8;

    // Combo multiplier
    if (data.comboSystem === 'chain' && fighter.lastMove && fighter.lastMove !== attackType) {
      fighter.comboCount++;
      damage = Math.floor(damage * (1 + fighter.comboCount * 0.2));
    } else if (
      data.comboSystem === 'cancel' &&
      fighter.lastMove === 'heavy' &&
      attackType === 'light'
    ) {
      fighter.comboCount++;
      damage = Math.floor(damage * 1.5);
    } else if (data.comboSystem === 'juggle' && attackType === 'heavy') {
      fighter.comboCount++;
      damage = Math.floor(damage * (1 + fighter.comboCount * 0.15));
    } else {
      fighter.comboCount = 0;
    }

    fighter.lastMove = attackType;
    target.hp -= damage;
    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;

    this.emitEvent('attack', playerId, {
      attackType,
      target: target.id,
      damage,
      combo: fighter.comboCount,
    });

    if (target.hp <= 0) {
      target.alive = false;
      target.hp = 0;
      data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + 50;
      this.emitEvent('enemy_defeated', playerId, { enemy: target.id });
    }

    // Enemy counterattack
    for (const enemy of data.waveEnemies.filter((e) => e.alive)) {
      const enemyDmg = Math.max(1, enemy.atk - (fighter.isBlocking ? 8 : 0));
      fighter.hp -= enemyDmg;
      if (fighter.hp <= 0) {
        fighter.hp = 0;
        fighter.alive = false;
        data.matchOver = true;
        break;
      }
    }

    // Check wave clear
    if (data.waveEnemies.every((e) => !e.alive)) {
      data.currentWave++;
      if (data.currentWave >= WAVE_TEMPLATES.length) {
        data.matchOver = true;
        this.emitEvent('victory', playerId, { waves: data.currentWave });
      } else {
        this.spawnWave(data);
        this.emitEvent('wave_cleared', playerId, { wave: data.currentWave });
      }
    }

    data.turnCount++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private resolvePvPAttack(
    playerId: string,
    fighter: Fighter,
    attackType: AttackType,
    data: FighterState,
  ): ActionResult {
    // Find opponent(s)
    const opponents = Object.values(data.fighters).filter((f) => f.id !== playerId && f.alive);
    if (opponents.length === 0) {
      return { success: false, error: 'No opponents' };
    }

    const target = opponents[0];
    let damage = ATTACK_DAMAGE[attackType] || 8;

    // Counter system check
    if (target.isBlocking && attackType !== 'grab') {
      // Block reduces damage (except grab beats block)
      if (COUNTER_MAP['block'] === attackType) {
        // heavy is countered by block
        damage = 0;
        this.emitEvent('blocked', playerId, { attackType });
      } else {
        damage = Math.floor(damage * 0.3);
      }
    } else if (target.isBlocking && attackType === 'grab') {
      // Grab beats block: full damage + bonus
      damage = Math.floor(damage * 1.5);
      target.isBlocking = false;
      this.emitEvent('counter', playerId, { attackType, counter: 'grab_beats_block' });
    }

    // Check if this attack type counters the opponent's last move
    if (target.lastMove && COUNTER_MAP[attackType] === target.lastMove) {
      damage = Math.floor(damage * 1.5);
      this.emitEvent('counter', playerId, { attackType, countered: target.lastMove });
    }

    fighter.lastMove = attackType;
    target.hp -= damage;
    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;

    this.emitEvent('attack', playerId, { attackType, target: target.id, damage });

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;

      // Check if round/match is over
      const aliveFighters = Object.values(data.fighters).filter((f) => f.alive);
      if (aliveFighters.length <= 1) {
        const winner = aliveFighters[0];
        if (winner) {
          winner.roundWins++;
          data.totalScore[winner.id] = (data.totalScore[winner.id] ?? 0) + 100;
        }
        data.roundOver = true;

        if (winner && winner.roundWins >= data.roundsToWin) {
          data.matchOver = true;
          this.emitEvent('match_won', winner.id, { rounds: winner.roundWins });
        } else {
          this.emitEvent('round_won', winner?.id ?? undefined, {
            round: data.currentRound,
          });
        }
      }
    }

    // Stamina regen
    fighter.stamina = Math.min(fighter.maxStamina, fighter.stamina + 5);

    data.turnCount++;
    if (data.turnCount >= data.roundTime && !data.roundOver) {
      this.resolveRoundByHP(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleBlock(playerId: string, data: FighterState): ActionResult {
    const fighter = data.fighters[playerId];
    if (!fighter || !fighter.alive) {
      return { success: false, error: 'Fighter not active' };
    }
    if (data.roundOver) {
      return { success: false, error: 'Round is over' };
    }

    fighter.isBlocking = true;
    fighter.lastMove = 'block';
    fighter.stamina = Math.min(fighter.maxStamina, fighter.stamina + 10);
    data.turnCount++;

    this.emitEvent('block', playerId, {});
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleNextRound(_playerId: string, data: FighterState): ActionResult {
    if (!data.roundOver || data.matchOver) {
      return { success: false, error: 'Cannot start next round' };
    }

    data.currentRound++;
    data.roundOver = false;
    data.turnCount = 0;

    // Reset all fighters for new round
    for (const fighter of Object.values(data.fighters)) {
      fighter.hp = fighter.maxHp;
      fighter.stamina = fighter.maxStamina;
      fighter.alive = true;
      fighter.isBlocking = false;
      fighter.comboCount = 0;
      fighter.lastMove = null;
    }

    this.emitEvent('round_started', undefined, { round: data.currentRound });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private resolveRoundByHP(data: FighterState): void {
    data.roundOver = true;
    let bestFighter: Fighter | null = null;
    let bestHpPct = -1;

    for (const fighter of Object.values(data.fighters)) {
      if (!fighter.alive) continue;
      const pct = fighter.hp / fighter.maxHp;
      if (pct > bestHpPct) {
        bestHpPct = pct;
        bestFighter = fighter;
      }
    }

    if (bestFighter) {
      bestFighter.roundWins++;
      data.totalScore[bestFighter.id] = (data.totalScore[bestFighter.id] ?? 0) + 100;
      if (bestFighter.roundWins >= data.roundsToWin) {
        data.matchOver = true;
      }
    }
  }

  private spawnWave(data: FighterState): void {
    const waveIndex = Math.min(data.currentWave, WAVE_TEMPLATES.length - 1);
    const template = WAVE_TEMPLATES[waveIndex];
    data.waveEnemies = template.map((e, i) => ({
      id: `enemy_w${data.currentWave}_${i}`,
      name: e.name,
      hp: e.hp,
      maxHp: e.hp,
      atk: e.atk,
      alive: true,
    }));
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FighterState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<FighterState>();

    if (data.mode === 'beat-em-up') {
      // In beat-em-up, player wins if they cleared all waves
      const player = Object.values(data.fighters)[0];
      if (player && player.alive && data.currentWave >= WAVE_TEMPLATES.length) {
        return player.id;
      }
      return null;
    }

    // PvP modes: highest round wins
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
    const data = this.getData<FighterState>();
    return { ...data.totalScore };
  }
}

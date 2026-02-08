/**
 * SideBattlerGame - Side-view party-based combat ("Molt Arena")
 *
 * Lead a party of 4 unique characters against 5 waves of increasingly deadly
 * enemies! Choose classes, manage formations, and use tactical skills to survive.
 * Demonstrates:
 * - Multi-character party management with distinct class roles
 * - Formation system (front/back row) that affects damage dealt and received
 * - Status effects and buff/debuff tracking per character
 * - Wave-based PvE with a final boss encounter
 * - Co-op support (1-2 players sharing party control)
 *
 * WHY side battler works for Moltblox:
 * Side battlers hit the sweet spot between depth and readability. Each turn is
 * a discrete decision point that AI bots can evaluate — "which skill on which
 * target?" — without needing frame-perfect timing. The party system creates
 * emergent combos (Warrior taunts while Mage nukes, Healer keeps everyone alive)
 * that reward understanding synergy over brute optimization. 4 classes with 3
 * skills each means 12 possible actions per turn, which is complex enough to be
 * interesting but small enough that an agent can reason about all options.
 *
 * WHY formation matters:
 * Front/back row is the simplest spatial mechanic that creates meaningful
 * positioning decisions. Front row characters are meatshields — they absorb
 * full damage but deal full melee damage. Back row characters take reduced
 * damage (70%) but deal reduced melee damage (85%). This single axis of
 * positioning creates a natural tank/DPS/support arrangement without needing
 * a full grid system.
 *
 * This is a ~950 line complete game that bots can study, modify, and remix.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CharacterClass = 'warrior' | 'mage' | 'archer' | 'healer';

interface CharacterStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  matk: number;
  mdef: number;
  [key: string]: unknown;
}

/**
 * WHY skills have explicit target modes:
 * "single_enemy", "all_enemies", "single_ally", "self" — each mode tells the
 * UI exactly what targeting picker to show, and tells the AI exactly what
 * options are valid. Explicit modes prevent invalid targeting bugs and let
 * bots enumerate legal moves without guessing.
 */
interface Skill {
  name: string;
  mpCost: number;
  multiplier: number;
  damageType: 'physical' | 'magical' | 'heal' | 'buff';
  target: 'single_enemy' | 'all_enemies' | 'single_ally' | 'self';
  statusEffect?: StatusEffectTemplate;
  healAmount?: number;
  buffStat?: string;
  buffValue?: number;
  description: string;
  [key: string]: unknown;
}

interface StatusEffectTemplate {
  type: 'poison' | 'taunt' | 'def_up' | 'mana_shield';
  value: number;
  duration: number;
  [key: string]: unknown;
}

interface StatusEffect {
  type: 'poison' | 'taunt' | 'def_up' | 'mana_shield';
  value: number;
  turnsRemaining: number;
  sourceId: string;
  [key: string]: unknown;
}

interface PartyCharacter {
  id: string;
  name: string;
  classType: CharacterClass;
  stats: CharacterStats;
  skills: Skill[];
  statusEffects: StatusEffect[];
  row: 'front' | 'back';
  isDefending: boolean;
  alive: boolean;
  owner: string;
  [key: string]: unknown;
}

interface EnemyUnit {
  id: string;
  name: string;
  stats: CharacterStats;
  statusEffects: StatusEffect[];
  isBoss: boolean;
  alive: boolean;
  [key: string]: unknown;
}

interface WaveTemplate {
  enemies: {
    name: string;
    hp: number;
    atk: number;
    def: number;
    spd: number;
    matk: number;
    mdef: number;
    isBoss: boolean;
  }[];
  [key: string]: unknown;
}

interface TurnEntry {
  id: string;
  type: 'party' | 'enemy';
  index: number;
  [key: string]: unknown;
}

interface SideBattlerState {
  party: PartyCharacter[];
  enemies: EnemyUnit[];
  currentWave: number;
  maxWaves: number;
  battlePhase: 'prep' | 'combat' | 'wave_clear' | 'victory' | 'defeat';
  turnOrder: TurnEntry[];
  currentTurnIndex: number;
  selectedTarget: number | null;
  totalTurns: number;
  totalKills: number;
  bossKillCount: number;
  combatLog: string[];
  playerScores: Record<string, number>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Class definitions
// ---------------------------------------------------------------------------

/**
 * WHY exactly 4 classes with these stat spreads:
 * The classic tank/DPS/support/utility quadrangle ensures every party slot
 * matters. Warrior draws fire with Taunt so squishier characters survive.
 * Mage brings burst and AoE but folds if focused. Archer offers consistent
 * single-target damage and DoT pressure. Healer keeps the machine running.
 * Remove any one and the party has a clear weakness — this is what makes
 * team composition feel important rather than arbitrary.
 */
const CLASS_STATS: Record<CharacterClass, CharacterStats> = {
  warrior: { hp: 120, maxHp: 120, mp: 20, maxMp: 20, atk: 18, def: 15, spd: 8, matk: 5, mdef: 8 },
  mage: { hp: 70, maxHp: 70, mp: 50, maxMp: 50, atk: 5, def: 6, spd: 10, matk: 22, mdef: 14 },
  archer: { hp: 85, maxHp: 85, mp: 25, maxMp: 25, atk: 16, def: 8, spd: 14, matk: 8, mdef: 10 },
  healer: { hp: 80, maxHp: 80, mp: 45, maxMp: 45, atk: 6, def: 7, spd: 11, matk: 15, mdef: 16 },
};

/**
 * WHY each class gets exactly 3 skills:
 * 3 skills + basic attack + defend = 5 options per turn. This is the
 * "meaningful choice" sweet spot — enough variety to reward learning, but few
 * enough that a bot can evaluate all options in a reasonable time. Each skill
 * fills a distinct tactical niche within the class fantasy.
 */
const CLASS_SKILLS: Record<CharacterClass, Skill[]> = {
  warrior: [
    {
      name: 'Cleave',
      mpCost: 6,
      multiplier: 1.5,
      damageType: 'physical',
      target: 'single_enemy',
      description: 'A powerful sweeping strike that hits the front enemy hard.',
    },
    {
      name: 'Shield Wall',
      mpCost: 8,
      multiplier: 0,
      damageType: 'buff',
      target: 'self',
      buffStat: 'def',
      buffValue: 8,
      statusEffect: { type: 'def_up', value: 8, duration: 3 },
      description: 'Raise your shield, gaining +8 DEF for 3 turns.',
    },
    {
      name: 'Taunt',
      mpCost: 5,
      multiplier: 0,
      damageType: 'buff',
      target: 'self',
      statusEffect: { type: 'taunt', value: 1, duration: 2 },
      description: 'Force all enemies to target you for 2 turns. The cornerstone of party defense.',
    },
  ],
  mage: [
    {
      name: 'Fireball',
      mpCost: 12,
      multiplier: 2.0,
      damageType: 'magical',
      target: 'single_enemy',
      description: 'Hurl a fireball for 2x MATK damage. Your primary nuke.',
    },
    {
      name: 'Blizzard',
      mpCost: 18,
      multiplier: 1.0,
      damageType: 'magical',
      target: 'all_enemies',
      description:
        'Blast all enemies with ice for 1x MATK. Expensive but devastating against groups.',
    },
    {
      name: 'Mana Shield',
      mpCost: 10,
      multiplier: 0,
      damageType: 'buff',
      target: 'self',
      statusEffect: { type: 'mana_shield', value: 50, duration: 3 },
      description:
        'Converts 50% of incoming damage to MP drain for 3 turns. Survival tool for glass cannons.',
    },
  ],
  archer: [
    {
      name: 'Snipe',
      mpCost: 10,
      multiplier: 2.5,
      damageType: 'physical',
      target: 'single_enemy',
      description: 'A precise shot that ignores enemy DEF entirely. Best single-target finisher.',
    },
    {
      name: 'Rain of Arrows',
      mpCost: 12,
      multiplier: 0.8,
      damageType: 'physical',
      target: 'all_enemies',
      description: 'Shower all enemies with arrows for 0.8x ATK. Great for clearing weak mobs.',
    },
    {
      name: 'Poison Shot',
      mpCost: 8,
      multiplier: 1.0,
      damageType: 'physical',
      target: 'single_enemy',
      statusEffect: { type: 'poison', value: 8, duration: 3 },
      description:
        'Hit for 1x ATK and apply 8 damage/turn poison for 3 turns. Excellent sustained damage.',
    },
  ],
  healer: [
    {
      name: 'Heal',
      mpCost: 10,
      multiplier: 1.5,
      damageType: 'heal',
      target: 'single_ally',
      healAmount: 40,
      description: 'Restore 40 + 1.5x MATK HP to one ally. Your bread-and-butter sustain.',
    },
    {
      name: 'Purify',
      mpCost: 8,
      multiplier: 0,
      damageType: 'heal',
      target: 'single_ally',
      healAmount: 20,
      description:
        'Remove all debuffs from an ally and heal 20 HP. Critical against poison-heavy waves.',
    },
    {
      name: 'Holy Light',
      mpCost: 14,
      multiplier: 1.8,
      damageType: 'magical',
      target: 'single_enemy',
      healAmount: 15,
      description:
        'Smite an enemy for 1.8x MATK and heal self for 15 HP. Offensive healing hybrid.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Wave definitions
// ---------------------------------------------------------------------------

/**
 * WHY 5 waves with this specific escalation:
 * 5 waves is the sweet spot for a single session — short enough to complete
 * in one sitting, long enough to develop a real strategy arc. The progression
 * follows a classic difficulty curve: Waves 1-2 teach mechanics with forgiving
 * enemies, Wave 3 tests basic competence, Wave 4 punishes poor composition,
 * and Wave 5 (boss) is the climactic test of everything learned.
 *
 * WHY enemy variety increases per wave:
 * Wave 1 has homogeneous enemies (2 slimes) so players learn the basics.
 * Later waves mix melee and ranged enemies, forcing players to prioritize
 * targets — "Do I kill the mage first or the warrior?" This target priority
 * question is the core tactical decision in side battlers.
 */
const WAVE_TEMPLATES: WaveTemplate[] = [
  {
    enemies: [
      { name: 'Slime', hp: 40, atk: 8, def: 4, spd: 5, matk: 0, mdef: 3, isBoss: false },
      { name: 'Slime', hp: 40, atk: 8, def: 4, spd: 5, matk: 0, mdef: 3, isBoss: false },
    ],
  },
  {
    enemies: [
      { name: 'Goblin', hp: 55, atk: 12, def: 6, spd: 7, matk: 0, mdef: 5, isBoss: false },
      { name: 'Goblin', hp: 55, atk: 12, def: 6, spd: 7, matk: 0, mdef: 5, isBoss: false },
      { name: 'Goblin Archer', hp: 45, atk: 10, def: 4, spd: 9, matk: 0, mdef: 6, isBoss: false },
    ],
  },
  {
    enemies: [
      {
        name: 'Skeleton Warrior',
        hp: 70,
        atk: 15,
        def: 10,
        spd: 8,
        matk: 0,
        mdef: 4,
        isBoss: false,
      },
      {
        name: 'Skeleton Warrior',
        hp: 70,
        atk: 15,
        def: 10,
        spd: 8,
        matk: 0,
        mdef: 4,
        isBoss: false,
      },
      { name: 'Skeleton Mage', hp: 50, atk: 8, def: 5, spd: 11, matk: 16, mdef: 10, isBoss: false },
    ],
  },
  {
    enemies: [
      { name: 'Dark Knight', hp: 120, atk: 20, def: 16, spd: 6, matk: 0, mdef: 8, isBoss: false },
      {
        name: 'Shadow Assassin',
        hp: 65,
        atk: 18,
        def: 6,
        spd: 15,
        matk: 0,
        mdef: 5,
        isBoss: false,
      },
      {
        name: 'Shadow Assassin',
        hp: 65,
        atk: 18,
        def: 6,
        spd: 15,
        matk: 0,
        mdef: 5,
        isBoss: false,
      },
    ],
  },
  {
    enemies: [
      {
        name: 'Ancient Dragon',
        hp: 300,
        atk: 28,
        def: 18,
        spd: 10,
        matk: 22,
        mdef: 14,
        isBoss: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Damage multiplier for back-row characters receiving physical attacks */
const BACK_ROW_DAMAGE_TAKEN = 0.7;
/** Damage multiplier for back-row characters dealing melee (physical) attacks */
const BACK_ROW_MELEE_PENALTY = 0.85;
/** Damage reduction when defending */
const DEFEND_DAMAGE_REDUCTION = 0.5;
/** MP restored when defending */
const DEFEND_MP_RESTORE = 3;

// ---------------------------------------------------------------------------
// SideBattlerGame
// ---------------------------------------------------------------------------

export class SideBattlerGame extends BaseGame {
  readonly name = 'Molt Arena';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Set up the party and initial game state.
   *
   * WHY a fixed party of Warrior/Mage/Archer/Healer:
   * A balanced party lets players experience every class interaction without
   * needing a drafting phase. This keeps the game focused on tactical combat
   * rather than meta-game composition. Bots wanting to experiment with
   * compositions can fork this template and add a draft action.
   *
   * WHY front/back row assignment is Warrior + Archer front, Mage + Healer back:
   * Actually it's Warrior in front (index 0-1) and Mage/Archer/Healer in back
   * (index 2-3). The Warrior is the natural frontliner due to highest HP and DEF.
   * In 2-player co-op, each player controls 2 characters.
   */
  protected initializeState(playerIds: string[]): SideBattlerState {
    const party: PartyCharacter[] = [];
    const classes: CharacterClass[] = ['warrior', 'mage', 'archer', 'healer'];

    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      const stats = { ...CLASS_STATS[cls] };
      // In co-op, player 1 gets characters 0-1, player 2 gets 2-3
      // In solo, player 1 gets all 4
      const owner = playerIds.length === 2 ? playerIds[i < 2 ? 0 : 1] : playerIds[0];

      party.push({
        id: `char_${i}`,
        name: this.getCharacterName(cls),
        classType: cls,
        stats,
        skills: CLASS_SKILLS[cls].map((s) => ({ ...s })),
        statusEffects: [],
        row: i <= 1 ? 'front' : 'back',
        isDefending: false,
        alive: true,
        owner,
      });
    }

    const playerScores: Record<string, number> = {};
    for (const pid of playerIds) {
      playerScores[pid] = 0;
    }

    return {
      party,
      enemies: [],
      currentWave: 0,
      maxWaves: 5,
      battlePhase: 'prep' as const,
      turnOrder: [],
      currentTurnIndex: 0,
      selectedTarget: null,
      totalTurns: 0,
      totalKills: 0,
      bossKillCount: 0,
      combatLog: [],
      playerScores,
    };
  }

  private getCharacterName(cls: CharacterClass): string {
    switch (cls) {
      case 'warrior':
        return 'Bron the Warrior';
      case 'mage':
        return 'Lyra the Mage';
      case 'archer':
        return 'Kael the Archer';
      case 'healer':
        return 'Sera the Healer';
    }
  }

  // -----------------------------------------------------------------------
  // Action processing
  // -----------------------------------------------------------------------

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SideBattlerState>();

    switch (action.type) {
      case 'start_wave':
        return this.handleStartWave(playerId, data);

      case 'select_target':
        return this.handleSelectTarget(playerId, action, data);

      case 'attack':
        return this.handleAttack(playerId, data);

      case 'defend':
        return this.handleDefend(playerId, data);

      case 'use_skill':
        return this.handleUseSkill(playerId, action, data);

      case 'auto_tick':
        return this.handleAutoTick(playerId, data);

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  // -----------------------------------------------------------------------
  // start_wave
  // -----------------------------------------------------------------------

  /**
   * WHY waves are player-initiated:
   * Letting the player choose when to start the next wave gives them a breather
   * to review party status, plan strategy, and mentally prepare. In games with
   * auto-advancing waves, players feel rushed and frustrated. This pacing control
   * is especially important for AI agents that need processing time between waves.
   */
  private handleStartWave(playerId: string, data: SideBattlerState): ActionResult {
    if (data.battlePhase === 'combat') {
      return { success: false, error: 'Wave already in progress' };
    }
    if (data.currentWave >= data.maxWaves) {
      return { success: false, error: 'All waves completed' };
    }
    if (!data.party.some((c) => c.alive)) {
      return { success: false, error: 'All party members have fallen' };
    }

    data.currentWave++;
    const waveIndex = data.currentWave - 1;
    const template = WAVE_TEMPLATES[waveIndex];
    const scale = 1 + (data.currentWave - 1) * 0.1;

    // Spawn enemies from template with scaling
    data.enemies = template.enemies.map((e, i) => ({
      id: `enemy_w${data.currentWave}_${i}`,
      name: e.name,
      stats: {
        hp: Math.floor(e.hp * scale),
        maxHp: Math.floor(e.hp * scale),
        mp: 0,
        maxMp: 0,
        atk: Math.floor(e.atk * scale),
        def: Math.floor(e.def * scale),
        spd: Math.floor(e.spd * scale),
        matk: Math.floor(e.matk * scale),
        mdef: Math.floor(e.mdef * scale),
      },
      statusEffects: [],
      isBoss: e.isBoss,
      alive: true,
    }));

    data.battlePhase = 'combat';
    data.selectedTarget = null;

    // Reset defending state for all characters
    for (const char of data.party) {
      char.isDefending = false;
    }

    // Build turn order based on SPD
    this.buildTurnOrder(data);

    this.emitEvent('wave_started', playerId, {
      wave: data.currentWave,
      enemyCount: data.enemies.length,
      enemyNames: data.enemies.map((e) => e.name),
    });

    data.combatLog.push(`--- Wave ${data.currentWave} begins! ---`);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  // -----------------------------------------------------------------------
  // select_target
  // -----------------------------------------------------------------------

  private handleSelectTarget(
    playerId: string,
    action: GameAction,
    data: SideBattlerState,
  ): ActionResult {
    const targetIndex = Number(action.payload.targetIndex);
    if (isNaN(targetIndex) || targetIndex < 0) {
      return { success: false, error: 'Invalid target index' };
    }

    data.selectedTarget = targetIndex;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  // -----------------------------------------------------------------------
  // attack (basic)
  // -----------------------------------------------------------------------

  /**
   * WHY basic attack has no MP cost:
   * The basic attack is the "always available" fallback action. When a character
   * runs out of MP, they can still contribute. This prevents the feel-bad moment
   * of a character being completely useless, and creates a natural rhythm:
   * use skills when MP is available, fall back to basics when it runs out.
   */
  private handleAttack(playerId: string, data: SideBattlerState): ActionResult {
    if (data.battlePhase !== 'combat') {
      return { success: false, error: 'No active wave' };
    }

    const char = this.getCurrentCharacter(data);
    if (!char || !char.alive) {
      return { success: false, error: 'No active character for this turn' };
    }
    if (char.owner !== playerId) {
      return { success: false, error: "Not your character's turn" };
    }

    const targetIndex = data.selectedTarget ?? 0;
    const aliveEnemies = data.enemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies to attack' };
    }
    const target = aliveEnemies[Math.min(targetIndex, aliveEnemies.length - 1)];

    // Physical damage: max(1, ATK * 1.0 - DEF/2) with formation modifiers
    const rowMultiplier = char.row === 'back' ? BACK_ROW_MELEE_PENALTY : 1.0;
    const damage = Math.max(
      1,
      Math.floor(char.stats.atk * 1.0 * rowMultiplier - target.stats.def / 2),
    );

    target.stats.hp -= damage;
    data.combatLog.push(`${char.name} attacks ${target.name} for ${damage} damage`);
    this.emitEvent('attack', playerId, { character: char.id, target: target.id, damage });

    if (target.stats.hp <= 0) {
      this.handleEnemyDeath(target, data, playerId);
    }

    char.isDefending = false;
    data.totalTurns++;
    this.advanceTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  // -----------------------------------------------------------------------
  // defend
  // -----------------------------------------------------------------------

  /**
   * WHY defending restores MP:
   * Defend creates an interesting risk/reward trade-off: skip your offensive
   * turn now to take less damage AND recover a bit of MP. This gives players a
   * reason to defend beyond pure survival — it's a resource investment. A healer
   * who is low on MP can defend for a turn to recharge, creating strategic depth
   * around timing and resource management.
   */
  private handleDefend(playerId: string, data: SideBattlerState): ActionResult {
    if (data.battlePhase !== 'combat') {
      return { success: false, error: 'No active wave' };
    }

    const char = this.getCurrentCharacter(data);
    if (!char || !char.alive) {
      return { success: false, error: 'No active character for this turn' };
    }
    if (char.owner !== playerId) {
      return { success: false, error: "Not your character's turn" };
    }

    char.isDefending = true;
    char.stats.mp = Math.min(char.stats.maxMp, char.stats.mp + DEFEND_MP_RESTORE);
    data.combatLog.push(`${char.name} defends and recovers ${DEFEND_MP_RESTORE} MP`);
    this.emitEvent('defend', playerId, { character: char.id });

    data.totalTurns++;
    this.advanceTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  // -----------------------------------------------------------------------
  // use_skill
  // -----------------------------------------------------------------------

  /**
   * WHY skills are the heart of the game:
   * Basic attacks are reliable but boring. Skills are where the real decisions
   * live. Each skill forces a cost-benefit analysis: Fireball does massive
   * single-target damage but costs 12 MP — is it worth using on a half-dead
   * Slime? Rain of Arrows hits everything but at reduced damage — is AoE
   * better than focused fire here? These micro-decisions per turn are what
   * make combat feel engaging rather than automatic.
   */
  private handleUseSkill(
    playerId: string,
    action: GameAction,
    data: SideBattlerState,
  ): ActionResult {
    if (data.battlePhase !== 'combat') {
      return { success: false, error: 'No active wave' };
    }

    const char = this.getCurrentCharacter(data);
    if (!char || !char.alive) {
      return { success: false, error: 'No active character for this turn' };
    }
    if (char.owner !== playerId) {
      return { success: false, error: "Not your character's turn" };
    }

    const skillIndex = Number(action.payload.skillIndex);
    if (isNaN(skillIndex) || skillIndex < 0 || skillIndex >= char.skills.length) {
      return { success: false, error: 'Invalid skill index' };
    }

    const skill = char.skills[skillIndex];
    if (char.stats.mp < skill.mpCost) {
      return {
        success: false,
        error: `Not enough MP (need ${skill.mpCost}, have ${char.stats.mp})`,
      };
    }

    char.stats.mp -= skill.mpCost;

    // ---- Resolve skill by damage type ----

    if (skill.damageType === 'heal') {
      this.resolveHealSkill(char, skill, action, data, playerId);
    } else if (skill.damageType === 'buff') {
      this.resolveBuffSkill(char, skill, data);
    } else if (skill.target === 'all_enemies') {
      this.resolveAoEDamageSkill(char, skill, data, playerId);
    } else {
      this.resolveSingleDamageSkill(char, skill, action, data, playerId);
    }

    char.isDefending = false;
    data.totalTurns++;
    this.advanceTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private resolveHealSkill(
    char: PartyCharacter,
    skill: Skill,
    action: GameAction,
    data: SideBattlerState,
    playerId: string,
  ): void {
    const targetIndex = Number(action.payload.targetIndex ?? 0);
    const aliveAllies = data.party.filter((c) => c.alive);
    const target = aliveAllies[Math.min(targetIndex, aliveAllies.length - 1)];

    if (skill.name === 'Purify') {
      // Remove all debuffs (poison etc.) and heal a flat amount
      const debuffsRemoved = target.statusEffects.filter((e) => e.type === 'poison').length;
      target.statusEffects = target.statusEffects.filter((e) => e.type !== 'poison');
      target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + (skill.healAmount ?? 20));
      data.combatLog.push(
        `${char.name} purifies ${target.name}, removing ${debuffsRemoved} debuff(s) and healing ${skill.healAmount ?? 20} HP`,
      );
    } else if (skill.name === 'Holy Light') {
      // Damage an enemy AND heal self
      const aliveEnemies = data.enemies.filter((e) => e.alive);
      if (aliveEnemies.length > 0) {
        const enemyTarget =
          aliveEnemies[Math.min(Number(action.payload.targetIndex ?? 0), aliveEnemies.length - 1)];
        const damage = Math.max(
          1,
          Math.floor(char.stats.matk * skill.multiplier - enemyTarget.stats.mdef / 3),
        );
        enemyTarget.stats.hp -= damage;
        char.stats.hp = Math.min(char.stats.maxHp, char.stats.hp + (skill.healAmount ?? 15));
        data.combatLog.push(
          `${char.name} casts Holy Light on ${enemyTarget.name} for ${damage} damage and heals self for ${skill.healAmount ?? 15} HP`,
        );
        this.emitEvent('skill_used', playerId, {
          character: char.id,
          skill: skill.name,
          target: enemyTarget.id,
          damage,
        });
        if (enemyTarget.stats.hp <= 0) {
          this.handleEnemyDeath(enemyTarget, data, playerId);
        }
      }
      return;
    } else {
      // Standard Heal: flat + MATK scaling
      const healAmount = (skill.healAmount ?? 40) + Math.floor(char.stats.matk * skill.multiplier);
      target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
      data.combatLog.push(`${char.name} heals ${target.name} for ${healAmount} HP`);
    }

    this.emitEvent('skill_used', playerId, {
      character: char.id,
      skill: skill.name,
      target: target?.id,
    });
  }

  private resolveBuffSkill(char: PartyCharacter, skill: Skill, data: SideBattlerState): void {
    if (skill.statusEffect) {
      char.statusEffects.push({
        type: skill.statusEffect.type,
        value: skill.statusEffect.value,
        turnsRemaining: skill.statusEffect.duration,
        sourceId: char.id,
      });
    }
    data.combatLog.push(`${char.name} uses ${skill.name}`);
  }

  /**
   * WHY AoE skills exist:
   * Without AoE, optimal play is always "focus-fire the weakest enemy." AoE
   * introduces a strategic fork: single-target is better against one tough enemy,
   * but AoE is more efficient against multiple weak ones. This simple choice
   * dramatically increases decision complexity and prevents autopilot play.
   */
  private resolveAoEDamageSkill(
    char: PartyCharacter,
    skill: Skill,
    data: SideBattlerState,
    playerId: string,
  ): void {
    const aliveEnemies = data.enemies.filter((e) => e.alive);
    let totalDamage = 0;

    for (const enemy of aliveEnemies) {
      let damage: number;
      if (skill.damageType === 'magical') {
        damage = Math.max(1, Math.floor(char.stats.matk * skill.multiplier - enemy.stats.mdef / 3));
      } else {
        const rowMultiplier = char.row === 'back' ? BACK_ROW_MELEE_PENALTY : 1.0;
        damage = Math.max(
          1,
          Math.floor(char.stats.atk * skill.multiplier * rowMultiplier - enemy.stats.def / 2),
        );
      }
      enemy.stats.hp -= damage;
      totalDamage += damage;

      if (enemy.stats.hp <= 0) {
        this.handleEnemyDeath(enemy, data, playerId);
      }
    }

    data.combatLog.push(
      `${char.name} uses ${skill.name}, hitting ${aliveEnemies.length} enemies for ${totalDamage} total damage`,
    );
    this.emitEvent('skill_used', playerId, {
      character: char.id,
      skill: skill.name,
      totalDamage,
      targetsHit: aliveEnemies.length,
    });
  }

  private resolveSingleDamageSkill(
    char: PartyCharacter,
    skill: Skill,
    action: GameAction,
    data: SideBattlerState,
    playerId: string,
  ): void {
    const targetIndex = data.selectedTarget ?? Number(action.payload.targetIndex ?? 0);
    const aliveEnemies = data.enemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) return;

    const target = aliveEnemies[Math.min(targetIndex, aliveEnemies.length - 1)];
    let damage: number;

    if (skill.name === 'Snipe') {
      // Snipe ignores DEF entirely — this is its defining trait
      const rowMultiplier = char.row === 'back' ? BACK_ROW_MELEE_PENALTY : 1.0;
      damage = Math.max(1, Math.floor(char.stats.atk * skill.multiplier * rowMultiplier));
    } else if (skill.damageType === 'magical') {
      // Magical damage: MATK * multiplier - MDEF/3, not affected by formation
      damage = Math.max(1, Math.floor(char.stats.matk * skill.multiplier - target.stats.mdef / 3));
    } else {
      // Physical damage: ATK * multiplier - DEF/2, formation modifiers apply
      const rowMultiplier = char.row === 'back' ? BACK_ROW_MELEE_PENALTY : 1.0;
      damage = Math.max(
        1,
        Math.floor(char.stats.atk * skill.multiplier * rowMultiplier - target.stats.def / 2),
      );
    }

    target.stats.hp -= damage;

    // Self-heal component (e.g., Holy Light heals the caster)
    if (skill.healAmount) {
      char.stats.hp = Math.min(char.stats.maxHp, char.stats.hp + skill.healAmount);
      data.combatLog.push(
        `${char.name} uses ${skill.name} on ${target.name} for ${damage} damage and heals self for ${skill.healAmount} HP`,
      );
    } else {
      data.combatLog.push(`${char.name} uses ${skill.name} on ${target.name} for ${damage} damage`);
    }

    this.emitEvent('skill_used', playerId, {
      character: char.id,
      skill: skill.name,
      target: target.id,
      damage,
    });

    // Apply status effect if skill has one (e.g., Poison Shot)
    if (skill.statusEffect && target.stats.hp > 0) {
      target.statusEffects.push({
        type: skill.statusEffect.type,
        value: skill.statusEffect.value,
        turnsRemaining: skill.statusEffect.duration,
        sourceId: char.id,
      });
      data.combatLog.push(`${target.name} is afflicted with ${skill.statusEffect.type}!`);
    }

    if (target.stats.hp <= 0) {
      this.handleEnemyDeath(target, data, playerId);
    }
  }

  // -----------------------------------------------------------------------
  // auto_tick — enemy AI turns
  // -----------------------------------------------------------------------

  /**
   * WHY enemy AI is simple (target lowest HP%, boss uses AoE):
   * Complex enemy AI makes games feel unfair and opaque. Simple, predictable
   * patterns let players plan around enemy behavior. "The enemy always attacks
   * whoever has the lowest HP percentage" is a rule players can learn and
   * exploit (via Taunt, or by keeping everyone healthy). The boss's AoE attack
   * is the one exception — it forces the party to have a healer and creates
   * a DPS race that builds tension.
   */
  private handleAutoTick(playerId: string, data: SideBattlerState): ActionResult {
    if (data.battlePhase !== 'combat') {
      return { success: false, error: 'No active wave' };
    }

    // Process all consecutive enemy turns
    let enemyActed = false;
    while (data.currentTurnIndex < data.turnOrder.length) {
      const entry = data.turnOrder[data.currentTurnIndex];
      if (!entry) break;

      if (entry.type === 'party') {
        // It's a player character's turn — stop processing enemy turns
        const char = data.party.find((c) => c.id === entry.id && c.alive);
        if (char) break;
        // Dead character — skip
        data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
        continue;
      }

      const enemy = data.enemies.find((e) => e.id === entry.id && e.alive);
      if (!enemy) {
        // Dead enemy — skip
        data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
        continue;
      }

      // This is an enemy's turn
      this.processEnemyTurn(enemy, data);
      enemyActed = true;
      data.totalTurns++;

      // Check if all party members are dead
      if (data.party.every((c) => !c.alive)) {
        data.battlePhase = 'defeat';
        data.combatLog.push('All party members have fallen!');
        this.emitEvent('party_wiped', undefined, { wave: data.currentWave });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;

      // If we've looped back to beginning, process status effects for the round
      if (data.currentTurnIndex === 0) {
        this.processRoundEnd(data);
        // Check for wave clear after status effects (poison might kill enemies)
        if (data.enemies.every((e) => !e.alive)) {
          this.handleWaveClear(data, playerId);
          break;
        }
        // Rebuild turn order for new round (skip dead units)
        this.buildTurnOrder(data);
      }
    }

    if (!enemyActed && data.battlePhase === 'combat') {
      return { success: false, error: 'No enemy turn to process' };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  /**
   * WHY Taunt is the most important status effect:
   * Taunt converts a damage-sponge Warrior into a true protector. Without it,
   * enemies would always focus the squishiest target (Mage/Healer), making
   * the Warrior feel irrelevant. Taunt creates a mini-game: time it right and
   * your Warrior absorbs hits meant for your glass cannons. Let it drop and
   * the Mage gets one-shot. This creates rhythmic tension across turns.
   */
  private processEnemyTurn(enemy: EnemyUnit, data: SideBattlerState): void {
    const aliveParty = data.party.filter((c) => c.alive);
    if (aliveParty.length === 0) return;

    // Boss dragon attacks all party members
    if (enemy.isBoss) {
      this.processBossAttack(enemy, data);
      return;
    }

    // Check for taunt — must target the taunting character
    const taunter = aliveParty.find((c) =>
      c.statusEffects.some((e) => e.type === 'taunt' && e.turnsRemaining > 0),
    );

    let target: PartyCharacter;
    if (taunter) {
      target = taunter;
    } else {
      // Target lowest HP percentage character
      target = aliveParty.reduce((lowest, c) => {
        const lowestPct = lowest.stats.hp / lowest.stats.maxHp;
        const currentPct = c.stats.hp / c.stats.maxHp;
        return currentPct < lowestPct ? c : lowest;
      }, aliveParty[0]);
    }

    let damage = Math.max(1, enemy.stats.atk - Math.floor(target.stats.def / 2));

    // Formation: back row takes reduced physical damage
    if (target.row === 'back') {
      damage = Math.floor(damage * BACK_ROW_DAMAGE_TAKEN);
    }

    // Defending: 50% damage reduction
    if (target.isDefending) {
      damage = Math.floor(damage * DEFEND_DAMAGE_REDUCTION);
    }

    // Mana Shield: convert 50% of damage to MP drain
    const manaShield = target.statusEffects.find((e) => e.type === 'mana_shield');
    if (manaShield) {
      const absorbed = Math.floor(damage * (manaShield.value / 100));
      const mpDrain = Math.min(target.stats.mp, absorbed);
      target.stats.mp -= mpDrain;
      damage -= mpDrain;
      if (target.stats.mp <= 0) {
        // Mana shield breaks when MP runs out
        target.statusEffects = target.statusEffects.filter((e) => e.type !== 'mana_shield');
        data.combatLog.push(`${target.name}'s Mana Shield shatters!`);
      }
    }

    // DEF Up buff
    const defUp = target.statusEffects.find((e) => e.type === 'def_up');
    if (defUp) {
      damage = Math.max(1, damage - Math.floor(defUp.value / 2));
    }

    damage = Math.max(1, damage);
    target.stats.hp -= damage;
    data.combatLog.push(`${enemy.name} attacks ${target.name} for ${damage} damage`);

    if (target.stats.hp <= 0) {
      target.alive = false;
      target.stats.hp = 0;
      data.combatLog.push(`${target.name} has fallen!`);
      this.emitEvent('character_defeated', target.owner, {
        character: target.id,
        killedBy: enemy.id,
      });
    }
  }

  /**
   * WHY the boss uses AoE instead of single-target:
   * A boss that targets one character is just a harder version of a regular
   * enemy — the same strategy works, just slower. An AoE boss fundamentally
   * changes the tactical equation: now the Healer can't keep one tank alive,
   * they need to manage party-wide HP. This forces different skill usage
   * patterns and makes the final encounter feel genuinely different, not just
   * numerically harder.
   */
  private processBossAttack(boss: EnemyUnit, data: SideBattlerState): void {
    const aliveParty = data.party.filter((c) => c.alive);

    // Boss hits all party members with a mix of physical and magical damage
    for (const target of aliveParty) {
      // Physical component
      let physDmg = Math.max(1, Math.floor(boss.stats.atk * 0.6 - target.stats.def / 2));
      // Magical component
      const magDmg = Math.max(1, Math.floor(boss.stats.matk * 0.6 - target.stats.mdef / 3));

      if (target.row === 'back') {
        physDmg = Math.floor(physDmg * BACK_ROW_DAMAGE_TAKEN);
      }

      let totalDmg = physDmg + magDmg;

      if (target.isDefending) {
        totalDmg = Math.floor(totalDmg * DEFEND_DAMAGE_REDUCTION);
      }

      // Mana Shield
      const manaShield = target.statusEffects.find((e) => e.type === 'mana_shield');
      if (manaShield) {
        const absorbed = Math.floor(totalDmg * (manaShield.value / 100));
        const mpDrain = Math.min(target.stats.mp, absorbed);
        target.stats.mp -= mpDrain;
        totalDmg -= mpDrain;
        if (target.stats.mp <= 0) {
          target.statusEffects = target.statusEffects.filter((e) => e.type !== 'mana_shield');
          data.combatLog.push(`${target.name}'s Mana Shield shatters!`);
        }
      }

      // DEF Up
      const defUp = target.statusEffects.find((e) => e.type === 'def_up');
      if (defUp) {
        totalDmg = Math.max(1, totalDmg - Math.floor(defUp.value / 2));
      }

      totalDmg = Math.max(1, totalDmg);
      target.stats.hp -= totalDmg;

      if (target.stats.hp <= 0) {
        target.alive = false;
        target.stats.hp = 0;
        data.combatLog.push(`${target.name} has fallen to the dragon's breath!`);
        this.emitEvent('character_defeated', target.owner, {
          character: target.id,
          killedBy: boss.id,
        });
      }
    }

    const totalPartyDamage = aliveParty.reduce(
      (sum, c) => sum + Math.max(0, c.stats.maxHp - Math.max(0, c.stats.hp)),
      0,
    );
    data.combatLog.push(
      `${boss.name} unleashes a devastating attack on the entire party! (${totalPartyDamage} total damage)`,
    );
  }

  // -----------------------------------------------------------------------
  // Turn & round management
  // -----------------------------------------------------------------------

  /**
   * WHY SPD determines turn order (not random):
   * Deterministic turn order lets players plan ahead. If you know the Archer
   * always acts before the Skeleton Mage, you can use Poison Shot to finish
   * it off before it casts. Random initiative would make planning impossible
   * and reduce combat to reactive guessing. Determinism rewards game knowledge.
   */
  private buildTurnOrder(data: SideBattlerState): void {
    const entries: (TurnEntry & { spd: number })[] = [];

    for (let i = 0; i < data.party.length; i++) {
      const c = data.party[i];
      if (c.alive) {
        entries.push({ id: c.id, type: 'party', index: i, spd: c.stats.spd });
      }
    }
    for (let i = 0; i < data.enemies.length; i++) {
      const e = data.enemies[i];
      if (e.alive) {
        entries.push({ id: e.id, type: 'enemy', index: i, spd: e.stats.spd });
      }
    }

    // Sort by SPD descending; ties broken by ID for determinism
    entries.sort((a, b) => b.spd - a.spd || a.id.localeCompare(b.id));
    data.turnOrder = entries.map((e) => ({ id: e.id, type: e.type, index: e.index }));
    data.currentTurnIndex = 0;
  }

  private getCurrentCharacter(data: SideBattlerState): PartyCharacter | null {
    if (data.turnOrder.length === 0) return null;
    const entry = data.turnOrder[data.currentTurnIndex];
    if (!entry || entry.type !== 'party') return null;
    return data.party.find((c) => c.id === entry.id && c.alive) ?? null;
  }

  /**
   * Advance to the next living unit in turn order.
   * After each player action, we advance the index. If the next unit is an
   * enemy, the client should call auto_tick to let the enemy act.
   */
  private advanceTurn(data: SideBattlerState): void {
    // Check if all enemies are dead (wave clear)
    if (data.enemies.every((e) => !e.alive)) {
      this.handleWaveClear(data, this.getPlayers()[0]);
      return;
    }

    data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;

    // Skip dead units
    let loopGuard = data.turnOrder.length;
    while (loopGuard > 0) {
      const turnEntry = data.turnOrder[data.currentTurnIndex];
      if (!turnEntry) break;
      const char =
        turnEntry.type === 'party' ? data.party.find((c) => c.id === turnEntry.id) : null;
      const enemy =
        turnEntry.type === 'enemy' ? data.enemies.find((e) => e.id === turnEntry.id) : null;

      if ((char && char.alive) || (enemy && enemy.alive)) {
        break;
      }

      data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
      loopGuard--;
    }

    // If we've looped back to the start, it's a new round
    if (data.currentTurnIndex === 0) {
      this.processRoundEnd(data);
      // Rebuild turn order (in case units died mid-round)
      this.buildTurnOrder(data);
    }
  }

  /**
   * WHY status effects tick at round end (not on each turn):
   * Per-round ticking is simpler to understand and balance. If poison ticked
   * on each character's turn, fast characters would effectively take more
   * poison damage per round than slow ones, creating unintuitive interactions.
   * Round-end ticking keeps effects predictable and fair.
   */
  private processRoundEnd(data: SideBattlerState): void {
    // Process status effects on party members
    for (const char of data.party) {
      if (!char.alive) continue;

      char.isDefending = false;

      for (let i = char.statusEffects.length - 1; i >= 0; i--) {
        const effect = char.statusEffects[i];

        if (effect.type === 'poison') {
          char.stats.hp -= effect.value;
          data.combatLog.push(`${char.name} takes ${effect.value} poison damage`);
          if (char.stats.hp <= 0) {
            char.alive = false;
            char.stats.hp = 0;
            data.combatLog.push(`${char.name} succumbed to poison!`);
          }
        }

        effect.turnsRemaining--;
        if (effect.turnsRemaining <= 0) {
          char.statusEffects.splice(i, 1);
        }
      }
    }

    // Process status effects on enemies
    for (const enemy of data.enemies) {
      if (!enemy.alive) continue;

      for (let i = enemy.statusEffects.length - 1; i >= 0; i--) {
        const effect = enemy.statusEffects[i];

        if (effect.type === 'poison') {
          enemy.stats.hp -= effect.value;
          data.combatLog.push(`${enemy.name} takes ${effect.value} poison damage`);
          if (enemy.stats.hp <= 0) {
            this.handleEnemyDeath(enemy, data, this.getPlayers()[0]);
          }
        }

        effect.turnsRemaining--;
        if (effect.turnsRemaining <= 0) {
          enemy.statusEffects.splice(i, 1);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Enemy death & wave clear
  // -----------------------------------------------------------------------

  private handleEnemyDeath(enemy: EnemyUnit, data: SideBattlerState, playerId: string): void {
    enemy.alive = false;
    enemy.stats.hp = 0;
    data.totalKills++;

    const killScore = enemy.isBoss ? 50 : 10;
    // Award score to all players equally
    for (const pid of this.getPlayers()) {
      data.playerScores[pid] = (data.playerScores[pid] ?? 0) + killScore;
    }

    if (enemy.isBoss) {
      data.bossKillCount++;
      data.combatLog.push(`${enemy.name} has been slain! (+${killScore} score)`);
      this.emitEvent('boss_killed', playerId, { enemy: enemy.id, name: enemy.name });
    } else {
      data.combatLog.push(`${enemy.name} defeated! (+${killScore} score)`);
      this.emitEvent('enemy_killed', playerId, { enemy: enemy.id, name: enemy.name });
    }
  }

  private handleWaveClear(data: SideBattlerState, playerId: string): void {
    data.battlePhase = 'wave_clear';
    data.combatLog.push(`--- Wave ${data.currentWave} cleared! ---`);
    this.emitEvent('wave_cleared', playerId, { wave: data.currentWave });

    // Check for victory
    if (data.currentWave >= data.maxWaves) {
      data.battlePhase = 'victory';
      data.combatLog.push('All waves defeated! Victory!');
      this.emitEvent('victory', undefined, { waves: data.currentWave });
    }
  }

  // -----------------------------------------------------------------------
  // Fog of war
  // -----------------------------------------------------------------------

  /**
   * WHY hide enemy turn calculation details:
   * Showing the exact SPD-based turn order for enemies would let bots
   * perfectly predict every enemy action. Hiding this creates uncertainty
   * that makes Taunt and defensive play more valuable — you can't perfectly
   * optimize if you don't know the exact enemy turn sequence. Players can
   * still see enemy SPD stats to make educated guesses, preserving skill
   * expression without enabling perfect play.
   */
  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const fullState = this.getState();
    const data = fullState.data as SideBattlerState;

    // Hide enemy status effect source IDs (don't reveal internal character IDs)
    const sanitizedEnemies = data.enemies.map((e) => ({
      ...e,
      statusEffects: e.statusEffects.map((se) => ({
        ...se,
        sourceId: 'unknown',
      })),
    }));

    // Hide exact turn order — only show whose turn it currently is
    const currentTurnId = data.turnOrder[data.currentTurnIndex] ?? null;

    return {
      ...fullState,
      data: {
        ...data,
        enemies: sanitizedEnemies,
        turnOrder: [currentTurnId].filter(Boolean),
      },
    };
  }

  // -----------------------------------------------------------------------
  // Game over & scoring
  // -----------------------------------------------------------------------

  protected checkGameOver(): boolean {
    const data = this.getData<SideBattlerState>();
    return data.battlePhase === 'victory' || data.battlePhase === 'defeat';
  }

  /**
   * WHY both players can "win" in co-op:
   * Cooperative games feel bad when only one player is declared the winner.
   * If both players cleared wave 5 together, they both won. The score
   * difference just determines bragging rights / leaderboard position, not
   * whether you "won" or "lost." This encourages cooperative rather than
   * competitive behavior between co-op partners.
   */
  protected determineWinner(): string | null {
    const data = this.getData<SideBattlerState>();

    // If party wiped, no winner
    if (data.battlePhase === 'defeat') {
      return null;
    }

    // In victory, the player with the highest score wins
    let bestPlayer: string | null = null;
    let bestScore = -1;
    for (const pid of this.getPlayers()) {
      const score = data.playerScores[pid] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = pid;
      }
    }
    return bestPlayer;
  }

  /**
   * WHY scoring combines multiple factors:
   * Kill score rewards engagement (you contributed to fights). Speed bonus
   * rewards efficiency (you didn't waste turns). Survival bonus rewards
   * party management (you kept people alive). HP efficiency rewards clean
   * play (you ended healthy). Multi-factor scoring means different play
   * styles can compete — a cautious player who keeps everyone alive can
   * outscore an aggressive player who burns through the waves faster.
   */
  protected calculateScores(): Record<string, number> {
    const data = this.getData<SideBattlerState>();
    const scores: Record<string, number> = {};

    for (const pid of this.getPlayers()) {
      let score = data.playerScores[pid] ?? 0;

      // Speed bonus: fewer total turns = higher bonus (min 0)
      const speedBonus = Math.max(0, (100 - data.totalTurns) * 5);
      score += speedBonus;

      // Survival bonus: 100 per alive character
      const aliveCount = data.party.filter((c) => c.alive).length;
      score += aliveCount * 100;

      // HP efficiency: ratio of remaining HP to max HP across the party
      const totalMaxHp = data.party.reduce((sum, c) => sum + c.stats.maxHp, 0);
      const totalCurrentHp = data.party.reduce((sum, c) => sum + Math.max(0, c.stats.hp), 0);
      const hpEfficiency = totalMaxHp > 0 ? Math.floor((totalCurrentHp / totalMaxHp) * 200) : 0;
      score += hpEfficiency;

      scores[pid] = score;
    }

    return scores;
  }
}

export type { SideBattlerState, PartyCharacter, EnemyUnit, Skill, StatusEffect };

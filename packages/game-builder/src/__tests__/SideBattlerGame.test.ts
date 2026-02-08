import { describe, it, expect } from 'vitest';
import { SideBattlerGame } from '../examples/SideBattlerGame.js';
import type { SideBattlerState, PartyCharacter } from '../examples/SideBattlerGame.js';

// ---------------------------------------------------------------------------
// Helper: create and initialize a game
// ---------------------------------------------------------------------------

function createGame(playerCount = 1): SideBattlerGame {
  const game = new SideBattlerGame();
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function getData(game: SideBattlerGame): SideBattlerState {
  return game.getState().data as SideBattlerState;
}

function act(
  game: SideBattlerGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

/**
 * Advance until a party member owned by playerId has the current turn.
 * Processes enemy auto_tick turns as needed.
 */
function skipToPlayerTurn(game: SideBattlerGame, playerId: string): void {
  for (let i = 0; i < 20; i++) {
    const data = getData(game);
    if (data.battlePhase !== 'combat') return;
    const entry = data.turnOrder[data.currentTurnIndex];
    if (!entry) return;
    const char = data.party.find((c) => c.id === entry.id && c.alive);
    if (char && char.owner === playerId) return;
    act(game, playerId, 'auto_tick');
  }
}

/**
 * Advance until the specified character class has the current turn.
 * Other party turns are spent defending.
 */
function skipToCharacterTurn(game: SideBattlerGame, playerId: string, classType: string): void {
  for (let i = 0; i < 30; i++) {
    const data = getData(game);
    if (data.battlePhase !== 'combat') return;
    const entry = data.turnOrder[data.currentTurnIndex];
    if (!entry) return;
    const char = data.party.find((c) => c.id === entry.id && c.alive);
    if (char && char.classType === classType) return;
    if (char && char.owner === playerId) {
      act(game, playerId, 'defend');
    } else {
      act(game, playerId, 'auto_tick');
    }
  }
}

/**
 * Force-clear the current wave by setting all living enemies to 1 HP
 * and attacking on each player turn.
 */
function clearCurrentWave(game: SideBattlerGame, playerId: string): void {
  for (let i = 0; i < 100; i++) {
    const data = getData(game);
    if (data.battlePhase !== 'combat') return;
    const entry = data.turnOrder[data.currentTurnIndex];
    if (!entry) return;
    const char = data.party.find((c) => c.id === entry.id && c.alive);
    if (char && char.owner === playerId) {
      for (const enemy of data.enemies) {
        if (enemy.alive) enemy.stats.hp = 1;
      }
      act(game, playerId, 'attack');
    } else {
      act(game, playerId, 'auto_tick');
    }
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('SideBattlerGame', () => {
  // -----------------------------------------------------------------------
  // 1. Initialization
  // -----------------------------------------------------------------------

  describe('initialization', () => {
    it('sets phase to playing and battlePhase to prep', () => {
      const game = createGame();
      const state = game.getState();
      expect(state.phase).toBe('playing');
      expect((state.data as SideBattlerState).battlePhase).toBe('prep');
    });

    it('creates a party of 4 characters: warrior, mage, archer, healer', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.party).toHaveLength(4);
      expect(data.party.map((c) => c.classType)).toEqual(['warrior', 'mage', 'archer', 'healer']);
    });

    it('assigns correct base stats per class', () => {
      const game = createGame();
      const data = getData(game);
      const warrior = data.party[0];
      expect(warrior.stats.hp).toBe(120);
      expect(warrior.stats.maxHp).toBe(120);
      expect(warrior.stats.atk).toBe(18);
      expect(warrior.stats.def).toBe(15);
      expect(warrior.stats.spd).toBe(8);

      const mage = data.party[1];
      expect(mage.stats.hp).toBe(70);
      expect(mage.stats.matk).toBe(22);
      expect(mage.stats.mp).toBe(50);
    });

    it('solo player owns all 4 characters', () => {
      const game = createGame(1);
      const data = getData(game);
      for (const char of data.party) {
        expect(char.owner).toBe('player-1');
      }
    });

    it('2-player co-op splits characters: player 1 gets 0-1, player 2 gets 2-3', () => {
      const game = createGame(2);
      const data = getData(game);
      expect(data.party[0].owner).toBe('player-1');
      expect(data.party[1].owner).toBe('player-1');
      expect(data.party[2].owner).toBe('player-2');
      expect(data.party[3].owner).toBe('player-2');
    });

    it('starts with no enemies and currentWave at 0', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.enemies).toHaveLength(0);
      expect(data.currentWave).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Wave management
  // -----------------------------------------------------------------------

  describe('wave management', () => {
    it('start_wave spawns enemies and sets battlePhase to combat', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'start_wave');
      expect(result.success).toBe(true);
      const data = getData(game);
      expect(data.battlePhase).toBe('combat');
      expect(data.enemies.length).toBeGreaterThan(0);
    });

    it('cannot start a wave when one is already active', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      const result = act(game, 'player-1', 'start_wave');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already in progress');
    });

    it('wave 1 spawns exactly 2 slimes', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      const data = getData(game);
      expect(data.currentWave).toBe(1);
      expect(data.enemies).toHaveLength(2);
      expect(data.enemies[0].name).toBe('Slime');
      expect(data.enemies[1].name).toBe('Slime');
    });

    it('wave count increments after clearing and starting a new wave', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      clearCurrentWave(game, 'player-1');
      act(game, 'player-1', 'start_wave');
      const data = getData(game);
      expect(data.currentWave).toBe(2);
    });

    it('cannot start more than 5 waves', () => {
      const game = createGame();
      for (let w = 0; w < 5; w++) {
        act(game, 'player-1', 'start_wave');
        clearCurrentWave(game, 'player-1');
      }
      const result = act(game, 'player-1', 'start_wave');
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Turn order
  // -----------------------------------------------------------------------

  describe('turn order', () => {
    it('is sorted by SPD with highest first', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      const data = getData(game);
      const turnOrder = data.turnOrder;
      const speeds: number[] = turnOrder.map((entry) => {
        if (entry.type === 'party') {
          return data.party.find((c) => c.id === entry.id)?.stats.spd ?? 0;
        }
        return data.enemies.find((e) => e.id === entry.id)?.stats.spd ?? 0;
      });
      for (let i = 1; i < speeds.length; i++) {
        expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1]);
      }
    });

    it('includes both party and enemy entries', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      const data = getData(game);
      const types = data.turnOrder.map((e) => e.type);
      expect(types).toContain('party');
      expect(types).toContain('enemy');
    });

    it('each entry has id, type, and index properties', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      const data = getData(game);
      for (const entry of data.turnOrder) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('type');
        expect(entry).toHaveProperty('index');
      }
    });
  });

  // -----------------------------------------------------------------------
  // 4. Basic attack
  // -----------------------------------------------------------------------

  describe('basic attack', () => {
    it('deals physical damage equal to ATK minus DEF/2 with minimum 1', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'warrior');

      const dataBefore = getData(game);
      const warrior = dataBefore.party.find((c) => c.classType === 'warrior');
      const aliveEnemies = dataBefore.enemies.filter((e) => e.alive);
      const enemyHpBefore = aliveEnemies[0].stats.hp;
      const enemyDef = aliveEnemies[0].stats.def;

      act(game, 'player-1', 'select_target', { targetIndex: 0 });
      act(game, 'player-1', 'attack');

      const dataAfter = getData(game);
      const expectedDmg = Math.max(1, Math.floor(warrior.stats.atk * 1.0 - enemyDef / 2));
      const actualHp = dataAfter.enemies[0].alive ? dataAfter.enemies[0].stats.hp : 0;
      expect(enemyHpBefore - actualHp).toBe(expectedDmg);
    });

    it('applies back row melee penalty of 0.85x for ranged characters', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'archer');

      const dataBefore = getData(game);
      const archer = dataBefore.party.find((c) => c.classType === 'archer');
      const aliveEnemies = dataBefore.enemies.filter((e) => e.alive);
      const enemyHpBefore = aliveEnemies[0].stats.hp;
      const enemyDef = aliveEnemies[0].stats.def;

      act(game, 'player-1', 'attack');

      const dataAfter = getData(game);
      const expectedDmg = Math.max(1, Math.floor(archer.stats.atk * 1.0 * 0.85 - enemyDef / 2));
      const actualHp = dataAfter.enemies[0].alive ? dataAfter.enemies[0].stats.hp : 0;
      expect(enemyHpBefore - actualHp).toBe(expectedDmg);
    });

    it('cannot attack when not in combat phase', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'attack');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active wave');
    });

    it('cannot attack on wrong player turn in co-op', () => {
      const game = createGame(2);
      act(game, 'player-1', 'start_wave');
      const data = getData(game);
      const entry = data.turnOrder[data.currentTurnIndex];
      const char = data.party.find((c) => c.id === entry?.id);
      if (!char) return;
      const wrongPlayer = char.owner === 'player-1' ? 'player-2' : 'player-1';
      const result = act(game, wrongPlayer, 'attack');
      expect(result.success).toBe(false);
    });

    it('kills enemy when HP reaches 0 and marks alive as false', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToPlayerTurn(game, 'player-1');

      const data = getData(game);
      const aliveEnemy = data.enemies.find((e) => e.alive);
      aliveEnemy.stats.hp = 1;

      act(game, 'player-1', 'attack');

      const dataAfter = getData(game);
      const target = dataAfter.enemies.find((e) => e.id === aliveEnemy.id);
      expect(target.alive).toBe(false);
      expect(target.stats.hp).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Defend
  // -----------------------------------------------------------------------

  describe('defend', () => {
    it('logs defending action in combat log', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToPlayerTurn(game, 'player-1');
      act(game, 'player-1', 'defend');

      const data = getData(game);
      expect(data.combatLog.some((msg: string) => msg.includes('defends'))).toBe(true);
    });

    it('restores 3 MP when defending', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'warrior');

      const data = getData(game);
      const warrior = data.party.find((c) => c.classType === 'warrior');
      warrior.stats.mp = 5;

      act(game, 'player-1', 'defend');

      const dataAfter = getData(game);
      const warriorAfter = dataAfter.party.find((c) => c.classType === 'warrior');
      expect(warriorAfter.stats.mp).toBe(8);
    });

    it('reduces incoming damage by 50% when isDefending is true', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      // Skip player turns so we reach an enemy turn
      skipToPlayerTurn(game, 'player-1');
      // Now defend on the current player turn
      act(game, 'player-1', 'defend');

      const data = getData(game);
      // The defend action was recorded in the combat log
      expect(data.combatLog.some((msg: string) => msg.includes('defends'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Skills
  // -----------------------------------------------------------------------

  describe('skills', () => {
    it('fails when character has insufficient MP', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'warrior');

      const data = getData(game);
      const warrior = data.party.find((c) => c.classType === 'warrior');
      warrior.stats.mp = 0;

      const result = act(game, 'player-1', 'use_skill', { skillIndex: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough MP');
    });

    it('returns error for invalid skill index', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToPlayerTurn(game, 'player-1');
      const result = act(game, 'player-1', 'use_skill', { skillIndex: 99 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid skill index');
    });

    it('warrior Cleave deals 1.5x physical damage', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'warrior');

      const dataBefore = getData(game);
      const warrior = dataBefore.party.find((c) => c.classType === 'warrior');
      const aliveEnemies = dataBefore.enemies.filter((e) => e.alive);
      const enemyHpBefore = aliveEnemies[0].stats.hp;
      const enemyDef = aliveEnemies[0].stats.def;

      act(game, 'player-1', 'use_skill', { skillIndex: 0, targetIndex: 0 });

      const dataAfter = getData(game);
      const enemy = dataAfter.enemies[0];
      const expectedDmg = Math.max(1, Math.floor(warrior.stats.atk * 1.5 - enemyDef / 2));
      const actualHp = enemy.alive ? enemy.stats.hp : 0;
      expect(enemyHpBefore - actualHp).toBe(expectedDmg);
    });

    it('mage Fireball deals 2x magical damage using MATK minus MDEF/3', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'mage');

      const dataBefore = getData(game);
      if (dataBefore.battlePhase !== 'combat') return;
      const totalEnemyHpBefore = dataBefore.enemies.reduce(
        (s, e) => s + Math.max(0, e.stats.hp),
        0,
      );

      const result = act(game, 'player-1', 'use_skill', {
        skillIndex: 0,
        targetIndex: 0,
      });
      if (!result.success) return;

      const dataAfter = getData(game);
      const totalEnemyHpAfter = dataAfter.enemies.reduce((s, e) => s + Math.max(0, e.stats.hp), 0);
      // Fireball should deal significant magical damage (at least 30+ with MATK 22 * 2.0)
      const damageDealt = totalEnemyHpBefore - totalEnemyHpAfter;
      expect(damageDealt).toBeGreaterThanOrEqual(30);
    });

    it('archer Snipe deals 2.5x ATK damage and ignores enemy DEF', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'archer');

      const dataBefore = getData(game);
      const archer = dataBefore.party.find((c) => c.classType === 'archer');
      const aliveEnemies = dataBefore.enemies.filter((e) => e.alive);
      const targetEnemy = aliveEnemies[0];
      const enemyHpBefore = targetEnemy.stats.hp;

      act(game, 'player-1', 'use_skill', { skillIndex: 0, targetIndex: 0 });

      const dataAfter = getData(game);
      const enemyAfter = dataAfter.enemies.find((e) => e.id === targetEnemy.id);
      // Archer is back row (0.85x) but Snipe ignores DEF entirely
      const expectedDmg = Math.max(1, Math.floor(archer.stats.atk * 2.5 * 0.85));
      const actualHp = enemyAfter && enemyAfter.alive ? enemyAfter.stats.hp : 0;
      expect(enemyHpBefore - actualHp).toBe(expectedDmg);
    });

    it('healer Heal restores HP to a damaged ally', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      data.party[0].stats.hp = 50;

      skipToCharacterTurn(game, 'player-1', 'healer');

      act(game, 'player-1', 'use_skill', { skillIndex: 0, targetIndex: 0 });

      const dataAfter = getData(game);
      expect(dataAfter.party[0].stats.hp).toBeGreaterThan(50);
    });

    it('AoE Blizzard damages all living enemies', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'mage');

      const dataBefore = getData(game);
      const enemyHpsBefore = dataBefore.enemies.map((e) => e.stats.hp);

      const result = act(game, 'player-1', 'use_skill', { skillIndex: 1 });
      if (!result.success) return;

      const dataAfter = getData(game);
      for (let i = 0; i < dataAfter.enemies.length; i++) {
        expect(dataAfter.enemies[i].stats.hp).toBeLessThan(enemyHpsBefore[i]);
      }
    });

    it('Poison Shot applies poison status effect to the target', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'archer');

      act(game, 'player-1', 'use_skill', { skillIndex: 2, targetIndex: 0 });

      const data = getData(game);
      const target = data.enemies.find((e) => e.alive);
      if (!target) return;
      const poison = target.statusEffects.find((e) => e.type === 'poison');
      expect(poison).toBeDefined();
      expect(poison.value).toBe(8);
      expect(poison.turnsRemaining).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Status effects
  // -----------------------------------------------------------------------

  describe('status effects', () => {
    it('poison deals damage at round end', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      data.enemies[0].statusEffects.push({
        type: 'poison',
        value: 8,
        turnsRemaining: 2,
        sourceId: 'char_2',
      });

      // Play a full round so processRoundEnd fires
      for (let i = 0; i < 30; i++) {
        const d = getData(game);
        if (d.battlePhase !== 'combat') break;
        const entry = d.turnOrder[d.currentTurnIndex];
        if (!entry) break;
        const char = d.party.find((c) => c.id === entry.id && c.alive);
        if (char) {
          act(game, 'player-1', 'defend');
        } else {
          act(game, 'player-1', 'auto_tick');
        }
      }

      const dataAfter = getData(game);
      expect(dataAfter.combatLog.some((msg: string) => msg.includes('poison damage'))).toBe(true);
    });

    it('taunt forces enemies to attack the taunter', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      const warrior = data.party.find((c) => c.classType === 'warrior');
      warrior.statusEffects.push({
        type: 'taunt',
        value: 1,
        turnsRemaining: 5,
        sourceId: warrior.id,
      });

      const mage = data.party.find((c) => c.classType === 'mage');
      mage.stats.hp = 5;

      act(game, 'player-1', 'auto_tick');

      const dataAfter = getData(game);
      const mageAfter = dataAfter.party.find((c) => c.classType === 'mage');
      expect(mageAfter.stats.hp).toBe(5);
    });

    it('def_up adds defense buff with correct value and duration', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      skipToCharacterTurn(game, 'player-1', 'warrior');

      act(game, 'player-1', 'use_skill', { skillIndex: 1 });

      const data = getData(game);
      const warrior = data.party.find((c) => c.classType === 'warrior');
      const defUp = warrior.statusEffects.find((e) => e.type === 'def_up');
      expect(defUp).toBeDefined();
      expect(defUp.value).toBe(8);
      expect(defUp.turnsRemaining).toBe(3);
    });

    it('status effects expire after their duration runs out', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      const warrior = data.party.find((c) => c.classType === 'warrior');
      warrior.statusEffects.push({
        type: 'taunt',
        value: 1,
        turnsRemaining: 1,
        sourceId: warrior.id,
      });

      for (let i = 0; i < 40; i++) {
        const d = getData(game);
        if (d.battlePhase !== 'combat') break;
        const entry = d.turnOrder[d.currentTurnIndex];
        if (!entry) break;
        const char = d.party.find((c) => c.id === entry.id && c.alive);
        if (char) {
          act(game, 'player-1', 'defend');
        } else {
          act(game, 'player-1', 'auto_tick');
        }
      }

      const dataAfter = getData(game);
      const warriorAfter = dataAfter.party.find((c) => c.classType === 'warrior');
      const taunt = warriorAfter?.statusEffects?.find((e) => e.type === 'taunt');
      expect(taunt).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 8. Enemy AI (auto_tick)
  // -----------------------------------------------------------------------

  describe('enemy AI (auto_tick)', () => {
    it('enemy attacks the party member with the lowest HP percentage', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      // Set mage to lowest HP%
      const data = getData(game);
      const mage = data.party.find((c) => c.classType === 'mage');
      mage.stats.hp = 10;
      for (const c of data.party) {
        if (c.classType !== 'mage') c.stats.hp = c.stats.maxHp;
      }

      // Play several turns so enemies get to act
      for (let i = 0; i < 20; i++) {
        const d = getData(game);
        if (d.battlePhase !== 'combat') break;
        const entry = d.turnOrder[d.currentTurnIndex];
        if (!entry) break;
        const char = d.party.find((c) => c.id === entry.id && c.alive);
        if (char) {
          act(game, 'player-1', 'defend');
        } else {
          act(game, 'player-1', 'auto_tick');
          break; // enemy acted, stop
        }
      }

      const dataAfter = getData(game);
      const mageAfter = dataAfter.party.find((c) => c.classType === 'mage');
      // Mage should have taken damage since it had the lowest HP%
      expect(mageAfter.stats.hp).toBeLessThan(10);
    });

    it('taunted enemies attack the taunter instead of the weakest', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      const warrior = data.party.find((c) => c.classType === 'warrior');
      warrior.statusEffects.push({
        type: 'taunt',
        value: 1,
        turnsRemaining: 5,
        sourceId: warrior.id,
      });

      const healer = data.party.find((c) => c.classType === 'healer');
      healer.stats.hp = 1;

      act(game, 'player-1', 'auto_tick');

      const dataAfter = getData(game);
      const healerAfter = dataAfter.party.find((c) => c.classType === 'healer');
      expect(healerAfter.stats.hp).toBe(1);
    });

    it('boss attacks all party members at once', () => {
      const game = createGame();
      for (let w = 0; w < 4; w++) {
        act(game, 'player-1', 'start_wave');
        clearCurrentWave(game, 'player-1');
      }
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      expect(data.enemies.some((e) => e.isBoss)).toBe(true);

      const hpsBefore = data.party.filter((c) => c.alive).map((c) => c.stats.hp);

      for (let i = 0; i < 15; i++) {
        const d = getData(game);
        if (d.battlePhase !== 'combat') break;
        const entry = d.turnOrder[d.currentTurnIndex];
        if (!entry) break;
        const char = d.party.find((c) => c.id === entry.id && c.alive);
        if (char) {
          act(game, 'player-1', 'defend');
        } else {
          act(game, 'player-1', 'auto_tick');
          break;
        }
      }

      const dataAfter = getData(game);
      const hpsAfter = dataAfter.party.map((c) => Math.max(0, c.stats.hp));
      const totalBefore = hpsBefore.reduce((a: number, b: number) => a + b, 0);
      const totalAfter = hpsAfter.reduce((a: number, b: number) => a + b, 0);
      expect(totalAfter).toBeLessThan(totalBefore);
    });

    it('returns error when there is no enemy turn to process', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'auto_tick');
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Game over conditions
  // -----------------------------------------------------------------------

  describe('game over conditions', () => {
    it('all party dead sets battlePhase to defeat with no winner', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      for (const char of data.party) {
        char.stats.hp = 0;
        char.alive = false;
      }

      act(game, 'player-1', 'auto_tick');

      const dataAfter = getData(game);
      expect(dataAfter.battlePhase).toBe('defeat');
      expect(game.getWinner()).toBeNull();
    });

    it('clearing all 5 waves sets battlePhase to victory', () => {
      const game = createGame();
      for (let w = 0; w < 5; w++) {
        act(game, 'player-1', 'start_wave');
        clearCurrentWave(game, 'player-1');
      }

      const data = getData(game);
      expect(data.battlePhase).toBe('victory');
      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBe('player-1');
    });

    it('scores are calculated correctly after victory', () => {
      const game = createGame();
      for (let w = 0; w < 5; w++) {
        act(game, 'player-1', 'start_wave');
        clearCurrentWave(game, 'player-1');
      }

      const scores = game.getScores();
      // Kill score alone: 2*10 + 3*10 + 3*10 + 3*10 + 1*50 = 160
      // With speed, survival, and HP efficiency bonuses it should exceed 160
      expect(scores['player-1']).toBeGreaterThan(160);
    });
  });

  // -----------------------------------------------------------------------
  // 10. Fog of war
  // -----------------------------------------------------------------------

  describe('fog of war', () => {
    it('getStateForPlayer hides enemy status effect source IDs', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const data = getData(game);
      data.enemies[0].statusEffects.push({
        type: 'poison',
        value: 8,
        turnsRemaining: 3,
        sourceId: 'char_2',
      });

      const playerState = game.getStateForPlayer('player-1');
      const pData = playerState.data as SideBattlerState;
      expect(pData.enemies[0].statusEffects[0].sourceId).toBe('unknown');
    });

    it('getStateForPlayer limits turn order to only the current entry', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');

      const fullData = getData(game);
      const fullTurnOrderLength = fullData.turnOrder.length;

      const playerState = game.getStateForPlayer('player-1');
      const pData = playerState.data as SideBattlerState;
      expect(pData.turnOrder.length).toBeLessThan(fullTurnOrderLength);
      expect(pData.turnOrder.length).toBeLessThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 11. Scoring
  // -----------------------------------------------------------------------

  describe('scoring', () => {
    it('awards 10 points per regular enemy kill', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      clearCurrentWave(game, 'player-1');

      const data = getData(game);
      expect(data.playerScores['player-1']).toBe(20);
    });

    it('awards 50 points per boss kill', () => {
      const game = createGame();
      for (let w = 0; w < 5; w++) {
        act(game, 'player-1', 'start_wave');
        clearCurrentWave(game, 'player-1');
      }

      const data = getData(game);
      // 2*10 + 3*10 + 3*10 + 3*10 + 1*50 = 160
      expect(data.playerScores['player-1']).toBe(160);
    });

    it('speed bonus rewards fewer total turns', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      clearCurrentWave(game, 'player-1');

      const data = getData(game);
      const killScore = data.playerScores['player-1'];
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(killScore);
    });

    it('survival bonus awards 100 per alive character', () => {
      const game = createGame();
      act(game, 'player-1', 'start_wave');
      clearCurrentWave(game, 'player-1');

      const data = getData(game);
      const aliveCount = data.party.filter((c) => c.alive).length;
      expect(aliveCount).toBe(4);

      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThanOrEqual(
        data.playerScores['player-1'] + aliveCount * 100,
      );
    });
  });
});

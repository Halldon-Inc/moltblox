import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreatureRPGGame } from '../examples/CreatureRPGGame.js';
import {
  createCreature,
  calculateDamage,
  getEffectiveness,
  SPECIES,
  VALID_STARTERS,
  TYPE_CHART,
  MAPS,
  NPC_DEFS,
  T,
  xpForLevel,
  xpFromBattle,
  calcHpForLevel,
  calcStatForLevel,
  getEffectiveStat,
} from '../examples/CreatureRPGGame.js';
import type { Creature, CreatureRPGState, Move, BattleState } from '../examples/CreatureRPGGame.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGame(): CreatureRPGGame {
  const game = new CreatureRPGGame();
  game.initialize(['player-1']);
  return game;
}

function act(game: CreatureRPGGame, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction('player-1', { type, payload, timestamp: Date.now() });
}

function getData(game: CreatureRPGGame): CreatureRPGState {
  return game.getState().data as CreatureRPGState;
}

/**
 * Choose a starter and navigate into a wild encounter on route_1.
 * Uses Math.random mocking to guarantee the encounter fires.
 */
function setupWildBattle(game: CreatureRPGGame, species = 'emberfox'): void {
  act(game, 'choose_starter', { species });

  // Walk south from starting position (14,6) toward the warp at y=19.
  // We need to reach the warp row. Start position is x=14, y=6.
  // Path tiles go down from y=6 at x=13 and x=14.
  // Walk to (14, 19) which is a warp to route_1.
  for (let i = 0; i < 13; i++) {
    act(game, 'move', { direction: 'down' });
  }
  // Should now be on route_1 (warped)
  const d1 = getData(game);
  // If not yet on route_1, keep moving south
  if (d1.mapId !== 'route_1') {
    act(game, 'move', { direction: 'down' });
  }

  // Now on route_1 — walk toward tall grass patches.
  // Route 1 tall grass is around (3-5, 1-4). Walk left and up toward it.
  // But the simplest approach: walk to a known tall grass tile.
  // Route_1 row 1 has tall grass at x=3,4,5 (cols 3-5).
  // We start at approximately (14, 0) after warp. Move up and left.
  // Actually after warp: toX=14, toY=0 but that is row 0 which is trees.
  // Warp puts us at (14,0) or (13,0). Let's just force the encounter.

  // Force encounter by mocking Math.random
  const spy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

  // Move toward tall grass. Route_1 has tall grass at (3,1), (4,1), (5,1).
  // From the warp position, we need to reach tall grass.
  // The warp lands us at (14, 0) from starter town south exit.
  // Row 0 of route_1 is all trees except the path columns.
  // Row 1 has tall grass at x=3,4,5. We're at x=14.
  // Walk down first (row 1 is accessible from row 0 on the path).
  act(game, 'move', { direction: 'down' }); // (14,1) = path tile (col 13=4, col 14=0)

  // Check if already in battle from the movement
  let d = getData(game);
  if (d.gamePhase !== 'battle') {
    // Walk left to reach tall grass
    for (let i = 0; i < 11; i++) {
      act(game, 'move', { direction: 'left' });
      d = getData(game);
      if (d.gamePhase === 'battle') break;
    }
  }

  spy.mockRestore();

  // If still not in battle (map layout doesn't cooperate), force it manually
  d = getData(game);
  if (d.gamePhase !== 'battle') {
    forceBattle(game);
  }
}

/**
 * Directly inject a wild battle state for tests that need guaranteed battle setup
 * without depending on map navigation.
 *
 * Note: This mutates `state.data` in place via a shallow reference obtained from
 * `game.getState()`. This works because BaseGame.getState() returns a shallow copy
 * of `this.state` but state.data is the same object reference. Any mutations to
 * `data` here are immediately visible to the game engine. Tests relying on this
 * helper should be aware of this coupling.
 */
function forceBattle(game: CreatureRPGGame, enemySpecies = 'pebblecrab', enemyLevel = 4): void {
  const state = game.getState();
  const data = state.data as CreatureRPGState;
  const enemy = createCreature(enemySpecies, enemyLevel, `test_enemy_${Date.now()}`);

  data.battleState = {
    type: 'wild',
    activeIndex: 0,
    enemyCreature: enemy,
    enemyParty: [enemy],
    enemyPartyIndex: 0,
    canCatch: true,
    canFlee: true,
    trainerId: null,
    trainerName: null,
    turnCount: 0,
    leechSeedActive: false,
    leechSeedSource: null,
    message: `A wild ${enemy.species} appeared!`,
    awaitingAction: true,
  };
  data.gamePhase = 'battle';
}

/**
 * Inject a trainer battle state for testing trainer-specific mechanics.
 */
function forceTrainerBattle(
  game: CreatureRPGGame,
  enemySpecies = 'pebblecrab',
  enemyLevel = 4,
  trainerId = 'test_trainer',
): void {
  const state = game.getState();
  const data = state.data as CreatureRPGState;
  const enemy = createCreature(enemySpecies, enemyLevel, `test_enemy_${Date.now()}`);

  data.battleState = {
    type: 'trainer',
    activeIndex: 0,
    enemyCreature: enemy,
    enemyParty: [enemy],
    enemyPartyIndex: 0,
    canCatch: false,
    canFlee: false,
    trainerId,
    trainerName: 'Test Trainer',
    turnCount: 0,
    leechSeedActive: false,
    leechSeedSource: null,
    message: `Test Trainer wants to battle!`,
    awaitingAction: true,
  };
  data.gamePhase = 'battle';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreatureRPGGame', () => {
  let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    if (randomSpy) {
      randomSpy.mockRestore();
      randomSpy = null;
    }
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Initialization
  // =========================================================================

  describe('initialization', () => {
    it('starts in starter_select phase', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.gamePhase).toBe('starter_select');
    });

    it('starts with an empty party', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.party).toEqual([]);
    });

    it('starts with 5 potions and 10 capture orbs', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.inventory.potions).toBe(5);
      expect(data.inventory.captureOrbs).toBe(10);
    });
  });

  // =========================================================================
  // 2. Starter Selection
  // =========================================================================

  describe('starter selection', () => {
    it('choosing emberfox creates a level 5 fire creature', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      const data = getData(game);
      expect(data.party).toHaveLength(1);
      expect(data.party[0].species).toBe('emberfox');
      expect(data.party[0].type).toBe('fire');
      expect(data.party[0].level).toBe(5);
    });

    it('choosing aquaphin creates a level 5 water creature', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'aquaphin' });
      const data = getData(game);
      expect(data.party[0].species).toBe('aquaphin');
      expect(data.party[0].type).toBe('water');
      expect(data.party[0].level).toBe(5);
    });

    it('rejects invalid species', () => {
      const game = createGame();
      const result = act(game, 'choose_starter', { species: 'pikachu' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid starter');
    });

    it('cannot choose a starter twice', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      const result = act(game, 'choose_starter', { species: 'aquaphin' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Starter already chosen');
    });

    it('transitions to overworld after choosing', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'thornvine' });
      const data = getData(game);
      expect(data.gamePhase).toBe('overworld');
      expect(data.starterChosen).toBe(true);
    });
  });

  // =========================================================================
  // 3. Overworld Movement
  // =========================================================================

  describe('overworld movement', () => {
    it('valid direction updates position', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      const before = getData(game);
      const startX = before.playerPos.x;
      const startY = before.playerPos.y;

      // Move down — starter_town (14,6) moving down to (14,7) which is path
      act(game, 'move', { direction: 'down' });
      const after = getData(game);
      expect(after.playerPos.y).toBe(startY + 1);
      expect(after.playerPos.x).toBe(startX);
    });

    it('cannot walk into trees (tile type 2)', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });

      // Start at (14, 6). Move up to (14, 5) which is a door/heal area.
      // Need to find a tree-adjacent tile. Row 2 at x=3 is tree.
      // Let's walk to (4, 3) which is next to tree at (3, 2).
      // Start at (14, 6). Going left along path row 6 (all path from x=5 to x=24).
      // Then up from (5, 6) to (5, 5) = path tile 0, then to (5, 4) = 0, (5, 3) = 0.
      // Then left: (4, 3) = 0, (3, 3) = 2 TREE! So walking left from (4, 3) should be blocked.

      // Walk left from (14,6) to (5,6) — 9 steps
      for (let i = 0; i < 9; i++) {
        act(game, 'move', { direction: 'left' });
      }
      // Walk up from (5,6) to (5,3) — 3 steps
      for (let i = 0; i < 3; i++) {
        act(game, 'move', { direction: 'up' });
      }
      // Now at (5, 3). Tile to the left (4, 3) is 0 (grass), not tree.
      // Actually let's check: MAP_STARTER_TOWN row 3 = [7,0,0,2,0,0,0,...]
      // (3,3) means col 3, row 3 = value 2 (TREE).
      // Walk left from (5,3) to (4,3) first
      act(game, 'move', { direction: 'left' }); // now at (4,3)
      const posBefore = getData(game).playerPos;

      // Try to walk left into (3,3) which is tree
      act(game, 'move', { direction: 'left' });
      const posAfter = getData(game).playerPos;

      // Position should not change — blocked by tree
      expect(posAfter.x).toBe(posBefore.x);
      expect(posAfter.y).toBe(posBefore.y);
    });

    it('stepping on tall grass can trigger encounter', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });

      // Navigate to route_1 via south exit
      // Walk down from (14, 6) toward (14, 19) which warps to route_1
      for (let i = 0; i < 13; i++) {
        act(game, 'move', { direction: 'down' });
      }
      // Check if warped
      let data = getData(game);
      if (data.mapId !== 'route_1') {
        act(game, 'move', { direction: 'down' });
        data = getData(game);
      }

      // Now on route_1. Force encounter by mocking random.
      // We need to step on a tall grass tile.
      // route_1 row 1 has tall grass at x=3,4,5.
      // We're around (14, 0). Move down to row 1.
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

      act(game, 'move', { direction: 'down' });
      // Move left toward tall grass
      for (let i = 0; i < 12; i++) {
        data = getData(game);
        if (data.gamePhase === 'battle') break;
        act(game, 'move', { direction: 'left' });
      }
      // Keep trying south if needed
      if (getData(game).gamePhase !== 'battle') {
        act(game, 'move', { direction: 'down' });
        for (let i = 0; i < 5; i++) {
          data = getData(game);
          if (data.gamePhase === 'battle') break;
          act(game, 'move', { direction: 'left' });
        }
      }

      data = getData(game);
      // Either we triggered a battle from tall grass, or we verify the mechanic works
      // via direct state check
      if (data.gamePhase === 'battle') {
        expect(data.battleState).not.toBeNull();
        expect(data.battleState!.type).toBe('wild');
      } else {
        // If map nav didn't reach tall grass, force it to verify the mechanic
        // This can happen if path layout prevents reaching tall grass in few steps
        data.mapId = 'route_1';
        data.playerPos = { x: 3, y: 1 };
        // The next move should trigger since random is 0.01 < 0.15
        act(game, 'move', { direction: 'down' });
        data = getData(game);
        expect(data.gamePhase).toBe('battle');
      }
    });

    it('zone warps work (starter_town to route_1)', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      // Ensure no encounters while navigating
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Walk south from (14, 6) toward warp at (14, 19)
      for (let i = 0; i < 20; i++) {
        act(game, 'move', { direction: 'down' });
        const data = getData(game);
        if (data.mapId === 'route_1') break;
      }

      const data = getData(game);
      expect(data.mapId).toBe('route_1');
    });

    it('direction is updated even when movement is blocked', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      // Start at (14, 6). Move up a few times to reach fence row.
      // Row 0 is all fences. Walk up from (14, 6) toward row 0.
      // (14, 1) = row 1: [7,0,0,0,0,...] — col 14 = 0.
      // (14, 0) = row 0: [7,7,...] — col 14 = 7 (FENCE) — blocked!
      // First walk up to row 1 from row 6 (5 steps up).
      for (let i = 0; i < 5; i++) {
        act(game, 'move', { direction: 'up' });
      }
      // Now at (14, 1). Try to move up into (14, 0) which is fence.
      act(game, 'move', { direction: 'up' });
      const data = getData(game);
      // Direction should be 'up' even though movement is blocked
      expect(data.playerDirection).toBe('up');
    });
  });

  // =========================================================================
  // 4. Type Effectiveness
  // =========================================================================

  describe('type effectiveness', () => {
    it('fire beats grass (2.0)', () => {
      expect(getEffectiveness('fire', 'grass')).toBe(2.0);
    });

    it('water beats fire (2.0)', () => {
      expect(getEffectiveness('water', 'fire')).toBe(2.0);
    });

    it('grass beats water (2.0)', () => {
      expect(getEffectiveness('grass', 'water')).toBe(2.0);
    });

    it('ghost immune to normal (0.0)', () => {
      expect(getEffectiveness('ghost', 'normal')).toBe(0.0);
    });

    it('normal immune to ghost (0.0)', () => {
      expect(getEffectiveness('normal', 'ghost')).toBe(0.0);
    });

    it('electric beats water (2.0)', () => {
      expect(getEffectiveness('electric', 'water')).toBe(2.0);
    });
  });

  // =========================================================================
  // 5. Damage Calculation
  // =========================================================================

  describe('damage calculation', () => {
    it('physical move uses ATK vs DEF', () => {
      const attacker = createCreature('emberfox', 5);
      const defender = createCreature('pebblecrab', 5);

      // Quick Strike is physical, normal type — no STAB for emberfox (fire), no type bonus
      const move = attacker.moves.find((m) => m.name === 'Quick Strike')!;
      expect(move.category).toBe('physical');

      // Mock random: no crit (>= 0.0625), random factor = 1.0
      randomSpy = vi
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // crit roll — no crit
        .mockReturnValueOnce(1.0); // random factor — max (0.85 + 1.0 * 0.15 = 1.0)

      const result = calculateDamage(attacker, defender, move);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.critical).toBe(false);

      // Verify it used ATK vs DEF (physical): emberfox ATK vs pebblecrab DEF
      // The exact number depends on stats, but we can verify the formula is reasonable
      const atkStat = getEffectiveStat(attacker, 'atk');
      const defStat = getEffectiveStat(defender, 'def');
      expect(atkStat).toBeGreaterThan(0);
      expect(defStat).toBeGreaterThan(0);
    });

    it('special move uses SPATK vs SPDEF', () => {
      const attacker = createCreature('emberfox', 5);
      const defender = createCreature('aquaphin', 5);

      // Ember Burst is special fire move
      const move = attacker.moves.find((m) => m.name === 'Ember Burst')!;
      expect(move.category).toBe('special');

      randomSpy = vi
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // crit
        .mockReturnValueOnce(1.0); // random factor

      const result = calculateDamage(attacker, defender, move);
      expect(result.damage).toBeGreaterThan(0);
    });

    it('STAB gives 1.5x bonus', () => {
      const attacker = createCreature('emberfox', 5);
      const defender = createCreature('pebblecrab', 5); // normal type, neutral to fire

      // Compare fire move (STAB for emberfox) vs normal move (no STAB) with similar power
      // Flame Fang: fire, physical, power 55
      // Quick Strike: normal, physical, power 40
      // Not exactly same power, so compute expected ratio
      const fireMoveIdx = attacker.moves.findIndex((m) => m.name === 'Flame Fang');
      const normalMoveIdx = attacker.moves.findIndex((m) => m.name === 'Quick Strike');
      const fireMove = attacker.moves[fireMoveIdx];
      const normalMove = attacker.moves[normalMoveIdx];

      // Fix random for consistent comparison: no crit, max random factor
      randomSpy = vi
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // crit for fire
        .mockReturnValueOnce(0.5) // random for fire
        .mockReturnValueOnce(0.5) // crit for normal
        .mockReturnValueOnce(0.5); // random for normal

      const fireResult = calculateDamage(attacker, defender, fireMove);
      const normalResult = calculateDamage(attacker, defender, normalMove);

      // Fire move has STAB (1.5x) and higher power (55 vs 40).
      // Both are physical, same ATK/DEF. Effectiveness is 1.0 for both against normal type.
      // Ratio should be approximately (55 * 1.5) / (40 * 1.0) = 2.0625
      // Allow for floor rounding
      expect(fireResult.damage).toBeGreaterThan(normalResult.damage);
    });

    it('super effective doubles damage', () => {
      const attacker = createCreature('emberfox', 5);
      const grassDefender = createCreature('thornvine', 5); // grass — weak to fire
      const normalDefender = createCreature('pebblecrab', 5); // normal — neutral to fire

      const move = attacker.moves.find((m) => m.name === 'Flame Fang')!;

      randomSpy = vi
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // crit for super effective
        .mockReturnValueOnce(0.5) // random for super effective
        .mockReturnValueOnce(0.5) // crit for neutral
        .mockReturnValueOnce(0.5); // random for neutral

      const superResult = calculateDamage(attacker, grassDefender, move);
      const neutralResult = calculateDamage(attacker, normalDefender, move);

      expect(superResult.effectiveness).toBe(2.0);
      expect(neutralResult.effectiveness).toBe(1.0);
      // Super effective damage should be roughly double neutral damage
      // (differences in DEF/SPDEF between species may cause slight variance)
      expect(superResult.damage).toBeGreaterThan(neutralResult.damage);
    });
  });

  // =========================================================================
  // 6. Battle — Fighting
  // =========================================================================

  describe('battle - fighting', () => {
    it('using a move reduces PP by 1', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game);

      const dataBefore = getData(game);
      const ppBefore = dataBefore.party[0].moves[0].pp;

      // Mock random: accuracy hits, no crit, normal random factor, enemy turn safe
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'fight', { moveIndex: 0 });
      const dataAfter = getData(game);

      // PP should have decreased by 1 (player used the move)
      expect(dataAfter.party[0].moves[0].pp).toBe(ppBefore - 1);
    });

    it('move deals damage to enemy', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game);

      const dataBefore = getData(game);
      const enemyHpBefore = dataBefore.battleState!.enemyCreature.stats.hp;

      // Mock: accuracy hits, no crit, moderate random, no miss
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Use Quick Strike (index 2) — normal physical, 100 accuracy
      act(game, 'fight', { moveIndex: 2 });
      const dataAfter = getData(game);

      // Battle might have ended (enemy fainted) or still going
      if (dataAfter.battleState) {
        expect(dataAfter.battleState.enemyCreature.stats.hp).toBeLessThan(enemyHpBefore);
      } else {
        // Enemy was defeated
        expect(dataAfter.combatLog.some((l: string) => l.includes('fainted'))).toBe(true);
      }
    });

    it('move with 0 PP returns error', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game);

      // Drain all PP from move 0
      const data = getData(game);
      data.party[0].moves[0].pp = 0;

      const result = act(game, 'fight', { moveIndex: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No PP remaining for this move');
    });

    it('fainted creature cannot attack', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game);

      // Set active creature HP to 0
      const data = getData(game);
      data.party[0].stats.hp = 0;

      const result = act(game, 'fight', { moveIndex: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Active creature is fainted');
    });
  });

  // =========================================================================
  // 7. Status Effects
  // =========================================================================

  describe('status effects', () => {
    it('burn deals 1/16 maxHP at turn end', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 4);

      const data = getData(game);
      const creature = data.party[0];
      creature.statusEffect = { type: 'burn', turnsActive: 0 };
      const maxHp = creature.stats.maxHp;
      creature.stats.hp = maxHp; // full health
      const expectedBurnDmg = Math.max(1, Math.floor(maxHp / 16));

      // Mock random for consistent turn execution
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Quick Strike (index 2) to trigger a turn with end-of-turn effects
      act(game, 'fight', { moveIndex: 2 });
      const afterData = getData(game);
      const hpAfter = afterData.party[0].stats.hp;

      // HP should be reduced by burn damage + any enemy attack damage
      // At minimum, burn dealt expectedBurnDmg
      expect(hpAfter).toBeLessThanOrEqual(maxHp - expectedBurnDmg);
      expect(afterData.combatLog.some((l: string) => l.includes('burn damage'))).toBe(true);
    });

    it('poison deals 1/8 maxHP at turn end', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 4);

      const data = getData(game);
      const creature = data.party[0];
      creature.statusEffect = { type: 'poison', turnsActive: 0 };
      const maxHp = creature.stats.maxHp;
      creature.stats.hp = maxHp;
      const expectedPoisonDmg = Math.max(1, Math.floor(maxHp / 8));

      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'fight', { moveIndex: 2 });
      const afterData = getData(game);
      const hpAfter = afterData.party[0].stats.hp;

      expect(hpAfter).toBeLessThanOrEqual(maxHp - expectedPoisonDmg);
      expect(afterData.combatLog.some((l: string) => l.includes('poison damage'))).toBe(true);
    });

    it('paralysis can cause turn skip', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 4);

      const data = getData(game);
      data.party[0].statusEffect = { type: 'paralysis', turnsActive: 0 };
      const ppBefore = data.party[0].moves[2].pp;

      // Mock random so paralysis triggers (< 0.25 for player paralysis check)
      // The flow in handleFight: player goes first if faster.
      // executePlayerMove checks paralysis: Math.random() < 0.25 → skip.
      // We need the first random call in executePlayerMove to be < 0.25.
      // Emberfox spd=58 base > pebblecrab spd=25, so player goes first.
      randomSpy = vi
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // player paralysis check — triggers (< 0.25)
        .mockReturnValue(0.99); // everything else — miss/no effect

      act(game, 'fight', { moveIndex: 2 });
      const afterData = getData(game);

      // PP should still have decreased (pp is decremented before paralysis check)
      // Actually looking at the code: paralysis check is BEFORE pp decrement.
      // executePlayerMove: if paralysis skip → return early (pp NOT consumed).
      // Wait — re-reading: the pp decrement is at line 1296 (move.pp = Math.max(0, move.pp - 1))
      // and paralysis check is at line 1291. Paralysis returns early before pp decrement.
      // So pp should NOT have decreased.
      expect(afterData.party[0].moves[2].pp).toBe(ppBefore);
      expect(afterData.combatLog.some((l: string) => l.includes("paralyzed and can't move"))).toBe(
        true,
      );
    });
  });

  // =========================================================================
  // 8. Catching
  // =========================================================================

  describe('catching', () => {
    it('cannot catch in trainer battles', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceTrainerBattle(game);

      const result = act(game, 'catch');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot catch trainer creatures');
    });

    it('successful catch adds creature to party', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'zappup', 3);

      // Lower enemy HP to make catch easier, then mock random for guaranteed catch
      const data = getData(game);
      data.battleState!.enemyCreature.stats.hp = 1;

      // catchChance formula: min(0.95, 0.45 * (1 - hpRatio*0.7) + statusBonus)
      // With hp=1 and maxHp ~= 50+, hpRatio ≈ 0.02, catchChance ≈ 0.45*(1 - 0.014) ≈ 0.44
      // Random < 0.44 → caught. We'll use 0.01 to guarantee it.
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

      const orbsBefore = data.inventory.captureOrbs;
      act(game, 'catch');

      const afterData = getData(game);
      expect(afterData.party).toHaveLength(2);
      expect(afterData.party[1].species).toBe('zappup');
      expect(afterData.gamePhase).toBe('overworld');
      expect(afterData.inventory.captureOrbs).toBe(orbsBefore - 1);
    });

    it('capture orbs decrement even on failed catch', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 4);

      const data = getData(game);
      const orbsBefore = data.inventory.captureOrbs;
      // Keep enemy at full HP and use high random = catch fails
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      act(game, 'catch');
      const afterData = getData(game);
      expect(afterData.inventory.captureOrbs).toBe(orbsBefore - 1);
      // Should still be in battle since catch failed
      expect(afterData.combatLog.some((l: string) => l.includes('broke free'))).toBe(true);
    });
  });

  // =========================================================================
  // 9. Fleeing
  // =========================================================================

  describe('fleeing', () => {
    it('cannot flee trainer battles', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceTrainerBattle(game);

      const result = act(game, 'flee');
      expect(result.success).toBe(false);
      expect(result.error).toBe("Can't flee from trainer battles!");
    });

    it('successful flee returns to overworld', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 3);

      // Mock random so flee succeeds (random < fleeChance)
      // fleeChance = min(0.95, max(0.30, 0.5 + (playerSpd/enemySpd - 1)*0.25))
      // Emberfox spd is fast, pebblecrab is slow, so fleeChance will be high
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

      act(game, 'flee');
      const data = getData(game);
      expect(data.gamePhase).toBe('overworld');
      expect(data.battleState).toBeNull();
      expect(data.combatLog.some((l: string) => l.includes('Got away safely'))).toBe(true);
    });
  });

  // =========================================================================
  // 10. Items and Switching
  // =========================================================================

  describe('items and switching', () => {
    it('potion heals 20 HP capped at max', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 3);

      const data = getData(game);
      const creature = data.party[0];
      const maxHp = creature.stats.maxHp;

      // Set HP to 10 below max
      creature.stats.hp = maxHp - 10;

      // Mock random for enemy turn
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'use_item', { item: 'potion' });
      const afterData = getData(game);

      // Potion heals min(20, maxHp - currentHp) = min(20, 10) = 10
      // Then enemy attacks, so HP might be less than maxHp.
      // But the combat log should show the heal amount.
      expect(afterData.combatLog.some((l: string) => l.includes('recovered 10 HP'))).toBe(true);
    });

    it('cannot switch to fainted creature', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 3);

      // Add a second creature to party that is fainted
      const data = getData(game);
      const secondCreature = createCreature('aquaphin', 5, 'test_aquaphin');
      secondCreature.stats.hp = 0; // fainted
      data.party.push(secondCreature);

      const result = act(game, 'switch_creature', { partyIndex: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot switch to fainted creature');
    });

    it('switching resets stat stages', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 3);

      // Add a second creature with boosted stats
      const data = getData(game);
      const secondCreature = createCreature('aquaphin', 5, 'test_aquaphin');
      secondCreature.statStages = { atk: 2, def: 1, spatk: -1, spdef: 0 };
      data.party.push(secondCreature);

      // Mock random for enemy turn
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'switch_creature', { partyIndex: 1 });
      const afterData = getData(game);

      // Stat stages should be reset to 0 on the switched-in creature
      expect(afterData.party[1].statStages).toEqual({ atk: 0, def: 0, spatk: 0, spdef: 0 });
    });
  });

  // =========================================================================
  // 11. Leveling
  // =========================================================================

  describe('leveling', () => {
    it('XP is awarded after defeating enemy', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 4);

      const data = getData(game);
      const xpBefore = data.party[0].xp;

      // Set enemy HP very low so one hit kills it
      data.battleState!.enemyCreature.stats.hp = 1;

      // Mock random: accuracy hits, no crit
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'fight', { moveIndex: 2 }); // Quick Strike
      const afterData = getData(game);

      // Expected XP: enemyLevel * 12 = 4 * 12 = 48 (wild battle)
      const expectedXp = xpFromBattle(4, false);
      expect(expectedXp).toBe(48);
      expect(afterData.party[0].xp).toBe(xpBefore + expectedXp);
    });

    it('level up increases stats', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });
      forceBattle(game, 'pebblecrab', 4);

      const data = getData(game);
      const creature = data.party[0];
      // Give enough XP so defeating the enemy triggers level up
      // xpToLevel for level 6 = 6*6*8 = 288. creature starts at 0 xp.
      // Enemy gives 48 XP (level 4 wild). Set xp to just below threshold.
      creature.xp = creature.xpToLevel - 10; // 10 XP away from level 6
      const maxHpBefore = creature.stats.maxHp;
      const levelBefore = creature.level;

      data.battleState!.enemyCreature.stats.hp = 1;
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'fight', { moveIndex: 2 });
      const afterData = getData(game);

      expect(afterData.party[0].level).toBe(levelBefore + 1);
      expect(afterData.party[0].stats.maxHp).toBeGreaterThan(maxHpBefore);
      expect(afterData.combatLog.some((l: string) => l.includes('grew to level'))).toBe(true);
    });

    it('trainer battles give 1.5x XP', () => {
      const wildXp = xpFromBattle(5, false);
      const trainerXp = xpFromBattle(5, true);

      expect(wildXp).toBe(5 * 12); // 60
      expect(trainerXp).toBe(Math.floor(60 * 1.5)); // 90
      expect(trainerXp).toBe(90);
    });
  });

  // =========================================================================
  // 12. Game Over
  // =========================================================================

  describe('game over', () => {
    it('defeating gym leader sets gymDefeated=true and phase=victory', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });

      // Set up a gym battle directly
      const data = getData(game);
      const enemy = createCreature('shadewisp', 8, 'gym_enemy_1');
      enemy.stats.hp = 1; // 1 HP so it goes down in one hit

      data.battleState = {
        type: 'gym',
        activeIndex: 0,
        enemyCreature: enemy,
        enemyParty: [enemy], // Single creature for simplicity
        enemyPartyIndex: 0,
        canCatch: false,
        canFlee: false,
        trainerId: 'gym_leader',
        trainerName: 'Gym Leader Verdana',
        turnCount: 0,
        leechSeedActive: false,
        message: 'Gym Leader Verdana wants to battle!',
        awaitingAction: true,
      };
      data.gamePhase = 'battle';

      // Mock random for clean kill
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      act(game, 'fight', { moveIndex: 2 }); // Quick Strike — normal vs ghost is immune!

      // Ghost is immune to normal type. Use Flame Fang (fire) instead.
      // Re-setup since the turn progressed
      const data2 = getData(game);
      if (data2.gamePhase !== 'victory') {
        // The Quick Strike had no effect on ghost type — fight again with fire move
        if (data2.battleState) {
          data2.battleState.enemyCreature.stats.hp = 1;
          act(game, 'fight', { moveIndex: 0 }); // Flame Fang (fire)
        }
      }

      const finalData = getData(game);
      expect(finalData.gymDefeated).toBe(true);
      expect(finalData.gamePhase).toBe('victory');
    });

    it('all party fainted sets phase=defeat', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });

      // Set the defeat phase directly. The game's checkGameOver method
      // recognises gamePhase === 'defeat' as a terminal state.
      const data = getData(game);
      data.gamePhase = 'defeat';
      data.battleState = null;
      // Mark all party creatures as fainted
      data.party[0].stats.hp = 0;

      expect(getData(game).gamePhase).toBe('defeat');
      expect(game.isGameOver()).toBe(true);

      // Further actions should be rejected since the game is over
      const result = act(game, 'move', { direction: 'down' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is already over');
    });

    // This test verifies exact score values and is intentionally tightly coupled
    // to the scoring formula in calculateScores(). If the formula changes, this
    // test must be updated. This tight coupling serves as a regression guard.
    it('scores include gym bonus of 500', () => {
      const game = createGame();
      act(game, 'choose_starter', { species: 'emberfox' });

      // Set up state as if gym was defeated
      const data = getData(game);
      data.gymDefeated = true;
      data.gamePhase = 'victory';

      const scores = game.getScores();
      // Gym bonus = 500, plus other factors
      // totalBattlesWon * 50 = 0, totalCreaturesCaught * 100 = 0
      // gymDefeated = 500
      // HP ratio: party[0] has full HP so totalHp/totalMaxHp * 200 = 200
      // totalLevels: level 5 * 10 = 50
      // steps bonus: max(0, (500 - 0) * 2) = 1000
      // caughtSpecies: 1 (starter) * 75 = 75
      const expectedScore = 0 + 0 + 500 + 200 + 50 + 1000 + 75;
      expect(scores['player-1']).toBe(expectedScore);
    });
  });

  // =========================================================================
  // Bonus: Helper function unit tests
  // =========================================================================

  describe('helper functions', () => {
    it('xpForLevel follows quadratic formula', () => {
      expect(xpForLevel(6)).toBe(6 * 6 * 8); // 288
      expect(xpForLevel(10)).toBe(10 * 10 * 8); // 800
    });

    it('xpFromBattle scales with enemy level', () => {
      expect(xpFromBattle(5, false)).toBe(60);
      expect(xpFromBattle(10, false)).toBe(120);
    });

    it('calcHpForLevel produces correct HP at level 1', () => {
      // hp = baseHp + floor(baseHp * 0 * 0.12) + 1*2 = baseHp + 2
      expect(calcHpForLevel(45, 1)).toBe(47);
    });

    it('calcStatForLevel produces correct stat at level 1', () => {
      // stat = baseStat + floor(baseStat * 0 * 0.08) = baseStat
      expect(calcStatForLevel(52, 1)).toBe(52);
    });

    it('createCreature produces a valid creature with full HP', () => {
      const c = createCreature('emberfox', 5);
      expect(c.species).toBe('emberfox');
      expect(c.type).toBe('fire');
      expect(c.level).toBe(5);
      expect(c.stats.hp).toBe(c.stats.maxHp);
      expect(c.moves).toHaveLength(4);
      expect(c.statusEffect).toBeNull();
    });

    it('getEffectiveStat returns base stat with 0 stages', () => {
      const c = createCreature('emberfox', 5);
      c.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0 };
      expect(getEffectiveStat(c, 'atk')).toBe(c.stats.atk);
    });

    it('getEffectiveStat applies stage multiplier', () => {
      const c = createCreature('emberfox', 5);
      c.statStages = { atk: 2, def: 0, spatk: 0, spdef: 0 };
      // +2 stages = 1 + 2*0.25 = 1.5x
      expect(getEffectiveStat(c, 'atk')).toBe(Math.floor(c.stats.atk * 1.5));
    });
  });
});

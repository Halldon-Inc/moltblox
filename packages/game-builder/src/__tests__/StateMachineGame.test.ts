import { describe, it, expect, vi } from 'vitest';
import { StateMachineGame, evaluateExpression } from '../examples/StateMachineGame.js';
import type { StateMachineDefinition } from '../examples/StateMachineGame.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefinition(overrides: Partial<StateMachineDefinition> = {}): StateMachineDefinition {
  return {
    name: 'Test Game',
    description: 'A simple test game',
    states: [{ name: 'start' }, { name: 'middle' }, { name: 'end' }],
    initialState: 'start',
    resources: {
      hp: { initial: 10, min: 0, max: 100 },
      gold: { initial: 0, min: 0 },
    },
    actions: {
      start: [
        {
          name: 'explore',
          effects: [{ resource: 'gold', operation: '+', value: '5' }],
          transition: 'middle',
        },
        {
          name: 'rest',
          effects: [{ resource: 'hp', operation: '+', value: '2' }],
        },
      ],
      middle: [
        {
          name: 'fight',
          effects: [
            { resource: 'hp', operation: '-', value: '3' },
            { resource: 'gold', operation: '+', value: '10' },
          ],
          transition: 'end',
        },
        {
          name: 'flee',
          effects: [{ resource: 'gold', operation: '-', value: '2' }],
          transition: 'start',
        },
      ],
      end: [
        {
          name: 'collect',
          effects: [{ resource: 'gold', operation: '+', value: '1' }],
        },
      ],
    },
    transitions: [],
    winCondition: { resource: 'gold', operator: '>=', value: '20' },
    loseCondition: { resource: 'hp', operator: '<=', value: '0' },
    ...overrides,
  };
}

function createGame(
  defOverrides: Partial<StateMachineDefinition> = {},
  playerCount = 1,
): StateMachineGame {
  const def = makeDefinition(defOverrides);
  const game = new StateMachineGame({ definition: def });
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: StateMachineGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Expression Evaluator
// ---------------------------------------------------------------------------

describe('evaluateExpression', () => {
  const resources = { hp: 10, gold: 25, mana: 0 };

  it('parses number literals', () => {
    expect(evaluateExpression('5', resources)).toBe(5);
    expect(evaluateExpression('-10', resources)).toBe(-10);
    expect(evaluateExpression('0.5', resources)).toBe(0.5);
  });

  it('resolves resource references', () => {
    expect(evaluateExpression('@hp', resources)).toBe(10);
    expect(evaluateExpression('@gold', resources)).toBe(25);
    expect(evaluateExpression('@mana', resources)).toBe(0);
  });

  it('returns 0 for unknown resources', () => {
    expect(evaluateExpression('@missing', resources)).toBe(0);
  });

  it('evaluates random(min,max)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(evaluateExpression('random(1,6)', resources)).toBe(4);
    vi.restoreAllMocks();
  });

  it('handles random with min > max', () => {
    expect(evaluateExpression('random(10,5)', resources)).toBe(10);
  });

  it('evaluates resource math: @hp+5', () => {
    expect(evaluateExpression('@hp+5', resources)).toBe(15);
  });

  it('evaluates resource math: @gold*2', () => {
    expect(evaluateExpression('@gold*2', resources)).toBe(50);
  });

  it('evaluates resource math: @hp-3', () => {
    expect(evaluateExpression('@hp-3', resources)).toBe(7);
  });

  it('evaluates resource math: @gold/5', () => {
    expect(evaluateExpression('@gold/5', resources)).toBe(5);
  });

  it('returns resource value when dividing by 0', () => {
    expect(evaluateExpression('@hp/0', resources)).toBe(10);
  });

  it('returns 0 for unrecognized expressions', () => {
    expect(evaluateExpression('nonsense!!', resources)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// StateMachineGame: initialization
// ---------------------------------------------------------------------------

describe('StateMachineGame', () => {
  describe('constructor validation', () => {
    it('throws without a definition', () => {
      expect(() => new StateMachineGame()).toThrow('requires a definition');
    });

    it('rejects more than 30 states', () => {
      const states = Array.from({ length: 31 }, (_, i) => ({ name: `s${i}` }));
      expect(
        () => new StateMachineGame({ definition: makeDefinition({ states, initialState: 's0' }) }),
      ).toThrow('Too many states');
    });

    it('rejects more than 15 resources', () => {
      const resources: Record<string, { initial: number }> = {};
      for (let i = 0; i < 16; i++) {
        resources[`r${i}`] = { initial: 0 };
      }
      expect(() => new StateMachineGame({ definition: makeDefinition({ resources }) })).toThrow(
        'Too many resources',
      );
    });

    it('rejects more than 15 actions per state', () => {
      const actions: Record<string, Array<{ name: string; effects: [] }>> = {
        start: Array.from({ length: 16 }, (_, i) => ({ name: `a${i}`, effects: [] })),
      };
      expect(() => new StateMachineGame({ definition: makeDefinition({ actions }) })).toThrow(
        'Too many actions',
      );
    });

    it('rejects unknown initial state', () => {
      expect(
        () => new StateMachineGame({ definition: makeDefinition({ initialState: 'nowhere' }) }),
      ).toThrow('not found in states');
    });
  });

  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('sets resources to initial values', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const resources = data.resources as Record<string, number>;
      expect(resources.hp).toBe(10);
      expect(resources.gold).toBe(0);
    });

    it('sets current state to initialState', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentState).toBe('start');
    });

    it('runs onEnter effects for initial state', () => {
      const game = createGame({
        states: [
          { name: 'start', onEnter: [{ resource: 'gold', operation: '+', value: '3' }] },
          { name: 'middle' },
          { name: 'end' },
        ],
      });
      const data = game.getState().data as Record<string, unknown>;
      const resources = data.resources as Record<string, number>;
      expect(resources.gold).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  describe('processAction', () => {
    it('applies action effects', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'rest');
      expect(result.success).toBe(true);
      const resources = (game.getState().data as Record<string, unknown>).resources as Record<
        string,
        number
      >;
      expect(resources.hp).toBe(12);
    });

    it('rejects actions not available in current state', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'fight');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('transitions state when action has transition', () => {
      const game = createGame();
      act(game, 'player-1', 'explore');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentState).toBe('middle');
    });

    it('respects resource min clamp', () => {
      const game = createGame({
        resources: {
          hp: { initial: 2, min: 0, max: 100 },
          gold: { initial: 0, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'hurt',
              effects: [{ resource: 'hp', operation: '-', value: '50' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      act(game, 'player-1', 'hurt');
      const resources = (game.getState().data as Record<string, unknown>).resources as Record<
        string,
        number
      >;
      expect(resources.hp).toBe(0);
    });

    it('respects resource max clamp', () => {
      const game = createGame();
      // Rest many times, hp should cap at 100
      for (let i = 0; i < 50; i++) {
        act(game, 'player-1', 'rest');
      }
      const resources = (game.getState().data as Record<string, unknown>).resources as Record<
        string,
        number
      >;
      expect(resources.hp).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Conditions
  // -------------------------------------------------------------------------

  describe('conditions', () => {
    it('blocks action when condition is not met', () => {
      const game = createGame({
        actions: {
          start: [
            {
              name: 'cast',
              condition: { resource: 'gold', operator: '>=', value: '100' },
              effects: [{ resource: 'hp', operation: '+', value: '5' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      const result = act(game, 'player-1', 'cast');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Condition not met');
    });

    it('allows action when condition is met', () => {
      const game = createGame({
        resources: {
          hp: { initial: 10, min: 0, max: 100 },
          gold: { initial: 200, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'cast',
              condition: { resource: 'gold', operator: '>=', value: '100' },
              effects: [{ resource: 'hp', operation: '+', value: '5' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      const result = act(game, 'player-1', 'cast');
      expect(result.success).toBe(true);
    });

    it('evaluates AND conditions', () => {
      const game = createGame({
        resources: {
          hp: { initial: 10, min: 0, max: 100 },
          gold: { initial: 5, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'power',
              condition: {
                and: [
                  { resource: 'hp', operator: '>', value: '5' },
                  { resource: 'gold', operator: '>', value: '3' },
                ],
              },
              effects: [{ resource: 'hp', operation: '+', value: '1' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      const result = act(game, 'player-1', 'power');
      expect(result.success).toBe(true);
    });

    it('evaluates OR conditions', () => {
      const game = createGame({
        resources: {
          hp: { initial: 1, min: 0, max: 100 },
          gold: { initial: 50, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'escape',
              condition: {
                or: [
                  { resource: 'hp', operator: '<', value: '3' },
                  { resource: 'gold', operator: '>=', value: '100' },
                ],
              },
              effects: [{ resource: 'hp', operation: '+', value: '1' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      const result = act(game, 'player-1', 'escape');
      expect(result.success).toBe(true);
    });

    it('evaluates state conditions', () => {
      const game = createGame({
        actions: {
          start: [
            {
              name: 'check',
              condition: { state: 'start' },
              effects: [{ resource: 'gold', operation: '+', value: '1' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      const result = act(game, 'player-1', 'check');
      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Auto transitions
  // -------------------------------------------------------------------------

  describe('auto transitions', () => {
    it('triggers auto transition when condition is met', () => {
      const game = createGame({
        resources: {
          hp: { initial: 10, min: 0, max: 100 },
          gold: { initial: 9, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'earn',
              effects: [{ resource: 'gold', operation: '+', value: '1' }],
            },
          ],
          middle: [
            {
              name: 'fight',
              effects: [{ resource: 'gold', operation: '+', value: '10' }],
            },
          ],
          end: [],
        },
        transitions: [
          {
            from: 'start',
            to: 'middle',
            condition: { resource: 'gold', operator: '>=', value: '10' },
            auto: true,
          },
        ],
      });
      act(game, 'player-1', 'earn');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentState).toBe('middle');
    });

    it('does not trigger non-auto transitions', () => {
      const game = createGame({
        transitions: [
          {
            from: 'start',
            to: 'end',
            condition: { resource: 'hp', operator: '>', value: '0' },
            auto: false,
          },
        ],
      });
      act(game, 'player-1', 'rest');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentState).toBe('start');
    });

    it('chains multiple auto transitions', () => {
      const game = createGame({
        resources: {
          hp: { initial: 10, min: 0, max: 100 },
          gold: { initial: 4, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'earn',
              effects: [{ resource: 'gold', operation: '+', value: '1' }],
            },
          ],
          middle: [],
          end: [],
        },
        transitions: [
          {
            from: 'start',
            to: 'middle',
            condition: { resource: 'gold', operator: '>=', value: '5' },
            auto: true,
          },
          {
            from: 'middle',
            to: 'end',
            condition: { resource: 'gold', operator: '>=', value: '5' },
            auto: true,
          },
        ],
      });
      act(game, 'player-1', 'earn');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentState).toBe('end');
    });
  });

  // -------------------------------------------------------------------------
  // Per-turn effects
  // -------------------------------------------------------------------------

  describe('perTurnEffects', () => {
    it('applies per-turn effects after each action', () => {
      const game = createGame({
        perTurnEffects: [{ resource: 'hp', operation: '-', value: '1' }],
      });
      act(game, 'player-1', 'rest'); // hp: 10+2=12, then per-turn: 12-1=11
      const resources = (game.getState().data as Record<string, unknown>).resources as Record<
        string,
        number
      >;
      expect(resources.hp).toBe(11);
    });
  });

  // -------------------------------------------------------------------------
  // Win / Lose
  // -------------------------------------------------------------------------

  describe('win and lose conditions', () => {
    it('detects win condition', () => {
      const game = createGame({
        resources: {
          hp: { initial: 10, min: 0, max: 100 },
          gold: { initial: 15, min: 0 },
        },
      });
      act(game, 'player-1', 'explore'); // gold: 15+5=20 -> win
      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBe('player-1');
    });

    it('detects lose condition', () => {
      const game = createGame({
        resources: {
          hp: { initial: 1, min: 0, max: 100 },
          gold: { initial: 0, min: 0 },
        },
        actions: {
          start: [
            {
              name: 'hurt',
              effects: [{ resource: 'hp', operation: '-', value: '5' }],
            },
          ],
          middle: [],
          end: [],
        },
      });
      act(game, 'player-1', 'hurt'); // hp clamped to 0 -> lose
      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBeNull();
    });

    it('rejects actions after game ends', () => {
      const game = createGame({
        resources: {
          hp: { initial: 10, min: 0, max: 100 },
          gold: { initial: 20, min: 0 },
        },
      });
      act(game, 'player-1', 'rest'); // triggers win (gold already >= 20)
      const result = act(game, 'player-1', 'rest');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already over');
    });
  });

  // -------------------------------------------------------------------------
  // Scores
  // -------------------------------------------------------------------------

  describe('scores', () => {
    it('returns sum of all resources as score', () => {
      const game = createGame();
      act(game, 'player-1', 'explore'); // gold: 0+5=5, hp: 10
      const scores = game.getScores();
      expect(scores['player-1']).toBe(15); // 10 + 5
    });
  });

  // -------------------------------------------------------------------------
  // Multiplayer
  // -------------------------------------------------------------------------

  describe('multiplayer', () => {
    it('enforces turn order', () => {
      const game = createGame({}, 2);
      const r1 = act(game, 'player-2', 'rest');
      expect(r1.success).toBe(false);
      expect(r1.error).toContain('Not your turn');

      const r2 = act(game, 'player-1', 'rest');
      expect(r2.success).toBe(true);

      const r3 = act(game, 'player-2', 'rest');
      expect(r3.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Complete game playthrough
  // -------------------------------------------------------------------------

  describe('complete playthrough', () => {
    it('plays a full game to win', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);

      // explore: gold 0->5, state start->middle
      act(game, 'player-1', 'explore');
      expect((game.getState().data as Record<string, unknown>).currentState).toBe('middle');

      // fight: hp 10->7, gold 5->15, state middle->end
      act(game, 'player-1', 'fight');
      expect((game.getState().data as Record<string, unknown>).currentState).toBe('end');

      // collect x5: gold 15->20
      for (let i = 0; i < 5; i++) {
        act(game, 'player-1', 'collect');
      }

      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBe('player-1');
      const scores = game.getScores();
      expect(scores['player-1']).toBe(27); // hp=7, gold=20
    });

    it('plays a full game to lose', () => {
      const game = createGame({
        resources: {
          hp: { initial: 3, min: 0, max: 100 },
          gold: { initial: 0, min: 0 },
        },
      });

      // explore: gold 0->5, state -> middle
      act(game, 'player-1', 'explore');
      // fight: hp 3->0, gold 5->15, state -> end
      act(game, 'player-1', 'fight');

      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Invalid player
  // -------------------------------------------------------------------------

  describe('invalid player', () => {
    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'rest');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a valid player');
    });
  });

  // -------------------------------------------------------------------------
  // restoreState
  // -------------------------------------------------------------------------

  describe('restoreState', () => {
    it('restores and continues a game', () => {
      const game = createGame();
      act(game, 'player-1', 'explore');
      const savedState = game.getState();

      // Create a new instance and restore
      const game2 = new StateMachineGame({ definition: makeDefinition() });
      game2.restoreState(['player-1'], savedState);

      // Should be able to continue from middle state
      const result = act(game2, 'player-1', 'fight');
      expect(result.success).toBe(true);
      expect((game2.getState().data as Record<string, unknown>).currentState).toBe('end');
    });
  });

  // -------------------------------------------------------------------------
  // JSON round-trip (Prisma Json / Redis serialization)
  // -------------------------------------------------------------------------

  describe('JSON round-trip (Prisma/Redis)', () => {
    it('accepts wrapped config after JSON round-trip', () => {
      const def = makeDefinition();
      const config = { definition: def };
      const roundTripped = JSON.parse(JSON.stringify(config));
      const game = new StateMachineGame(roundTripped);
      game.initialize(['player-1']);
      expect(game.getState().phase).toBe('playing');
    });

    it('accepts flat config after JSON round-trip', () => {
      const def = makeDefinition();
      const roundTripped = JSON.parse(JSON.stringify(def));
      const game = new StateMachineGame(roundTripped);
      game.initialize(['player-1']);
      expect(game.getState().phase).toBe('playing');
    });

    it('handles double-wrapped config (definition.definition)', () => {
      const def = makeDefinition();
      const doubleWrapped = { definition: { definition: def } };
      const game = new StateMachineGame(doubleWrapped);
      game.initialize(['player-1']);
      expect(game.getState().phase).toBe('playing');
    });

    it('handles double-stringified config (string inside Json column)', () => {
      const def = makeDefinition();
      const config = { definition: def };
      const stringified = JSON.stringify(config);
      // Prisma Json column could end up as a string if double-serialized
      const roundTripped = JSON.parse(JSON.stringify(stringified));
      // roundTripped is now a string
      const parsed = typeof roundTripped === 'string' ? JSON.parse(roundTripped) : roundTripped;
      const game = new StateMachineGame(parsed);
      game.initialize(['player-1']);
      expect(game.getState().phase).toBe('playing');
    });

    it('plays a full game after JSON round-trip via Redis pattern', () => {
      const def = makeDefinition();
      const config = { definition: def };
      // Simulate: Prisma -> session -> Redis stringify -> Redis parse
      const session = { gameConfig: config };
      const redisRoundTripped = JSON.parse(JSON.stringify(session));
      const game = new StateMachineGame(redisRoundTripped.gameConfig);
      game.initialize(['player-1']);

      const r1 = act(game, 'player-1', 'explore');
      expect(r1.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentState).toBe('middle');
    });
  });

  // -------------------------------------------------------------------------
  // Improved error messages
  // -------------------------------------------------------------------------

  describe('error messages', () => {
    it('shows received data structure when definition is missing', () => {
      expect(() => new StateMachineGame({ foo: 'bar' })).toThrow('Received keys: [foo]');
      expect(() => new StateMachineGame({ foo: 'bar' })).toThrow('Preview:');
    });

    it('shows preview when states are missing', () => {
      const badDef = { name: 'Bad', description: 'No states' };
      expect(() => new StateMachineGame({ definition: badDef as never })).toThrow('preview:');
    });
  });

  // -------------------------------------------------------------------------
  // Simplified/MCP bot schema normalization
  // -------------------------------------------------------------------------

  describe('simplified schema normalization', () => {
    it('accepts actions as string arrays and plays through', () => {
      const game = new StateMachineGame({
        definition: {
          name: 'Simple',
          description: 'test',
          states: [{ name: 'start' }, { name: 'win' }],
          initialState: 'start',
          resources: { gold: { initial: 0 } },
          actions: { start: ['explore'], win: [] },
          transitions: [
            {
              from: 'start',
              action: 'explore',
              to: 'start',
              effects: [{ type: 'modify_resource', resource: 'gold', amount: 50 }],
            },
          ],
          winConditions: [{ type: 'resource_threshold', resource: 'gold', threshold: 100 }],
        },
      });
      game.initialize(['p1']);
      const r1 = act(game, 'p1', 'explore');
      expect(r1.success).toBe(true);
      const data = game.getState().data as Record<string, unknown>;
      const res = data.resources as Record<string, number>;
      expect(res.gold).toBe(50);
    });

    it('normalizes plain number resources', () => {
      const game = new StateMachineGame({
        definition: {
          name: 'NumRes',
          description: 'test',
          states: [{ name: 'start' }],
          initialState: 'start',
          resources: { gold: 0, hp: 10 },
          actions: {
            start: [{ name: 'earn', effects: [{ resource: 'gold', operation: '+', value: '5' }] }],
          },
          transitions: [],
          winCondition: { resource: 'gold', operator: '>=', value: '100' },
          loseCondition: { resource: 'hp', operator: '<=', value: '0' },
        },
      });
      game.initialize(['p1']);
      const r = act(game, 'p1', 'earn');
      expect(r.success).toBe(true);
      const res = (game.getState().data as Record<string, unknown>).resources as Record<
        string,
        number
      >;
      expect(res.gold).toBe(5);
      expect(res.hp).toBe(10);
    });

    it('handles the exact tester schema end-to-end', () => {
      const testerSchema = {
        definition: {
          initialState: 'start',
          resources: { gold: 0 },
          states: [{ name: 'start' }, { name: 'win' }],
          actions: { start: ['explore'], win: [] },
          transitions: [
            {
              from: 'start',
              action: 'explore',
              to: 'start',
              effects: [{ type: 'modify_resource', resource: 'gold', amount: 50 }],
            },
          ],
          winConditions: [{ type: 'resource_threshold', resource: 'gold', threshold: 100 }],
        },
      };
      const game = new StateMachineGame(testerSchema);
      game.initialize(['p1']);

      // First explore: gold 0 -> 50
      const r1 = act(game, 'p1', 'explore');
      expect(r1.success).toBe(true);
      expect(
        ((game.getState().data as Record<string, unknown>).resources as Record<string, number>)
          .gold,
      ).toBe(50);

      // Second explore: gold 50 -> 100 => win
      const r2 = act(game, 'p1', 'explore');
      expect(r2.success).toBe(true);
      expect(game.isGameOver()).toBe(true);
      expect(game.getWinner()).toBe('p1');
    });

    it('handles negative effect amounts', () => {
      const game = new StateMachineGame({
        definition: {
          name: 'NegEffect',
          description: 'test',
          states: [{ name: 'start' }],
          initialState: 'start',
          resources: { hp: 10 },
          actions: { start: ['hurt'] },
          transitions: [
            {
              from: 'start',
              action: 'hurt',
              to: 'start',
              effects: [{ type: 'modify_resource', resource: 'hp', amount: -3 }],
            },
          ],
          loseConditions: [{ type: 'resource_threshold', resource: 'hp', threshold: 0 }],
        },
      });
      game.initialize(['p1']);
      const r = act(game, 'p1', 'hurt');
      expect(r.success).toBe(true);
      const hp = (
        (game.getState().data as Record<string, unknown>).resources as Record<string, number>
      ).hp;
      expect(hp).toBe(7);
    });
  });
});

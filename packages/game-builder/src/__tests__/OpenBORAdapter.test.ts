import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenBORAdapter, INPUT_MAP } from '../adapters/OpenBORAdapter.js';
import type { OpenBORBridgeLike, FighterSnapshot } from '../adapters/OpenBORAdapter.js';

// =========================================================================
// Mock bridge factory
// =========================================================================

function createMockBridge(overrides?: Partial<OpenBORBridgeLike>): OpenBORBridgeLike {
  const defaultFighter: FighterSnapshot = {
    health: 1000,
    maxHealth: 1000,
    magic: 0,
    x: 200,
    y: 400,
    vx: 0,
    vy: 0,
    facing: 'right',
    state: 'idle',
    grounded: true,
  };

  let frameCount = 0;
  let lastP1Input: Record<string, boolean | undefined> = {};
  let lastP2Input: Record<string, boolean | undefined> = {};
  let matchPhase = 'fighting';
  let matchWinner: string | null = null;

  return {
    initialize: vi.fn(async () => {}),
    startMatch: vi.fn(),
    setPlayerInput: vi.fn((playerId: 1 | 2, input: Record<string, boolean | undefined>) => {
      if (playerId === 1) lastP1Input = input;
      else lastP2Input = input;
    }),
    tick: vi.fn(() => {
      frameCount++;
      return {
        phase: matchPhase,
        winner: matchWinner,
        frameNumber: frameCount,
        player1: { ...defaultFighter, x: 200 },
        player2: { ...defaultFighter, x: 1720, facing: 'left' as const },
        roundNumber: 1,
        roundsP1: 0,
        roundsP2: 0,
        timeRemaining: 99,
        matchId: 'test-match',
        player1BotId: 'p1',
        player2BotId: 'p2',
      };
    }),
    getMatchState: vi.fn(() => ({
      phase: matchPhase,
      winner: matchWinner,
      frameNumber: frameCount,
      player1: { ...defaultFighter, x: 200 },
      player2: { ...defaultFighter, x: 1720, facing: 'left' as const },
      roundNumber: 1,
      roundsP1: 0,
      roundsP2: 0,
      timeRemaining: 99,
      matchId: 'test-match',
      player1BotId: 'p1',
      player2BotId: 'p2',
    })),
    isMatchRunning: vi.fn(() => true),
    getFrameNumber: vi.fn(() => frameCount),
    getGameConfig: vi.fn(() => ({
      startingHealth: 1000,
      roundsToWin: 2,
      roundTimeSeconds: 99,
      tickRate: 60,
    })),
    dispose: vi.fn(),
    // Expose setters for test control
    _setPhase: (phase: string) => {
      matchPhase = phase;
    },
    _setWinner: (w: string | null) => {
      matchWinner = w;
    },
    _getP1Input: () => lastP1Input,
    _getP2Input: () => lastP2Input,
    ...overrides,
  } as OpenBORBridgeLike & {
    _setPhase: (p: string) => void;
    _setWinner: (w: string | null) => void;
    _getP1Input: () => Record<string, boolean | undefined>;
    _getP2Input: () => Record<string, boolean | undefined>;
  };
}

// =========================================================================
// Helpers
// =========================================================================

function createAdapter(
  config: Record<string, unknown> = {},
  playerCount = 2,
): { adapter: OpenBORAdapter; bridge: ReturnType<typeof createMockBridge> } {
  const bridge = createMockBridge();
  const adapter = new OpenBORAdapter(config);
  adapter.setBridge(bridge);
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  adapter.initialize(players);
  return { adapter, bridge };
}

function act(adapter: OpenBORAdapter, playerId: string, input: number | string) {
  return adapter.handleAction(playerId, {
    type: 'realtime_input',
    payload: { input },
    timestamp: Date.now(),
  });
}

// =========================================================================
// Tests
// =========================================================================

describe('OpenBORAdapter', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const { adapter } = createAdapter();
      expect(adapter.getState().phase).toBe('playing');
    });

    it('stores engine type in state data', () => {
      const { adapter } = createAdapter();
      expect(adapter.getState().data.engine).toBe('openbor');
    });

    it('initializes fighter data for both players', () => {
      const { adapter } = createAdapter();
      const data = adapter.getState().data;
      const fighters = data.fighters as Record<string, { health: number }>;
      expect(fighters['player-1']).toBeDefined();
      expect(fighters['player-2']).toBeDefined();
      expect(fighters['player-1'].health).toBe(1000);
    });

    it('calls bridge.startMatch with player IDs', () => {
      const { bridge } = createAdapter();
      expect(bridge.startMatch).toHaveBeenCalledWith(expect.any(String), 'player-1', 'player-2');
    });

    it('respects custom config', () => {
      const { adapter } = createAdapter({
        fightStyle: 'arena',
        roundsToWin: 3,
        tickRate: 30,
        startingHealth: 500,
      });
      const data = adapter.getState().data;
      expect(data.fightStyle).toBe('arena');
      expect(data.roundsToWin).toBe(3);
      expect(data.tickRate).toBe(30);
      expect(data.startingHealth).toBe(500);
      expect(adapter.tickRate).toBe(30);
    });

    it('defaults tickRate to 60', () => {
      const { adapter } = createAdapter();
      expect(adapter.tickRate).toBe(60);
    });

    it('sets bridge via setBridge/getBridge', () => {
      const bridge = createMockBridge();
      const adapter = new OpenBORAdapter();
      expect(adapter.getBridge()).toBeNull();
      adapter.setBridge(bridge);
      expect(adapter.getBridge()).toBe(bridge);
    });
  });

  describe('input buffering (processAction)', () => {
    it('accepts numeric input bitfield', () => {
      const { adapter } = createAdapter();
      const result = act(adapter, 'player-1', 0b00010001); // move_left + attack1
      expect(result.success).toBe(true);
    });

    it('accepts named string input', () => {
      const { adapter } = createAdapter();
      const result = act(adapter, 'player-1', 'move_left');
      expect(result.success).toBe(true);
    });

    it('accepts pipe-delimited combined input', () => {
      const { adapter } = createAdapter();
      const result = act(adapter, 'player-1', 'move_right|attack1');
      expect(result.success).toBe(true);
    });

    it('rejects actions from non-players', () => {
      const { adapter } = createAdapter();
      const result = act(adapter, 'hacker', 'attack1');
      expect(result.success).toBe(false);
      // BaseGame rejects with "Not a valid player" before processAction runs
      expect(result.error).toContain('Not a valid player');
    });

    it('rejects actions after match end', () => {
      const { adapter, bridge } = createAdapter();
      // Force match end by ticking with match_end phase
      (
        bridge as ReturnType<typeof createMockBridge> & { _setPhase: (p: string) => void }
      )._setPhase('match_end');
      adapter.tick();
      const result = act(adapter, 'player-1', 'attack1');
      expect(result.success).toBe(false);
      // BaseGame rejects with "Game is already over" before processAction runs
      expect(result.error).toContain('Game is already over');
    });
  });

  describe('INPUT_MAP', () => {
    it('maps move_left to bit 0', () => {
      expect(INPUT_MAP.move_left).toBe(0b00000001);
    });

    it('maps move_right to bit 1', () => {
      expect(INPUT_MAP.move_right).toBe(0b00000010);
    });

    it('maps attack1 to bit 4', () => {
      expect(INPUT_MAP.attack1).toBe(0b00010000);
    });

    it('maps special to bit 7', () => {
      expect(INPUT_MAP.special).toBe(0b10000000);
    });

    it('has all 8 actions defined', () => {
      expect(Object.keys(INPUT_MAP)).toHaveLength(8);
    });
  });

  describe('tick()', () => {
    it('increments frame number', () => {
      const { adapter } = createAdapter();
      const snap1 = adapter.tick();
      expect(snap1.frame).toBe(1);
      const snap2 = adapter.tick();
      expect(snap2.frame).toBe(2);
    });

    it('calls bridge.tick()', () => {
      const { adapter, bridge } = createAdapter();
      adapter.tick();
      expect(bridge.tick).toHaveBeenCalled();
    });

    it('returns fighter data in snapshot', () => {
      const { adapter } = createAdapter();
      const snap = adapter.tick();
      expect(snap.fighters['player-1']).toBeDefined();
      expect(snap.fighters['player-2']).toBeDefined();
      expect(snap.fighters['player-1'].health).toBe(1000);
    });

    it('returns match state in snapshot', () => {
      const { adapter } = createAdapter();
      const snap = adapter.tick();
      expect(snap.matchState.phase).toBe('fighting');
      expect(snap.matchState.roundNumber).toBe(1);
      expect(snap.matchState.timeRemaining).toBe(99);
    });

    it('flushes buffered inputs to bridge', () => {
      const { adapter, bridge } = createAdapter();
      act(adapter, 'player-1', 'move_left|attack1');
      adapter.tick();

      expect(bridge.setPlayerInput).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          left: true,
          attack1: true,
          right: false,
        }),
      );
    });

    it('clears input buffer after tick', () => {
      const { adapter, bridge } = createAdapter();
      act(adapter, 'player-1', 'attack1');
      adapter.tick();

      // Reset the mock call count
      (bridge.setPlayerInput as ReturnType<typeof vi.fn>).mockClear();

      // Second tick should not send any input
      adapter.tick();
      // setPlayerInput should NOT have been called with non-zero input
      // (no input was buffered for this tick)
      for (const call of (bridge.setPlayerInput as ReturnType<typeof vi.fn>).mock.calls) {
        const input = call[1] as Record<string, boolean>;
        // All should be false since buffer was cleared
        expect(input.left).toBe(false);
        expect(input.attack1).toBe(false);
      }
    });

    it('syncs state.data from snapshot', () => {
      const { adapter } = createAdapter();
      adapter.tick();
      const data = adapter.getState().data;
      expect(data.frameNumber).toBe(1);
      expect(data.phase).toBe('fighting');
    });

    it('works without bridge (no-op tick)', () => {
      const adapter = new OpenBORAdapter();
      adapter.initialize(['p1', 'p2']);
      const snap = adapter.tick();
      expect(snap.frame).toBe(1);
      expect(snap.fighters.p1.health).toBe(1000);
    });
  });

  describe('game over detection', () => {
    it('detects match end from bridge phase', () => {
      const { adapter, bridge } = createAdapter();
      expect(adapter.isGameOver()).toBe(false);

      const typedBridge = bridge as ReturnType<typeof createMockBridge> & {
        _setPhase: (p: string) => void;
      };
      typedBridge._setPhase('match_end');
      adapter.tick();

      expect(adapter.isGameOver()).toBe(true);
    });

    it('sets state.phase to ended on match end', () => {
      const { adapter, bridge } = createAdapter();
      const typedBridge = bridge as ReturnType<typeof createMockBridge> & {
        _setPhase: (p: string) => void;
      };
      typedBridge._setPhase('match_end');
      adapter.tick();

      expect(adapter.getState().phase).toBe('ended');
    });
  });

  describe('winner and scores', () => {
    it('returns winner from bridge state', () => {
      const { adapter, bridge } = createAdapter();
      const typedBridge = bridge as ReturnType<typeof createMockBridge> & {
        _setPhase: (p: string) => void;
        _setWinner: (w: string | null) => void;
      };

      typedBridge._setPhase('match_end');
      typedBridge._setWinner('player-1');

      // Override the tick mock to return the updated winner
      (bridge.tick as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        phase: 'match_end',
        winner: 'player-1',
        frameNumber: 1,
        player1: {
          health: 500,
          maxHealth: 1000,
          magic: 0,
          x: 200,
          y: 400,
          vx: 0,
          vy: 0,
          facing: 'right',
          state: 'idle',
          grounded: true,
        },
        player2: {
          health: 0,
          maxHealth: 1000,
          magic: 0,
          x: 1720,
          y: 400,
          vx: 0,
          vy: 0,
          facing: 'left',
          state: 'ko',
          grounded: true,
        },
        roundNumber: 3,
        roundsP1: 2,
        roundsP2: 1,
        timeRemaining: 50,
        matchId: 'test-match',
        player1BotId: 'player-1',
        player2BotId: 'player-2',
      });

      adapter.tick();
      expect(adapter.getWinner()).toBe('player-1');
    });

    it('returns round wins as scores', () => {
      const { adapter, bridge } = createAdapter();

      (bridge.tick as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        phase: 'fighting',
        winner: null,
        frameNumber: 1,
        player1: {
          health: 800,
          maxHealth: 1000,
          magic: 10,
          x: 300,
          y: 400,
          vx: 0,
          vy: 0,
          facing: 'right',
          state: 'idle',
          grounded: true,
        },
        player2: {
          health: 600,
          maxHealth: 1000,
          magic: 5,
          x: 1600,
          y: 400,
          vx: 0,
          vy: 0,
          facing: 'left',
          state: 'idle',
          grounded: true,
        },
        roundNumber: 2,
        roundsP1: 1,
        roundsP2: 0,
        timeRemaining: 80,
        matchId: 'test-match',
        player1BotId: 'player-1',
        player2BotId: 'player-2',
      });

      adapter.tick();
      const scores = adapter.getScores();
      expect(scores['player-1']).toBe(1);
      expect(scores['player-2']).toBe(0);
    });

    it('returns null winner before match ends', () => {
      const { adapter } = createAdapter();
      adapter.tick();
      expect(adapter.getWinner()).toBeNull();
    });

    it('returns zero scores before any ticks', () => {
      const { adapter } = createAdapter();
      const scores = adapter.getScores();
      expect(scores['player-1']).toBe(0);
      expect(scores['player-2']).toBe(0);
    });
  });

  describe('computeDelta()', () => {
    it('detects position changes', () => {
      const { adapter } = createAdapter();

      const prev = {
        frame: 1,
        fighters: {
          'player-1': {
            health: 1000,
            maxHealth: 1000,
            magic: 0,
            x: 200,
            y: 400,
            vx: 0,
            vy: 0,
            facing: 'right' as const,
            state: 'idle',
            grounded: true,
          },
          'player-2': {
            health: 1000,
            maxHealth: 1000,
            magic: 0,
            x: 1720,
            y: 400,
            vx: 0,
            vy: 0,
            facing: 'left' as const,
            state: 'idle',
            grounded: true,
          },
        },
        matchState: {
          roundNumber: 1,
          roundsP1: 0,
          roundsP2: 0,
          timeRemaining: 99,
          phase: 'fighting',
          winner: null,
        },
      };

      const cur = {
        ...prev,
        frame: 2,
        fighters: {
          'player-1': { ...prev.fighters['player-1'], x: 210, vx: 5 },
          'player-2': { ...prev.fighters['player-2'] },
        },
      };

      const changes = adapter.computeDelta(prev, cur);
      expect(changes).toHaveLength(1);
      expect(changes[0].playerId).toBe('player-1');
      expect(changes[0].x).toBe(210);
      expect(changes[0].vx).toBe(5);
    });

    it('detects health changes', () => {
      const { adapter } = createAdapter();

      const prev = {
        frame: 1,
        fighters: {
          'player-1': {
            health: 1000,
            maxHealth: 1000,
            magic: 0,
            x: 200,
            y: 400,
            vx: 0,
            vy: 0,
            facing: 'right' as const,
            state: 'idle',
            grounded: true,
          },
          'player-2': {
            health: 1000,
            maxHealth: 1000,
            magic: 0,
            x: 1720,
            y: 400,
            vx: 0,
            vy: 0,
            facing: 'left' as const,
            state: 'idle',
            grounded: true,
          },
        },
        matchState: {
          roundNumber: 1,
          roundsP1: 0,
          roundsP2: 0,
          timeRemaining: 99,
          phase: 'fighting',
          winner: null,
        },
      };

      const cur = {
        ...prev,
        frame: 2,
        fighters: {
          'player-1': { ...prev.fighters['player-1'] },
          'player-2': { ...prev.fighters['player-2'], health: 900 },
        },
      };

      const changes = adapter.computeDelta(prev, cur);
      expect(changes).toHaveLength(1);
      expect(changes[0].playerId).toBe('player-2');
      expect(changes[0].health).toBe(900);
    });

    it('returns empty array when nothing changed', () => {
      const { adapter } = createAdapter();

      const snap = {
        frame: 1,
        fighters: {
          'player-1': {
            health: 1000,
            maxHealth: 1000,
            magic: 0,
            x: 200,
            y: 400,
            vx: 0,
            vy: 0,
            facing: 'right' as const,
            state: 'idle',
            grounded: true,
          },
          'player-2': {
            health: 1000,
            maxHealth: 1000,
            magic: 0,
            x: 1720,
            y: 400,
            vx: 0,
            vy: 0,
            facing: 'left' as const,
            state: 'idle',
            grounded: true,
          },
        },
        matchState: {
          roundNumber: 1,
          roundsP1: 0,
          roundsP2: 0,
          timeRemaining: 99,
          phase: 'fighting',
          winner: null,
        },
      };

      const changes = adapter.computeDelta(snap, { ...snap, frame: 2 });
      expect(changes).toHaveLength(0);
    });
  });

  describe('dispose()', () => {
    it('calls bridge.dispose()', () => {
      const { adapter, bridge } = createAdapter();
      adapter.dispose();
      expect(bridge.dispose).toHaveBeenCalled();
    });

    it('clears bridge reference', () => {
      const { adapter } = createAdapter();
      adapter.dispose();
      expect(adapter.getBridge()).toBeNull();
    });
  });

  describe('getFrameNumber()', () => {
    it('tracks frame count', () => {
      const { adapter } = createAdapter();
      expect(adapter.getFrameNumber()).toBe(0);
      adapter.tick();
      expect(adapter.getFrameNumber()).toBe(1);
      adapter.tick();
      expect(adapter.getFrameNumber()).toBe(2);
    });
  });

  describe('getLastSnapshot()', () => {
    it('returns null before any tick', () => {
      const { adapter } = createAdapter();
      expect(adapter.getLastSnapshot()).toBeNull();
    });

    it('returns last snapshot after tick', () => {
      const { adapter } = createAdapter();
      adapter.tick();
      const snap = adapter.getLastSnapshot();
      expect(snap).not.toBeNull();
      expect(snap!.frame).toBe(1);
    });
  });
});

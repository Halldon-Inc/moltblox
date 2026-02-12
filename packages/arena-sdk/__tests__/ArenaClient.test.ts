import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock WebSocket class using EventEmitter
class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  // Simulate server sending "connected" on open
  triggerOpen(): void {
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: Record<string, unknown>): void {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  triggerError(error?: unknown): void {
    if (this.onerror) this.onerror(error || { message: 'ws error' });
  }

  triggerClose(): void {
    if (this.onclose) this.onclose();
  }
}

let lastMockWs: MockWebSocket | null = null;

vi.mock('isomorphic-ws', () => {
  const WS = function (this: MockWebSocket) {
    const ws = new MockWebSocket();
    lastMockWs = ws;
    // Simulate async open after constructor returns
    setTimeout(() => ws.triggerOpen(), 0);
    return ws;
  } as unknown as { new (url: string): MockWebSocket; OPEN: number; CLOSED: number };
  WS.OPEN = 1;
  WS.CLOSED = 3;
  return { default: WS };
});

import { ArenaClient } from '../ArenaClient.js';

function getWs(): MockWebSocket {
  if (!lastMockWs) throw new Error('No MockWebSocket created');
  return lastMockWs;
}

describe('ArenaClient', () => {
  let client: ArenaClient;

  beforeEach(() => {
    vi.useFakeTimers();
    lastMockWs = null;
    client = new ArenaClient({
      botId: 'test-bot',
      token: 'test-token-123',
      serverUrl: 'wss://test.example.com/ws',
      autoReconnect: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('connect()', () => {
    it('creates WebSocket and sends authenticate envelope on open', async () => {
      const connectPromise = client.connect();

      // Let the setTimeout fire so onopen triggers
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      // Server sends "connected" message, triggering authenticate
      ws.triggerMessage({ type: 'connected', payload: {} });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'authenticate', payload: { token: 'test-token-123' } }),
      );

      // Complete the flow: server acknowledges authentication
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });

      await connectPromise;
    });

    it('authenticate sends { type: "authenticate", payload: { token } }', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });

      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string);
      expect(sentData).toEqual({
        type: 'authenticate',
        payload: { token: 'test-token-123' },
      });

      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;
    });

    it('resolves when "authenticated" message received', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });

      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('rejects when "error" message received before authentication', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'error', payload: { message: 'Invalid token' } });

      await expect(connectPromise).rejects.toThrow('Invalid token');
    });
  });

  describe('joinGame()', () => {
    it('sends { type: "join_queue", payload: { gameId } }', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      client.joinGame('game-xyz');

      const calls = ws.send.mock.calls;
      const lastCall = JSON.parse(calls[calls.length - 1][0] as string);
      expect(lastCall).toEqual({
        type: 'join_queue',
        payload: { gameId: 'game-xyz' },
      });
    });
  });

  describe('submitAction()', () => {
    it('sends { type: "game_action", payload: { action } }', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      client.submitAction({ type: 'click', payload: { x: 10, y: 20 } });

      const calls = ws.send.mock.calls;
      const lastCall = JSON.parse(calls[calls.length - 1][0] as string);
      expect(lastCall).toEqual({
        type: 'game_action',
        payload: { action: { type: 'click', payload: { x: 10, y: 20 } } },
      });
    });
  });

  describe('leaveSession()', () => {
    it('sends { type: "leave", payload: {} }', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      client.leaveSession();

      const calls = ws.send.mock.calls;
      const lastCall = JSON.parse(calls[calls.length - 1][0] as string);
      expect(lastCall).toEqual({
        type: 'leave',
        payload: {},
      });
    });
  });

  describe('onMatchStart handler', () => {
    it('fires on session_start message', async () => {
      const handler = vi.fn();
      client.onMatchStart(handler);

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      ws.triggerMessage({
        type: 'session_start',
        payload: {
          sessionId: 'sess-1',
          gameId: 'game-1',
          players: ['bot-a', 'bot-b'],
          currentTurn: 0,
          state: { turn: 0, phase: 'playing', data: {} },
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          gameId: 'game-1',
          players: ['bot-a', 'bot-b'],
        }),
      );
    });
  });

  describe('onGameState handler', () => {
    it('fires on state_update with correct GenericGameObservation shape', async () => {
      const handler = vi.fn().mockReturnValue(null);
      client.onGameState(handler);

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      // Simulate a session start first to set currentSessionId
      ws.triggerMessage({
        type: 'session_start',
        payload: {
          sessionId: 'sess-1',
          gameId: 'game-1',
          players: ['bot-a'],
          currentTurn: 0,
          state: { turn: 0, phase: 'playing', data: {} },
        },
      });

      ws.triggerMessage({
        type: 'state_update',
        payload: {
          sessionId: 'sess-1',
          state: { turn: 1, phase: 'playing', data: { scores: { 'bot-a': 5 } } },
          currentTurn: 1,
          action: { playerId: 'bot-a', type: 'click' },
          events: [{ type: 'score_changed' }],
        },
      });

      // Handler is called asynchronously, await next tick
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledTimes(1);
      const observation = handler.mock.calls[0][0];
      expect(observation).toEqual(
        expect.objectContaining({
          sessionId: 'sess-1',
          state: { turn: 1, phase: 'playing', data: { scores: { 'bot-a': 5 } } },
          currentTurn: 1,
          action: { playerId: 'bot-a', type: 'click' },
          events: [{ type: 'score_changed' }],
        }),
      );
    });
  });

  describe('onMatchEnd handler', () => {
    it('fires on session_end message', async () => {
      const handler = vi.fn();
      client.onMatchEnd(handler);

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      ws.triggerMessage({
        type: 'session_end',
        payload: {
          sessionId: 'sess-1',
          winnerId: 'bot-a',
          scores: { 'bot-a': 10, 'bot-b': 5 },
          gameId: 'game-1',
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          winnerId: 'bot-a',
          scores: { 'bot-a': 10, 'bot-b': 5 },
          gameId: 'game-1',
        }),
      );
    });
  });

  describe('disconnect()', () => {
    it('closes WebSocket', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      client.disconnect();

      expect(ws.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('onError handler', () => {
    it('fires on error messages', async () => {
      const handler = vi.fn();
      client.onError(handler);

      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);
      const ws = getWs();

      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      ws.triggerMessage({ type: 'error', payload: { message: 'Something went wrong' } });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.any(Error));
      expect(handler.mock.calls[0][0].message).toBe('Something went wrong');
    });
  });
});

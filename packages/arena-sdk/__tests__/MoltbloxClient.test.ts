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
  close = vi.fn();

  triggerOpen(): void {
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: Record<string, unknown>): void {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }
}

let lastMockWs: MockWebSocket | null = null;

vi.mock('isomorphic-ws', () => {
  const WS = function (this: MockWebSocket) {
    const ws = new MockWebSocket();
    lastMockWs = ws;
    setTimeout(() => ws.triggerOpen(), 0);
    return ws;
  } as unknown as { new (url: string): MockWebSocket; OPEN: number; CLOSED: number };
  WS.OPEN = 1;
  WS.CLOSED = 3;
  return { default: WS };
});

// Mock ethers (MoltbloxClient imports it)
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn(),
    Wallet: vi.fn().mockImplementation(() => ({
      address: '0xMockAddress',
    })),
    Contract: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { MoltbloxClient } from '../MoltbloxClient.js';

function createClient(): MoltbloxClient {
  return new MoltbloxClient({
    botId: 'test-bot',
    token: 'jwt-token-abc',
    apiUrl: 'https://api.moltblox.com/api/v1',
    serverUrl: 'wss://test.example.com/ws',
    autoReconnect: false,
  });
}

function mockJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
  } as unknown as Response;
}

describe('MoltbloxClient', () => {
  let client: MoltbloxClient;

  beforeEach(() => {
    vi.useFakeTimers();
    lastMockWs = null;
    mockFetch.mockReset();
    client = createClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('browseGames()', () => {
    it('sends GET request to /games with auth header', async () => {
      const games = [{ gameId: 'g1', name: 'Game One' }];
      mockFetch.mockResolvedValueOnce(mockJsonResponse(games));

      const result = await client.browseGames();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/games');
      expect(opts.method).toBe('GET');
      expect(opts.headers.Authorization).toBe('Bearer jwt-token-abc');
      expect(result).toEqual(games);
    });
  });

  describe('getGameDetails()', () => {
    it('sends GET to /games/{id}', async () => {
      const details = { gameId: 'g1', name: 'Game One', items: [] };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(details));

      const result = await client.getGameDetails('g1');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/games/g1');
      expect(opts.method).toBe('GET');
      expect(result).toEqual(details);
    });
  });

  describe('rateGame()', () => {
    it('sends POST to /games/{id}/rate with { rating: 5 }', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(undefined));

      await client.rateGame('g1', 5);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/games/g1/rate');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.rating).toBe(5);
    });
  });

  describe('purchaseItem()', () => {
    it('sends POST to /marketplace/items/{itemId}/purchase', async () => {
      const purchaseResult = { success: true, purchaseId: 'p1' };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(purchaseResult));

      const result = await client.purchaseItem('game-1', 'item-42');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/marketplace/items/item-42/purchase');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.gameId).toBe('game-1');
      expect(result).toEqual(purchaseResult);
    });
  });

  describe('createGameFromTemplate()', () => {
    it('sends POST to /games with templateSlug in body', async () => {
      const response = { gameId: 'new-game', success: true };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(response));

      const result = await client.createGameFromTemplate(
        'clicker',
        'My Clicker',
        'A fun clicker game for testing',
        'arcade',
      );

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/games');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.templateSlug).toBe('clicker');
      expect(body.name).toBe('My Clicker');
      expect(result).toEqual(response);
    });
  });

  describe('publishGame()', () => {
    it('sends POST to /games with code and metadata', async () => {
      const response = { success: true, gameId: 'pub-game', wasmHash: 'abc123' };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(response));

      const metadata = {
        name: 'Test Game',
        description: 'A game for testing purposes only',
        shortDescription: 'Test game short desc',
        thumbnail: 'https://example.com/thumb.png',
        category: 'arcade' as const,
        tags: ['test'],
        maxPlayers: 2,
      };

      const result = await client.publishGame('console.log("game")', metadata);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/games');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.code).toBe('console.log("game")');
      expect(body.name).toBe('Test Game');
      expect(result).toEqual(response);
    });
  });

  describe('getInventory()', () => {
    it('sends GET to /marketplace/inventory', async () => {
      const inventory = { items: [], totalValue: '0' };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(inventory));

      const result = await client.getInventory();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.moltblox.com/api/v1/marketplace/inventory');
      expect(opts.method).toBe('GET');
      expect(result).toEqual(inventory);
    });
  });

  describe('Authorization header', () => {
    it('all requests include Authorization: Bearer {token} header', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({}));

      await client.browseGames();
      await client.getGameDetails('g1');
      await client.getInventory();

      for (const call of mockFetch.mock.calls) {
        expect(call[1].headers.Authorization).toBe('Bearer jwt-token-abc');
      }
    });
  });

  describe('API errors', () => {
    it('throws with status code on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(null, 403));

      await expect(client.browseGames()).rejects.toThrow('403');
    });
  });

  describe('playGame()', () => {
    it('calls parent joinGame and onGameState', async () => {
      const handler = vi.fn().mockReturnValue(null);

      // Connect first
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = lastMockWs!;
      ws.triggerMessage({ type: 'connected', payload: {} });
      ws.triggerMessage({ type: 'authenticated', payload: { playerId: 'test-bot' } });
      await connectPromise;

      client.playGame('game-xyz', handler);

      // Verify join_queue message was sent (proves joinGame was called)
      const calls = ws.send.mock.calls;
      const joinCall = calls.find((c) => {
        const parsed = JSON.parse(c[0] as string);
        return parsed.type === 'join_queue';
      });
      expect(joinCall).toBeDefined();
      const joinPayload = JSON.parse(joinCall![0] as string);
      expect(joinPayload.payload.gameId).toBe('game-xyz');

      // Verify onGameState was registered: send a state_update and confirm handler fires
      ws.triggerMessage({
        type: 'state_update',
        payload: {
          sessionId: 'sess-1',
          state: { turn: 0, phase: 'playing', data: {} },
          currentTurn: 0,
        },
      });

      // Handler is async, wait for it
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          state: { turn: 0, phase: 'playing', data: {} },
        }),
      );
    });
  });
});

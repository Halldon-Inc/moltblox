/**
 * Spectator Hub
 *
 * Manages real-time broadcasting of game state to spectators.
 * Handles WebSocket connections, frame buffering, and replay support.
 */

import type { GameState } from '@moltblox/protocol';
import type { GameEvent } from '../interfaces/UGI';

// =============================================================================
// Types
// =============================================================================

export interface SpectatorConnection {
  id: string;
  matchId: string;
  quality: 'low' | 'medium' | 'high';
  lastHeartbeat: number;
  sendFrame: (frame: BroadcastFrame) => void;
  close: () => void;
}

export interface BroadcastFrame {
  type: 'full' | 'delta';
  matchId: string;
  tick: number;
  timestamp: number;
  state?: unknown;
  delta?: StateDelta;
  events: BroadcastEvent[];
  highlights?: Highlight[];
}

export interface StateDelta {
  fromTick: number;
  toTick: number;
  changes: DeltaChange[];
}

export interface DeltaChange {
  path: string;
  op: 'add' | 'remove' | 'replace';
  value?: unknown;
  oldValue?: unknown;
}

export interface BroadcastEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface Highlight {
  type: string;
  description: string;
  tick: number;
  playerId?: string;
}

export interface SpectatorHubConfig {
  /** Frames per second for spectators */
  broadcastFps: number;

  /** How many frames to buffer for rewind */
  bufferSize: number;

  /** Heartbeat timeout in ms */
  heartbeatTimeout: number;

  /** Send full state every N frames */
  fullStateInterval: number;
}

// =============================================================================
// Spectator Hub Implementation
// =============================================================================

export class SpectatorHub {
  private config: SpectatorHubConfig;
  private connections: Map<string, Map<string, SpectatorConnection>> = new Map();
  private stateBuffers: Map<string, BroadcastFrame[]> = new Map();
  private lastFullState: Map<string, unknown> = new Map();
  private frameCounters: Map<string, number> = new Map();

  constructor(config: Partial<SpectatorHubConfig> = {}) {
    this.config = {
      broadcastFps: 30,
      bufferSize: 300, // 10 seconds at 30fps
      heartbeatTimeout: 30000,
      fullStateInterval: 30, // Full state every 30 frames
      ...config,
    };
  }

  // ============ Connection Management ============

  /**
   * Add a spectator connection
   */
  addSpectator(connection: SpectatorConnection): void {
    const { matchId } = connection;

    if (!this.connections.has(matchId)) {
      this.connections.set(matchId, new Map());
    }

    this.connections.get(matchId)!.set(connection.id, connection);

    // Send current state buffer for catch-up
    const buffer = this.stateBuffers.get(matchId);
    if (buffer && buffer.length > 0) {
      // Send last full state frame
      const fullFrame = buffer.find((f) => f.type === 'full');
      if (fullFrame) {
        connection.sendFrame(fullFrame);
      }
    }
  }

  /**
   * Remove a spectator connection
   */
  removeSpectator(matchId: string, connectionId: string): void {
    const matchConnections = this.connections.get(matchId);
    if (matchConnections) {
      const connection = matchConnections.get(connectionId);
      if (connection) {
        connection.close();
        matchConnections.delete(connectionId);
      }

      // Clean up empty match connections
      if (matchConnections.size === 0) {
        this.connections.delete(matchId);
      }
    }
  }

  /**
   * Get spectator count for a match
   */
  getSpectatorCount(matchId: string): number {
    return this.connections.get(matchId)?.size || 0;
  }

  /**
   * Update heartbeat for a connection
   */
  heartbeat(matchId: string, connectionId: string): void {
    const connection = this.connections.get(matchId)?.get(connectionId);
    if (connection) {
      connection.lastHeartbeat = Date.now();
    }
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections(): void {
    const now = Date.now();

    for (const [matchId, matchConnections] of this.connections) {
      for (const [connId, conn] of matchConnections) {
        if (now - conn.lastHeartbeat > this.config.heartbeatTimeout) {
          this.removeSpectator(matchId, connId);
        }
      }
    }
  }

  // ============ Broadcasting ============

  /**
   * Broadcast a game state update to all spectators
   */
  broadcast(matchId: string, state: unknown, events: GameEvent[]): void {
    const spectators = this.connections.get(matchId);
    if (!spectators || spectators.size === 0) {
      // Still buffer for potential late joiners
      this.bufferFrame(matchId, state, events);
      return;
    }

    const frame = this.createFrame(matchId, state, events);

    // Buffer the frame
    this.bufferFrame(matchId, state, events);

    // Send to all spectators
    for (const connection of spectators.values()) {
      try {
        const adaptedFrame = this.adaptFrameForQuality(frame, connection.quality);
        connection.sendFrame(adaptedFrame);
      } catch (error) {
        console.error(`Failed to send to spectator ${connection.id}:`, error);
        this.removeSpectator(matchId, connection.id);
      }
    }
  }

  /**
   * Create a broadcast frame (full or delta)
   */
  private createFrame(
    matchId: string,
    state: unknown,
    events: GameEvent[]
  ): BroadcastFrame {
    const frameCount = (this.frameCounters.get(matchId) || 0) + 1;
    this.frameCounters.set(matchId, frameCount);

    const shouldSendFull =
      frameCount % this.config.fullStateInterval === 0 ||
      !this.lastFullState.has(matchId);

    const broadcastEvents: BroadcastEvent[] = events.map((e) => ({
      type: e.type,
      data: e.data,
      timestamp: e.timestamp,
    }));

    if (shouldSendFull) {
      this.lastFullState.set(matchId, state);

      return {
        type: 'full',
        matchId,
        tick: frameCount,
        timestamp: Date.now(),
        state,
        events: broadcastEvents,
      };
    }

    // Create delta
    const lastState = this.lastFullState.get(matchId);
    const delta = this.computeDelta(lastState, state, frameCount);

    this.lastFullState.set(matchId, state);

    return {
      type: 'delta',
      matchId,
      tick: frameCount,
      timestamp: Date.now(),
      delta,
      events: broadcastEvents,
    };
  }

  /**
   * Compute delta between two states
   */
  private computeDelta(
    oldState: unknown,
    newState: unknown,
    tick: number
  ): StateDelta {
    const changes: DeltaChange[] = [];
    this.diffObjects(oldState, newState, '', changes);

    return {
      fromTick: tick - 1,
      toTick: tick,
      changes,
    };
  }

  /**
   * Recursively diff two objects
   */
  private diffObjects(
    oldObj: unknown,
    newObj: unknown,
    path: string,
    changes: DeltaChange[]
  ): void {
    if (oldObj === newObj) return;

    if (
      typeof oldObj !== 'object' ||
      typeof newObj !== 'object' ||
      oldObj === null ||
      newObj === null
    ) {
      changes.push({
        path: path || '/',
        op: 'replace',
        value: newObj,
        oldValue: oldObj,
      });
      return;
    }

    const oldKeys = new Set(Object.keys(oldObj as object));
    const newKeys = new Set(Object.keys(newObj as object));

    // Added keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        changes.push({
          path: path ? `${path}.${key}` : key,
          op: 'add',
          value: (newObj as Record<string, unknown>)[key],
        });
      }
    }

    // Removed keys
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        changes.push({
          path: path ? `${path}.${key}` : key,
          op: 'remove',
          oldValue: (oldObj as Record<string, unknown>)[key],
        });
      }
    }

    // Changed keys
    for (const key of oldKeys) {
      if (newKeys.has(key)) {
        this.diffObjects(
          (oldObj as Record<string, unknown>)[key],
          (newObj as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
          changes
        );
      }
    }
  }

  /**
   * Adapt frame for connection quality
   */
  private adaptFrameForQuality(
    frame: BroadcastFrame,
    quality: 'low' | 'medium' | 'high'
  ): BroadcastFrame {
    if (quality === 'high') {
      return frame;
    }

    // For low/medium quality, reduce event detail
    const adapted = { ...frame };

    if (quality === 'low') {
      // Remove non-essential events
      adapted.events = frame.events.filter((e) =>
        ['score', 'death', 'victory'].includes(e.type)
      );
      // Remove highlights
      delete adapted.highlights;
    }

    return adapted;
  }

  // ============ Buffering ============

  /**
   * Buffer a frame for replay/rewind
   */
  private bufferFrame(
    matchId: string,
    state: unknown,
    events: GameEvent[]
  ): void {
    if (!this.stateBuffers.has(matchId)) {
      this.stateBuffers.set(matchId, []);
    }

    const buffer = this.stateBuffers.get(matchId)!;
    const frame = this.createFrame(matchId, state, events);

    buffer.push(frame);

    // Trim buffer if too large
    while (buffer.length > this.config.bufferSize) {
      buffer.shift();
    }
  }

  /**
   * Get buffered frames for replay
   */
  getReplayBuffer(matchId: string, fromTick?: number): BroadcastFrame[] {
    const buffer = this.stateBuffers.get(matchId) || [];

    if (fromTick === undefined) {
      return [...buffer];
    }

    return buffer.filter((f) => f.tick >= fromTick);
  }

  /**
   * Clear buffer for a match
   */
  clearBuffer(matchId: string): void {
    this.stateBuffers.delete(matchId);
    this.lastFullState.delete(matchId);
    this.frameCounters.delete(matchId);
  }

  // ============ Match Lifecycle ============

  /**
   * Initialize broadcasting for a match
   */
  initMatch(matchId: string): void {
    this.connections.set(matchId, new Map());
    this.stateBuffers.set(matchId, []);
    this.frameCounters.set(matchId, 0);
  }

  /**
   * End broadcasting for a match
   */
  endMatch(matchId: string): void {
    // Notify spectators
    const spectators = this.connections.get(matchId);
    if (spectators) {
      for (const connection of spectators.values()) {
        try {
          connection.sendFrame({
            type: 'full',
            matchId,
            tick: -1,
            timestamp: Date.now(),
            events: [{ type: 'match_end', data: {}, timestamp: Date.now() }],
          });
          connection.close();
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    this.connections.delete(matchId);
    // Keep buffer for replay
  }

  // ============ Stats ============

  getStats(): {
    totalSpectators: number;
    matchesWithSpectators: number;
    bufferedMatches: number;
  } {
    let totalSpectators = 0;
    for (const connections of this.connections.values()) {
      totalSpectators += connections.size;
    }

    return {
      totalSpectators,
      matchesWithSpectators: this.connections.size,
      bufferedMatches: this.stateBuffers.size,
    };
  }
}

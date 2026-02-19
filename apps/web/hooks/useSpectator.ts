'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SpectatorState {
  state: Record<string, unknown> | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  error: string | null;
  spectatorCount: number;
  lastUpdateAt: number | null;
}

interface StateUpdatePayload {
  sessionId: string;
  state: Record<string, unknown>;
  currentTurn: number;
  action: Record<string, unknown> | null;
  events: unknown[];
}

interface RealTimeStatePayload {
  sessionId: string;
  frame: number;
  fighters: Record<string, unknown>;
  matchState: Record<string, unknown>;
}

function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}`;
    } catch {
      // fall through to window.location
    }
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '3001';
  return `${protocol}//${host}:${port}`;
}

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useSpectator(sessionId: string) {
  const [spectator, setSpectator] = useState<SpectatorState>({
    state: null,
    isConnected: false,
    isAuthenticated: false,
    error: null,
    spectatorCount: 0,
    lastUpdateAt: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS;
    if (wsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop_spectating', payload: {} }));
      }
      ws.close();
      wsRef.current = null;
    }
    if (mountedRef.current) {
      setSpectator((prev) => ({ ...prev, isConnected: false, isAuthenticated: false }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!sessionId) return;

    function connect() {
      const wsUrl = getWsUrl();
      if (!wsUrl) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        if (mountedRef.current) {
          setSpectator((prev) => ({ ...prev, isConnected: true, error: null }));
        }

        // Authenticate first, then spectate
        const token = typeof window !== 'undefined' ? localStorage.getItem('moltblox_token') : null;
        if (token) {
          ws.send(JSON.stringify({ type: 'authenticate', payload: { token } }));
        } else {
          // Try spectating without auth (server will reject if auth is required)
          ws.send(
            JSON.stringify({ type: 'spectate', payload: { sessionId: sessionIdRef.current } }),
          );
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            // Authentication succeeded: now send spectate request
            case 'authenticated':
              if (mountedRef.current) {
                setSpectator((prev) => ({ ...prev, isAuthenticated: true }));
              }
              ws.send(
                JSON.stringify({
                  type: 'spectate',
                  payload: { sessionId: sessionIdRef.current },
                }),
              );
              break;

            // Confirmed spectating
            case 'spectating':
              if (mountedRef.current) {
                setSpectator((prev) => ({ ...prev, error: null }));
              }
              break;

            // Turn-based game state update
            case 'state_update': {
              const payload = msg.payload as StateUpdatePayload;
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  state: payload.state as Record<string, unknown>,
                  error: null,
                  lastUpdateAt: Date.now(),
                }));
              }
              break;
            }

            // Real-time game full state (tick-based games like fighters)
            case 'realtime_state': {
              const rtPayload = msg.payload as RealTimeStatePayload;
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  state: {
                    frame: rtPayload.frame,
                    fighters: rtPayload.fighters,
                    matchState: rtPayload.matchState,
                    _isRealTime: true,
                  },
                  error: null,
                  lastUpdateAt: Date.now(),
                }));
              }
              break;
            }

            // Real-time delta update (partial state changes)
            case 'realtime_delta': {
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  lastUpdateAt: Date.now(),
                  // Apply delta: merge changes into current state
                  state: prev.state
                    ? {
                        ...prev.state,
                        frame: msg.payload?.frame ?? prev.state.frame,
                        _deltaChanges: msg.payload?.changes,
                      }
                    : prev.state,
                }));
              }
              break;
            }

            // Real-time match end
            case 'realtime_match_end': {
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  state: prev.state
                    ? {
                        ...prev.state,
                        _matchEnded: true,
                        _winner: msg.payload?.winner,
                        _scores: msg.payload?.scores,
                        _finalState: msg.payload?.finalState,
                      }
                    : {
                        _matchEnded: true,
                        _winner: msg.payload?.winner,
                        _scores: msg.payload?.scores,
                      },
                  error: null,
                }));
              }
              break;
            }

            // Real-time countdown
            case 'realtime_countdown': {
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  state: {
                    ...(prev.state || {}),
                    _countdown: msg.payload?.seconds,
                  },
                }));
              }
              break;
            }

            // Chat messages (just update lastUpdateAt to indicate activity)
            case 'chat':
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  lastUpdateAt: Date.now(),
                }));
              }
              break;

            // Session ended
            case 'session_end':
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  error: 'Game session has ended.',
                }));
              }
              break;

            // Player events (for spectator awareness)
            case 'player_disconnected':
            case 'player_left':
            case 'player_reconnected':
              // These are informational; no state change needed
              break;

            // Spectator count update (custom event from server)
            case 'spectator_count':
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  spectatorCount: msg.payload?.count || 0,
                }));
              }
              break;

            // Error handling
            case 'error':
              if (mountedRef.current) {
                setSpectator((prev) => ({
                  ...prev,
                  error: msg.payload?.message || 'Unknown error',
                }));
              }
              break;

            default:
              break;
          }
        } catch {
          // Ignore unparseable messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!mountedRef.current) return;
        setSpectator((prev) => ({ ...prev, isConnected: false, isAuthenticated: false }));

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) {
          setSpectator((prev) => ({
            ...prev,
            error: 'WebSocket connection error',
          }));
        }
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stop_spectating', payload: {} }));
        }
        ws.close();
        wsRef.current = null;
      }
    };
  }, [sessionId]);

  return {
    state: spectator.state,
    isConnected: spectator.isConnected,
    isAuthenticated: spectator.isAuthenticated,
    error: spectator.error,
    spectatorCount: spectator.spectatorCount,
    lastUpdateAt: spectator.lastUpdateAt,
    disconnect,
  };
}

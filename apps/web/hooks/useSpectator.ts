'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SpectatorState {
  state: Record<string, unknown> | null;
  isConnected: boolean;
  error: string | null;
}

interface StateUpdatePayload {
  sessionId: string;
  state: Record<string, unknown>;
  currentTurn: number;
  action: Record<string, unknown> | null;
  events: unknown[];
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
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

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
      setSpectator((prev) => ({ ...prev, isConnected: false }));
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
        // Send spectate request once connected
        ws.send(JSON.stringify({ type: 'spectate', payload: { sessionId } }));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'state_update') {
            const payload = msg.payload as StateUpdatePayload;
            setSpectator((prev) => ({
              ...prev,
              state: payload.state as Record<string, unknown>,
              error: null,
            }));
          } else if (msg.type === 'session_end') {
            setSpectator((prev) => ({
              ...prev,
              error: 'Game session has ended.',
            }));
          } else if (msg.type === 'error') {
            setSpectator((prev) => ({
              ...prev,
              error: msg.payload?.message || 'Unknown error',
            }));
          }
        } catch {
          // Ignore unparseable messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!mountedRef.current) return;
        setSpectator((prev) => ({ ...prev, isConnected: false }));

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
    error: spectator.error,
    disconnect,
  };
}

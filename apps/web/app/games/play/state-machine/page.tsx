'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import StateMachineRenderer from '../renderers/StateMachineRenderer';

interface Resource {
  name: string;
  value: number;
  max?: number;
  icon?: string;
}

interface Action {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  cost?: Record<string, number>;
}

interface SMState {
  currentState: string;
  description?: string;
  resources: Resource[];
  availableActions: Action[];
  isWin?: boolean;
  isLose?: boolean;
  endMessage?: string;
}

interface SessionResponse {
  sessionId: string;
  state: SMState;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function StateMachinePlayPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<SMState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  // Read gameId from URL search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('gameId') || params.get('id');
    setGameId(id);
  }, []);

  // Initialize session
  const initSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (gameId) body.gameId = gameId;

      const res = await fetch(`${API_BASE}/api/v1/play/state-machine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status}`);
      }

      const data: SessionResponse = await res.json();
      setSessionId(data.sessionId);
      setGameState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Submit action
  const handleAction = useCallback(
    async (actionId: string) => {
      if (!sessionId) return;
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/v1/play/state-machine/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Action failed: ${res.status}`);
        }

        const data: { state: SMState } = await res.json();
        setGameState(data.state);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      }
    },
    [sessionId],
  );

  // Restart
  const handleRestart = useCallback(() => {
    setSessionId(null);
    setGameState(null);
    initSession();
  }, [initSession]);

  return (
    <div className="min-h-screen bg-surface-dark pt-20 pb-12">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/games/play" className="btn-ghost flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" />
              All Games
            </Link>
            <h1 className="text-2xl font-display font-bold">State Machine</h1>
          </div>
          <button onClick={handleRestart} className="btn-secondary flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" />
            Restart
          </button>
        </div>

        {/* Main area */}
        <div className="glass-card p-6 relative overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-white/50 text-sm animate-pulse">Loading game...</div>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
              <p className="text-accent-coral text-sm">{error}</p>
              <button onClick={handleRestart} className="btn-primary text-sm">
                Try Again
              </button>
            </div>
          )}

          {gameState && !loading && (
            <StateMachineRenderer gameState={gameState} onAction={handleAction} />
          )}
        </div>
      </div>
    </div>
  );
}

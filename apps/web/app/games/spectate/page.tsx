'use client';

import { useState, useEffect } from 'react';
import { Eye, Users, Clock, Radio } from 'lucide-react';
import SpectatorView from '@/components/games/SpectatorView';
import { useSpectator } from '@/hooks/useSpectator';

interface ActiveSession {
  sessionId: string;
  gameId: string;
  gameName: string;
  templateSlug: string | null;
  playerCount: number;
  startedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function SpectatorPanel({ session, onClose }: { session: ActiveSession; onClose: () => void }) {
  const { state, isConnected, error, disconnect } = useSpectator(session.sessionId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            disconnect();
            onClose();
          }}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to live games
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
          />
          <span className="text-gray-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <SpectatorView
        state={state}
        gameName={session.gameName}
        templateSlug={session.templateSlug}
      />
    </div>
  );
}

export default function SpectatePage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchingSession, setWatchingSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        const res = await fetch(`${API_URL}/games/active-sessions`);
        if (!res.ok) throw new Error('Failed to fetch active sessions');
        const data = await res.json();
        if (!cancelled) {
          setSessions(data.sessions || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sessions');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchSessions();

    // Poll every 15 seconds for updated session list
    const interval = setInterval(fetchSessions, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-white pb-20">
      <div className="page-container pt-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex items-center justify-center w-8 h-8">
              <span className="absolute w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="relative w-3 h-3 rounded-full bg-red-500" />
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight text-black uppercase">
              Live Games
            </h1>
          </div>
          <p className="text-gray-500 text-lg ml-11">Watch active game sessions in real time</p>
        </div>

        {/* Content */}
        {watchingSession ? (
          <SpectatorPanel session={watchingSession} onClose={() => setWatchingSession(null)} />
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-gray-400">{error}</p>
              </div>
            ) : sessions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 group"
                  >
                    {/* Card header with gradient */}
                    <div className="relative h-32 bg-gradient-to-br from-gray-900 to-gray-700 p-5 flex flex-col justify-end">
                      {/* Live indicator */}
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/90 text-white">
                          <Radio className="w-3 h-3" />
                          Live
                        </span>
                      </div>
                      <h3 className="font-display font-black text-xl uppercase tracking-tight text-white leading-tight">
                        {session.gameName}
                      </h3>
                      {session.templateSlug && (
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
                          {session.templateSlug}
                        </span>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-5">
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {timeAgo(session.startedAt)}
                        </span>
                      </div>

                      <button
                        onClick={() => setWatchingSession(session)}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm uppercase tracking-wider rounded-xl py-3 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Watch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Radio className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No active games right now. Check back soon!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

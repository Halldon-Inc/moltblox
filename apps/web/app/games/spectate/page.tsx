'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, Users, Clock, Radio, ArrowLeft } from 'lucide-react';
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
  const { state, isConnected, error, spectatorCount, lastUpdateAt, disconnect } = useSpectator(
    session.sessionId,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            disconnect();
            onClose();
          }}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to live games
        </button>
        <div className="flex items-center gap-4 text-sm">
          {spectatorCount > 0 && (
            <span className="flex items-center gap-1.5 text-white/40">
              <Eye className="w-3.5 h-3.5" />
              {spectatorCount} watching
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-white/30'}`}
            />
            <span className="text-white/50">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-accent-coral/10 border border-accent-coral/20 rounded-xl p-4 mb-4 text-sm text-accent-coral">
          {error}
        </div>
      )}

      <SpectatorView
        state={state}
        gameName={session.gameName}
        templateSlug={session.templateSlug}
        spectatorCount={spectatorCount}
        isConnected={isConnected}
        lastUpdateAt={lastUpdateAt}
      />
    </div>
  );
}

export default function SpectatePage() {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get('tournamentId');

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchingSession, setWatchingSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        let url = `${API_URL}/games/active-sessions`;
        if (tournamentId) {
          url += `?tournamentId=${encodeURIComponent(tournamentId)}`;
        }
        const res = await fetch(url);
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
  }, [tournamentId]);

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      <div className="page-container pt-12">
        {/* Header */}
        <div className="mb-10 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex items-center justify-center w-8 h-8">
              <span className="absolute w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="relative w-3 h-3 rounded-full bg-red-500" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-white uppercase">
              Live Games
            </h1>
          </div>
          <p className="text-white/50 text-lg ml-11">
            Watch active game sessions in real time
            {tournamentId && <span className="text-molt-400"> (Tournament matches)</span>}
          </p>
        </div>

        {/* Content */}
        {watchingSession ? (
          <div className="animate-fade-in-up">
            <SpectatorPanel session={watchingSession} onClose={() => setWatchingSession(null)} />
          </div>
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-white/30">{error}</p>
              </div>
            ) : sessions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up animate-delay-200">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="glass rounded-2xl overflow-hidden hover:border-molt-500/30 transition-all duration-300 group"
                  >
                    {/* Card header with gradient */}
                    <div className="relative h-32 bg-gradient-to-br from-surface-dark to-surface-light p-5 flex flex-col justify-end border-b border-white/10">
                      {/* Live indicator */}
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/90 text-white shadow-lg shadow-red-500/20">
                          <Radio className="w-3 h-3" />
                          Live
                        </span>
                      </div>
                      <h3 className="font-display font-black text-xl uppercase tracking-tight text-white leading-tight">
                        {session.gameName}
                      </h3>
                      {session.templateSlug && (
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                          {session.templateSlug}
                        </span>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-5">
                      <div className="flex items-center gap-4 text-sm text-white/40 mb-4">
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
                        className="w-full flex items-center justify-center gap-2 btn-primary py-3 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Watch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 animate-fade-in-up">
                <Radio className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/30 text-lg">No active games right now. Check back soon!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

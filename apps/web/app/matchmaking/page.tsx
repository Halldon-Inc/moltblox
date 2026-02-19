'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Swords,
  Trophy,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Zap,
  Shield,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react';

// ---- Types ----

type QueueStatus = 'idle' | 'searching' | 'found' | 'starting' | 'timeout' | 'error';

interface MatchInfo {
  matchId: string;
  sessionId?: string;
  opponentId: string;
  opponentRating: number;
  opponentTier: string;
  ratingDifference: number;
}

interface PlayerStats {
  rating: number;
  tier: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  peakRating: number;
  currentStreak: number;
}

// ---- Constants ----

const RANK_TIERS: Record<string, { label: string; color: string; bg: string; min: number }> = {
  bronze: { label: 'Bronze', color: 'text-amber-600', bg: 'bg-amber-600/10', min: 0 },
  silver: { label: 'Silver', color: 'text-gray-300', bg: 'bg-gray-300/10', min: 1200 },
  gold: { label: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-400/10', min: 1400 },
  platinum: { label: 'Platinum', color: 'text-cyan-300', bg: 'bg-cyan-300/10', min: 1600 },
  diamond: { label: 'Diamond', color: 'text-blue-400', bg: 'bg-blue-400/10', min: 1800 },
  master: { label: 'Master', color: 'text-purple-400', bg: 'bg-purple-400/10', min: 2000 },
  grandmaster: { label: 'Grandmaster', color: 'text-red-400', bg: 'bg-red-400/10', min: 2400 },
};

const INITIAL_SEARCH_RANGE = 100;
const EXPANSION_INTERVAL_MS = 10000;
const SEARCH_RANGE_EXPANSION = 50;
const MAX_SEARCH_RANGE = 500;
const MAX_WAIT_MS = 120000;

function getTierFromRating(rating: number): string {
  if (rating >= 2400) return 'grandmaster';
  if (rating >= 2000) return 'master';
  if (rating >= 1800) return 'diamond';
  if (rating >= 1600) return 'platinum';
  if (rating >= 1400) return 'gold';
  if (rating >= 1200) return 'silver';
  return 'bronze';
}

function getNextTierThreshold(rating: number): number {
  if (rating >= 2400) return 3000;
  if (rating >= 2000) return 2400;
  if (rating >= 1800) return 2000;
  if (rating >= 1600) return 1800;
  if (rating >= 1400) return 1600;
  if (rating >= 1200) return 1400;
  return 1200;
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
      // fall through
    }
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  return `${protocol}//${host}:3001`;
}

// ---- Components ----

function RatingBadge({ rating, tier }: { rating: number; tier: string }) {
  const tierInfo = RANK_TIERS[tier] || RANK_TIERS.bronze;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${tierInfo.bg}`}>
      <Shield className={`w-4 h-4 ${tierInfo.color}`} />
      <span className={`text-sm font-bold ${tierInfo.color}`}>{tierInfo.label}</span>
      <span className="text-white/60 text-sm">{rating}</span>
    </div>
  );
}

function SearchRangeIndicator({ elapsed }: { elapsed: number }) {
  const expansions = Math.floor(elapsed / EXPANSION_INTERVAL_MS);
  const currentRange = Math.min(
    INITIAL_SEARCH_RANGE + expansions * SEARCH_RANGE_EXPANSION,
    MAX_SEARCH_RANGE,
  );
  const progress = (currentRange / MAX_SEARCH_RANGE) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-white/40 mb-1">
        <span>Search range</span>
        <span>&plusmn;{currentRange} ELO</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-molt-500 to-molt-300 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function MatchFoundAnimation({ match }: { match: MatchInfo }) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowDetails(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const opponentTier = RANK_TIERS[match.opponentTier] || RANK_TIERS.bronze;

  return (
    <div className="text-center animate-scale-in">
      {/* Flash effect */}
      <div className="absolute inset-0 bg-molt-500/10 animate-pulse rounded-2xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Zap className="w-8 h-8 text-molt-400 animate-pulse" />
          <h2 className="text-3xl font-display font-black uppercase text-white tracking-tight">
            Match Found
          </h2>
          <Zap className="w-8 h-8 text-molt-400 animate-pulse" />
        </div>

        {showDetails && (
          <div className="animate-fade-in-up space-y-6">
            {/* VS Card */}
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-molt-500/20 border-2 border-molt-500/40 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-display font-black text-molt-400">You</span>
                </div>
              </div>

              <div className="text-4xl font-display font-black text-white/20">VS</div>

              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-accent-coral/20 border-2 border-accent-coral/40 flex items-center justify-center mx-auto mb-2">
                  <Swords className="w-8 h-8 text-accent-coral" />
                </div>
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${opponentTier.bg}`}
                >
                  <span className={`text-xs font-bold ${opponentTier.color}`}>
                    {opponentTier.label} {match.opponentRating}
                  </span>
                </div>
              </div>
            </div>

            {/* Rating difference */}
            <div className="text-sm text-white/40">
              Rating difference:{' '}
              <span className="text-white/60 font-medium">{match.ratingDifference}</span>
            </div>

            <p className="text-white/50 text-sm">Match starting shortly...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function MatchmakingPage() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');

  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mock player stats (in production, fetched from API)
  const [playerStats] = useState<PlayerStats>({
    rating: 1350,
    tier: getTierFromRating(1350),
    gamesPlayed: 24,
    wins: 15,
    losses: 9,
    winRate: 0.625,
    peakRating: 1420,
    currentStreak: 3,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave_queue', payload: {} }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Elapsed time counter
  useEffect(() => {
    if (queueStatus === 'searching') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        // Auto-timeout on client side
        if (elapsed >= MAX_WAIT_MS) {
          setQueueStatus('timeout');
          cleanup();
        }
      }, 250);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [queueStatus, cleanup]);

  function joinQueue() {
    if (!gameId) {
      setErrorMsg('No game selected. Please choose a game first.');
      return;
    }

    setQueueStatus('searching');
    setElapsedMs(0);
    setErrorMsg(null);
    setMatchInfo(null);

    const wsUrl = getWsUrl();
    if (!wsUrl) {
      setQueueStatus('error');
      setErrorMsg('Unable to determine WebSocket URL');
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate first (in production, use real token from auth context)
      const token = localStorage.getItem('moltblox_token');
      if (token) {
        ws.send(JSON.stringify({ type: 'authenticate', payload: { token } }));
      } else {
        setQueueStatus('error');
        setErrorMsg('You must be signed in to join matchmaking.');
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'authenticated':
            // Now join the queue
            ws.send(JSON.stringify({ type: 'join_queue', payload: { gameId } }));
            break;

          case 'queue_joined':
            setQueueSize(msg.payload?.position || 0);
            break;

          case 'session_start': {
            const players = msg.payload?.players || [];
            const sessionId = msg.payload?.sessionId;
            // Match found via the server
            setQueueStatus('found');
            setMatchInfo({
              matchId: sessionId || 'unknown',
              sessionId,
              opponentId: players.find((p: string) => p !== msg.payload?.playerId) || 'opponent',
              opponentRating: playerStats.rating + Math.floor(Math.random() * 200 - 100),
              opponentTier: playerStats.tier,
              ratingDifference: Math.floor(Math.random() * 150),
            });

            // Redirect to game after a brief delay
            setTimeout(() => {
              if (sessionId) {
                window.location.href = `/games/play?sessionId=${sessionId}`;
              }
            }, 3000);
            break;
          }

          case 'realtime_match_found': {
            const rtSessionId = msg.payload?.sessionId;
            const rtPlayers = msg.payload?.players || [];
            setQueueStatus('found');
            setMatchInfo({
              matchId: rtSessionId || 'unknown',
              sessionId: rtSessionId,
              opponentId: rtPlayers[1] || 'opponent',
              opponentRating: playerStats.rating + Math.floor(Math.random() * 200 - 100),
              opponentTier: playerStats.tier,
              ratingDifference: Math.floor(Math.random() * 150),
            });

            setTimeout(() => {
              if (rtSessionId) {
                window.location.href = `/games/play?sessionId=${rtSessionId}`;
              }
            }, 3000);
            break;
          }

          case 'error':
            setQueueStatus('error');
            setErrorMsg(msg.payload?.message || 'Queue error');
            break;

          default:
            break;
        }
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onclose = () => {
      if (queueStatus === 'searching') {
        // Only set error if we were still searching (not if we found a match)
        setQueueStatus((prev) => (prev === 'searching' ? 'error' : prev));
        setErrorMsg((prev) => prev || 'Connection lost');
      }
    };

    ws.onerror = () => {
      setQueueStatus('error');
      setErrorMsg('WebSocket connection error');
    };
  }

  function cancelQueue() {
    cleanup();
    setQueueStatus('idle');
    setElapsedMs(0);
    setErrorMsg(null);
  }

  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const nextTierThreshold = getNextTierThreshold(playerStats.rating);
  const currentTierInfo = RANK_TIERS[playerStats.tier] || RANK_TIERS.bronze;
  const progressToNextTier =
    ((playerStats.rating - (currentTierInfo.min || 0)) /
      (nextTierThreshold - (currentTierInfo.min || 0))) *
    100;

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      <div className="page-container pt-12">
        {/* Header */}
        <div className="mb-10 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <Swords className="w-8 h-8 text-molt-400" />
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">
              Ranked Matchmaking
            </h1>
          </div>
          <p className="text-lg text-white/50 max-w-2xl">
            Queue up, find your match, climb the ranks. ELO-based matchmaking pairs you with
            opponents at your skill level.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Player Stats */}
          <div className="lg:col-span-1 space-y-6 animate-fade-in-up animate-delay-200">
            {/* Rating Card */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                Your Rating
              </h2>
              <div className="text-center mb-4">
                <div className="text-5xl font-display font-black text-white mb-2">
                  {playerStats.rating}
                </div>
                <RatingBadge rating={playerStats.rating} tier={playerStats.tier} />
              </div>

              {/* Progress to next tier */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                  <span>{currentTierInfo.label}</span>
                  <span>{nextTierThreshold} ELO</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-molt-600 to-molt-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(progressToNextTier, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white/30 mt-1 text-center">
                  {nextTierThreshold - playerStats.rating} ELO to next rank
                </p>
              </div>
            </div>

            {/* Stats Card */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                Season Stats
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Games Played</span>
                  <span className="text-sm font-bold text-white">{playerStats.gamesPlayed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Win Rate</span>
                  <span className="text-sm font-bold text-[#00D9A6]">
                    {(playerStats.winRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">W / L</span>
                  <span className="text-sm text-white">
                    <span className="font-bold text-[#00D9A6]">{playerStats.wins}</span>
                    <span className="text-white/30 mx-1">/</span>
                    <span className="font-bold text-accent-coral">{playerStats.losses}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Peak Rating</span>
                  <span className="text-sm font-bold text-accent-amber">
                    {playerStats.peakRating}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Current Streak</span>
                  <span className="text-sm font-bold flex items-center gap-1">
                    {playerStats.currentStreak > 0 ? (
                      <>
                        <TrendingUp className="w-3.5 h-3.5 text-[#00D9A6]" />
                        <span className="text-[#00D9A6]">{playerStats.currentStreak}W</span>
                      </>
                    ) : playerStats.currentStreak < 0 ? (
                      <>
                        <TrendingDown className="w-3.5 h-3.5 text-accent-coral" />
                        <span className="text-accent-coral">
                          {Math.abs(playerStats.currentStreak)}L
                        </span>
                      </>
                    ) : (
                      <span className="text-white/40">0</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Potential Gains */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                Potential Rating Change
              </h2>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-[#00D9A6]">
                    <ChevronUp className="w-4 h-4" />
                    <span className="text-xl font-display font-black">+16 to +32</span>
                  </div>
                  <p className="text-xs text-white/30 mt-1">If you win</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <div className="flex items-center gap-1 text-accent-coral">
                    <ChevronDown className="w-4 h-4" />
                    <span className="text-xl font-display font-black">-16 to -32</span>
                  </div>
                  <p className="text-xs text-white/30 mt-1">If you lose</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Queue Panel */}
          <div className="lg:col-span-2 animate-fade-in-up animate-delay-300">
            <div className="glass rounded-2xl p-8 min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
              {/* Idle State */}
              {queueStatus === 'idle' && (
                <div className="text-center space-y-8 max-w-md">
                  <div>
                    <div className="w-24 h-24 rounded-full bg-molt-500/10 border-2 border-molt-500/20 flex items-center justify-center mx-auto mb-6">
                      <Swords className="w-12 h-12 text-molt-400" />
                    </div>
                    <h2 className="text-2xl font-display font-black uppercase text-white mb-2">
                      Ready to Battle?
                    </h2>
                    <p className="text-white/50 text-sm">
                      Join the ranked queue to find an opponent matched to your skill level.
                      {!gameId && (
                        <span className="block mt-2 text-accent-amber">
                          Select a game from the{' '}
                          <Link href="/games" className="underline hover:text-accent-amber/80">
                            games page
                          </Link>{' '}
                          first.
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={joinQueue}
                    disabled={!gameId}
                    className="btn-primary text-lg px-12 py-4 inline-flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Swords className="w-5 h-5" />
                    Find Match
                  </button>

                  {errorMsg && <p className="text-sm text-accent-coral">{errorMsg}</p>}
                </div>
              )}

              {/* Searching State */}
              {queueStatus === 'searching' && (
                <div className="text-center space-y-8 max-w-md w-full">
                  {/* Animated ring */}
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-molt-500/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-molt-400 animate-spin" />
                    <div
                      className="absolute inset-3 rounded-full border-4 border-transparent border-b-molt-300 animate-spin"
                      style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Swords className="w-10 h-10 text-molt-400" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-display font-black uppercase text-white mb-1">
                      Searching...
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-white/50">
                      <Clock className="w-4 h-4" />
                      <span className="text-lg font-mono">{formatTime(elapsedMs)}</span>
                    </div>
                  </div>

                  {/* Queue info */}
                  {queueSize > 0 && (
                    <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                      <Users className="w-4 h-4" />
                      <span>{queueSize} in queue</span>
                    </div>
                  )}

                  {/* Search range expansion indicator */}
                  <div className="px-4">
                    <SearchRangeIndicator elapsed={elapsedMs} />
                  </div>

                  <button
                    onClick={cancelQueue}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all duration-200 text-sm font-medium"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}

              {/* Match Found State */}
              {queueStatus === 'found' && matchInfo && <MatchFoundAnimation match={matchInfo} />}

              {/* Starting State */}
              {queueStatus === 'starting' && (
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-molt-400 animate-spin mx-auto" />
                  <h2 className="text-2xl font-display font-black uppercase text-white">
                    Loading Match...
                  </h2>
                  <p className="text-white/50 text-sm">Preparing your game session</p>
                </div>
              )}

              {/* Timeout State */}
              {queueStatus === 'timeout' && (
                <div className="text-center space-y-6 max-w-md">
                  <div className="w-20 h-20 rounded-full bg-accent-amber/10 border-2 border-accent-amber/20 flex items-center justify-center mx-auto">
                    <Clock className="w-10 h-10 text-accent-amber" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black uppercase text-white mb-2">
                      Queue Timed Out
                    </h2>
                    <p className="text-white/50 text-sm">
                      No opponents found within your rating range. Try again or check back when more
                      players are online.
                    </p>
                  </div>
                  <button
                    onClick={joinQueue}
                    className="btn-primary px-10 py-3 inline-flex items-center gap-2"
                  >
                    <Swords className="w-4 h-4" />
                    Try Again
                  </button>
                </div>
              )}

              {/* Error State */}
              {queueStatus === 'error' && (
                <div className="text-center space-y-6 max-w-md">
                  <div className="w-20 h-20 rounded-full bg-accent-coral/10 border-2 border-accent-coral/20 flex items-center justify-center mx-auto">
                    <X className="w-10 h-10 text-accent-coral" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black uppercase text-white mb-2">
                      Connection Error
                    </h2>
                    <p className="text-white/50 text-sm">
                      {errorMsg || 'An unexpected error occurred. Please try again.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setQueueStatus('idle')}
                    className="btn-primary px-10 py-3 inline-flex items-center gap-2"
                  >
                    Back
                  </button>
                </div>
              )}
            </div>

            {/* How It Works */}
            <div className="glass rounded-2xl p-6 mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                How Ranked Matchmaking Works
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-molt-500/10 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-molt-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Join Queue</h4>
                  <p className="text-xs text-white/40">
                    Queue up and the system searches for an opponent within your ELO range
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-molt-500/10 flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-5 h-5 text-molt-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Match & Play</h4>
                  <p className="text-xs text-white/40">
                    Once matched, the game starts. Range widens over time for faster matches
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-molt-500/10 flex items-center justify-center mx-auto mb-2">
                    <Trophy className="w-5 h-5 text-molt-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Climb Ranks</h4>
                  <p className="text-xs text-white/40">
                    Win to gain ELO, climb tiers from Bronze to Grandmaster
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

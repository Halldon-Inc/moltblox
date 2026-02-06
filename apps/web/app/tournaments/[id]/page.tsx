'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Users,
  Calendar,
  Clock,
  Award,
  Star,
  Swords,
  Zap,
  Medal,
  Crown,
} from 'lucide-react';
import { useTournament, useTournamentBracket, useRegisterForTournament } from '@/hooks/useApi';

const statusConfig: Record<
  string,
  { bg: string; text: string; border: string; label: string; dot: string }
> = {
  live: {
    bg: 'bg-green-400/10',
    text: 'text-green-400',
    border: 'border-green-400/20',
    label: 'Live Now',
    dot: 'bg-green-400 animate-pulse',
  },
  upcoming: {
    bg: 'bg-accent-amber/10',
    text: 'text-accent-amber',
    border: 'border-accent-amber/20',
    label: 'Upcoming',
    dot: 'bg-accent-amber',
  },
  completed: {
    bg: 'bg-white/5',
    text: 'text-white/40',
    border: 'border-white/10',
    label: 'Completed',
    dot: 'bg-white/30',
  },
};

const API_STATUS_MAP: Record<string, string> = {
  REGISTRATION: 'upcoming',
  IN_PROGRESS: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'completed',
};

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elim',
  DOUBLE_ELIMINATION: 'Double Elim',
  ROUND_ROBIN: 'Round Robin',
  SWISS: 'Swiss',
};

const prizeDistribution = [
  { place: '1st', percent: 50, color: 'bg-accent-amber', icon: Crown },
  { place: '2nd', percent: 25, color: 'bg-gray-300', icon: Medal },
  { place: '3rd', percent: 15, color: 'bg-amber-700', icon: Medal },
  { place: 'Others', percent: 10, color: 'bg-white/20', icon: Award },
];

function formatBigIntValue(value: string | number): number {
  if (typeof value === 'number') return value;
  try {
    const num = BigInt(value);
    const divisor = BigInt(10 ** 18);
    return Number(num / divisor);
  } catch {
    return Number(value) || 0;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tournament, isLoading, isError } = useTournament(id);
  const { data: bracketData } = useTournamentBracket(id);
  const registerMutation = useRegisterForTournament();
  const [registerError, setRegisterError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !tournament) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 text-lg mb-4">Tournament not found</p>
          <Link href="/tournaments" className="text-molt-400 hover:text-molt-300 transition-colors">
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const displayStatus = API_STATUS_MAP[tournament.status] || 'upcoming';
  const statusInfo = statusConfig[displayStatus] || statusConfig.upcoming;

  const tournamentName = tournament.name || 'Untitled Tournament';
  const gameName = tournament.game?.name || 'Unknown Game';
  const description = tournament.description || '';
  const prizePool = formatBigIntValue(tournament.prizePool || '0');
  const entryFee = formatBigIntValue(tournament.entryFee || '0');
  const format = FORMAT_LABELS[tournament.format] || tournament.format || 'Single Elim';
  const maxParticipants = tournament.maxParticipants ?? 0;
  const startDate = tournament.startDate ? formatDate(tournament.startDate) : '--';

  const participants = tournament.participants ?? [];
  const participantCount = participants.length;

  const players = participants.map((p: any, idx: number) => ({
    rank: idx + 1,
    name:
      p.user?.displayName || p.user?.username || p.username || p.displayName || `Player ${idx + 1}`,
    rating: p.rating ?? p.user?.rating ?? 0,
    status: p.eliminated
      ? 'Eliminated'
      : tournament.status === 'REGISTRATION'
        ? 'Registered'
        : 'Active',
  }));

  const bracket: {
    round: string;
    matches: { player1: string; player2: string; winner?: string }[];
  }[] = [];
  if (bracketData) {
    if (Array.isArray(bracketData)) {
      for (const round of bracketData) {
        bracket.push({
          round: round.round || round.name || `Round ${bracket.length + 1}`,
          matches: (round.matches || []).map((m: any) => ({
            player1:
              m.player1?.user?.username ||
              m.player1?.username ||
              m.player1Name ||
              m.player1 ||
              'TBD',
            player2:
              m.player2?.user?.username ||
              m.player2?.username ||
              m.player2Name ||
              m.player2 ||
              'TBD',
            winner:
              m.winner?.user?.username ||
              m.winner?.username ||
              m.winnerName ||
              m.winner ||
              undefined,
          })),
        });
      }
    } else if (bracketData.rounds) {
      for (const round of bracketData.rounds) {
        bracket.push({
          round: round.round || round.name || `Round ${bracket.length + 1}`,
          matches: (round.matches || []).map((m: any) => ({
            player1:
              m.player1?.user?.username ||
              m.player1?.username ||
              m.player1Name ||
              m.player1 ||
              'TBD',
            player2:
              m.player2?.user?.username ||
              m.player2?.username ||
              m.player2Name ||
              m.player2 ||
              'TBD',
            winner:
              m.winner?.user?.username ||
              m.winner?.username ||
              m.winnerName ||
              m.winner ||
              undefined,
          })),
        });
      }
    }
  }

  if (bracket.length === 0 && tournament.matches && Array.isArray(tournament.matches)) {
    const matchesByRound: Record<string, any[]> = {};
    for (const m of tournament.matches) {
      const roundName = m.round || `Round ${m.roundNumber || 1}`;
      if (!matchesByRound[roundName]) matchesByRound[roundName] = [];
      matchesByRound[roundName].push(m);
    }
    for (const [roundName, matches] of Object.entries(matchesByRound)) {
      bracket.push({
        round: roundName,
        matches: matches.map((m: any) => ({
          player1: m.player1?.user?.username || m.player1?.username || m.player1Name || 'TBD',
          player2: m.player2?.user?.username || m.player2?.username || m.player2Name || 'TBD',
          winner: m.winner?.user?.username || m.winner?.username || m.winnerName || undefined,
        })),
      });
    }
  }

  function handleRegister() {
    setRegisterError(null);
    registerMutation.mutate(id, {
      onError: (err: any) => {
        setRegisterError(err?.message || 'Failed to register');
      },
    });
  }

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[500px] h-[500px] -top-40 right-1/4 fixed" />
      <div className="ambient-glow ambient-glow-pink w-[300px] h-[300px] bottom-40 -left-20 fixed" />

      <div className="page-container pt-8">
        {/* Back Navigation */}
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Tournaments</span>
        </Link>

        {/* Tournament Header */}
        <div className="glass rounded-3xl p-8 mb-8 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-accent-amber/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                {/* Status badge */}
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text} border ${statusInfo.border} mb-4`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                  {statusInfo.label}
                </span>

                <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
                  {tournamentName}
                </h1>
                <div className="flex items-center gap-3 text-white/50">
                  <Swords className="w-4 h-4" />
                  <span>{gameName}</span>
                </div>
                <p className="text-white/50 mt-4 max-w-xl text-sm leading-relaxed">{description}</p>
              </div>

              {/* Prize Pool Display */}
              <div className="text-center md:text-right shrink-0">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Prize Pool</p>
                <div className="flex items-center gap-2 justify-center md:justify-end">
                  <Trophy className="w-8 h-8 text-accent-amber" />
                  <span className="text-4xl md:text-5xl font-display font-bold text-accent-amber">
                    {prizePool.toLocaleString()}
                  </span>
                </div>
                <p className="text-white/40 text-sm mt-1">MBUCKS</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Format', value: format, icon: Swords },
            {
              label: 'Participants',
              value: `${participantCount}/${maxParticipants}`,
              icon: Users,
            },
            { label: 'Start Date', value: startDate, icon: Calendar },
            {
              label: 'Entry Fee',
              value: entryFee > 0 ? `${entryFee} MBUCKS` : 'Free',
              icon: Zap,
            },
          ].map((info) => (
            <div key={info.label} className="glass-card p-4 text-center">
              <info.icon className="w-5 h-5 text-molt-400 mx-auto mb-2" />
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{info.label}</p>
              <p className="font-display font-bold text-white">{info.value}</p>
            </div>
          ))}
        </div>

        {/* Prize Distribution */}
        <div className="glass-card p-6 mb-8">
          <h2 className="section-title text-xl mb-6 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent-amber" />
            Prize Distribution
          </h2>
          <div className="space-y-4">
            {prizeDistribution.map((prize) => {
              const amount = Math.round((prize.percent / 100) * prizePool);
              return (
                <div key={prize.place} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-24 shrink-0">
                    <prize.icon
                      className={`w-5 h-5 ${
                        prize.place === '1st'
                          ? 'text-accent-amber'
                          : prize.place === '2nd'
                            ? 'text-gray-300'
                            : prize.place === '3rd'
                              ? 'text-amber-700'
                              : 'text-white/30'
                      }`}
                    />
                    <span className="text-sm font-medium text-white">{prize.place}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-8 bg-surface-dark rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full ${prize.color} rounded-lg transition-all duration-700 flex items-center px-3`}
                        style={{ width: `${prize.percent}%` }}
                      >
                        <span className="text-xs font-bold text-surface-dark whitespace-nowrap">
                          {prize.percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className="font-display font-bold text-accent-amber">
                      {amount.toLocaleString()}
                    </span>
                    <span className="text-xs text-white/30 ml-1">MBUCKS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Column: Participants + Bracket */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Participants Table */}
          <div className="glass-card p-6">
            <h2 className="section-title text-xl mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-neon-cyan" />
              Participants
            </h2>
            <div className="overflow-x-auto">
              {players.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs text-white/30 uppercase tracking-wider pb-3 pr-4">
                        Rank
                      </th>
                      <th className="text-left text-xs text-white/30 uppercase tracking-wider pb-3 pr-4">
                        Player
                      </th>
                      <th className="text-left text-xs text-white/30 uppercase tracking-wider pb-3 pr-4">
                        Rating
                      </th>
                      <th className="text-right text-xs text-white/30 uppercase tracking-wider pb-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player: any) => (
                      <tr
                        key={player.name}
                        className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <span
                            className={`text-sm font-bold ${
                              player.rank <= 3 ? 'text-accent-amber' : 'text-white/50'
                            }`}
                          >
                            #{player.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm font-medium text-white">{player.name}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-accent-amber" fill="currentColor" />
                            <span className="text-sm text-white/60">{player.rating}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              player.status === 'Active' || player.status === 'Registered'
                                ? 'bg-green-400/10 text-green-400'
                                : 'bg-red-400/10 text-red-400'
                            }`}
                          >
                            {player.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-white/30 text-center py-4">No participants yet</p>
              )}
            </div>
          </div>

          {/* Bracket Visualization */}
          <div className="glass-card p-6">
            <h2 className="section-title text-xl mb-4 flex items-center gap-2">
              <Swords className="w-5 h-5 text-neon-cyan" />
              Bracket
            </h2>
            {bracket.length > 0 ? (
              <div className="space-y-6">
                {bracket.map((round, roundIdx) => (
                  <div key={round.round}>
                    <h3 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">
                      {round.round}
                    </h3>
                    <div className="space-y-2">
                      {round.matches.map((match, matchIdx) => (
                        <div
                          key={matchIdx}
                          className="bg-surface-dark/50 rounded-xl border border-white/5 overflow-hidden"
                        >
                          {/* Player 1 */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 border-b border-white/5 ${
                              match.winner === match.player1 ? 'bg-molt-500/10' : ''
                            }`}
                          >
                            <span
                              className={`text-sm ${
                                match.winner === match.player1
                                  ? 'text-neon-cyan font-medium'
                                  : match.player1 === 'TBD'
                                    ? 'text-white/20 italic'
                                    : 'text-white/60'
                              }`}
                            >
                              {match.player1}
                            </span>
                            {match.winner === match.player1 && (
                              <span className="text-xs text-neon-cyan">W</span>
                            )}
                          </div>
                          {/* Player 2 */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 ${
                              match.winner === match.player2 ? 'bg-molt-500/10' : ''
                            }`}
                          >
                            <span
                              className={`text-sm ${
                                match.winner === match.player2
                                  ? 'text-neon-cyan font-medium'
                                  : match.player2 === 'TBD'
                                    ? 'text-white/20 italic'
                                    : 'text-white/60'
                              }`}
                            >
                              {match.player2}
                            </span>
                            {match.winner === match.player2 && (
                              <span className="text-xs text-neon-cyan">W</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Connector arrow between rounds */}
                    {roundIdx < bracket.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="w-px h-4 bg-white/10" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30 text-center py-4">Bracket not yet available</p>
            )}
          </div>
        </div>

        {/* Register CTA */}
        {displayStatus !== 'completed' && (
          <div className="text-center">
            <button
              onClick={displayStatus === 'upcoming' ? handleRegister : undefined}
              disabled={registerMutation.isPending}
              className="btn-primary text-lg px-12 py-4 inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registerMutation.isPending ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Registering...
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5" />
                  {displayStatus === 'live' ? 'Spectate Tournament' : 'Register Now'}
                </>
              )}
            </button>
            {registerMutation.isSuccess && (
              <p className="text-sm text-green-400 mt-3">Successfully registered!</p>
            )}
            {registerError && <p className="text-sm text-red-400 mt-3">{registerError}</p>}
            {entryFee > 0 && displayStatus === 'upcoming' && !registerMutation.isSuccess && (
              <p className="text-sm text-white/30 mt-3">Entry fee: {entryFee} MBUCKS</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

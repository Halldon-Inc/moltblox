'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, Star, Medal, Crown, Award } from 'lucide-react';
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

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: tournament, isLoading, isError } = useTournament(id);
  const { data: bracketData } = useTournamentBracket(id);
  const registerMutation = useRegisterForTournament();
  const [registerError, setRegisterError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !tournament) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
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

  const detailRows = [
    { label: 'Format', value: format },
    { label: 'Participants', value: `${participantCount}/${maxParticipants}` },
    { label: 'Start Date', value: startDate },
    { label: 'Entry Fee', value: entryFee > 0 ? `${entryFee} MOLT` : 'Free' },
  ];

  return (
    <div className="min-h-screen bg-[#0d1b2a] pb-20">
      {/* Full-bleed Hero */}
      <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden">
        <img
          src="/images/heroes/tournament-arena.png"
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1b2a] via-[#0d1b2a]/60 to-transparent" />

        {/* Hero content — positioned at bottom */}
        <div className="absolute inset-x-0 bottom-0 pb-12 flex flex-col items-center px-4">
          <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tight text-center">
            {tournamentName}
          </h1>
          <div className="mt-4 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.dot}`} />
            <span className={`text-base font-medium ${statusInfo.text}`}>{statusInfo.label}</span>
            {displayStatus === 'live' && (
              <span className="text-white/40 text-sm ml-1"> | Started {startDate}</span>
            )}
            {displayStatus === 'upcoming' && (
              <span className="text-white/40 text-sm ml-1"> | Starts {startDate}</span>
            )}
          </div>
          {description && (
            <p className="text-white/50 mt-3 max-w-xl text-sm leading-relaxed text-center">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="page-container">
        {/* Prize Pool Bar */}
        <div className="bg-gradient-to-r from-[#00D9A6] to-[#00B890] rounded-xl px-8 py-5 flex items-center justify-between mt-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl font-display font-black text-white">
              {prizePool.toLocaleString()}
            </span>
            <span className="text-white/80 text-lg font-semibold uppercase tracking-wide">
              MOLT
            </span>
          </div>
          <span className="text-white/80 font-semibold text-lg">Prize Pool</span>
        </div>

        {/* Details Table */}
        <div className="bg-[#0d1b2a] py-6 mt-8">
          {detailRows.map((row, idx) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-4 px-2 ${
                idx < detailRows.length - 1 ? 'border-b border-white/10' : ''
              }`}
            >
              <span className="text-white/50 text-sm">{row.label}</span>
              <span className="font-display font-bold text-white uppercase">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Prize Distribution */}
        <div className="mt-10">
          <h2 className="text-2xl font-display font-black uppercase text-white mb-6">
            Prize Distribution
          </h2>
          <div>
            {prizeDistribution.map((prize, idx) => {
              const amount = Math.round((prize.percent / 100) * prizePool);
              return (
                <div
                  key={prize.place}
                  className={`flex items-center justify-between py-4 px-2 ${
                    idx < prizeDistribution.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <span className="text-white/60 text-sm">
                    {prize.place} ({prize.percent}%)
                  </span>
                  <span className="font-display font-bold text-white">
                    {amount.toLocaleString()} MOLT
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Column: Participants + Bracket */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          {/* Participants Table */}
          <div>
            <h2 className="text-2xl font-display font-black uppercase text-white mb-6">
              Participants
            </h2>
            <div className="overflow-x-auto">
              {players.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
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
                    {players.map((player: any, playerIdx: number) => (
                      <tr
                        key={`${player.name}-${playerIdx}`}
                        className="border-b border-white/10 last:border-0 hover:bg-white/[0.02] transition-colors"
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
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              player.status === 'Active' || player.status === 'Registered'
                                ? 'bg-[#00D9A6]/10 text-[#00D9A6]'
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
          <div>
            <h2 className="text-2xl font-display font-black uppercase text-white mb-6">Bracket</h2>
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
                          className="bg-[#0d1b2a] rounded-xl border border-white/10 overflow-hidden"
                        >
                          {/* Player 1 */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 border-b border-white/10 ${
                              match.winner === match.player1 ? 'bg-[#00D9A6]/10' : ''
                            }`}
                          >
                            <span
                              className={`text-sm ${
                                match.winner === match.player1
                                  ? 'text-[#00D9A6] font-medium'
                                  : match.player1 === 'TBD'
                                    ? 'text-white/20 italic'
                                    : 'text-white/60'
                              }`}
                            >
                              {match.player1}
                            </span>
                            {match.winner === match.player1 && (
                              <span className="text-xs text-[#00D9A6]">W</span>
                            )}
                          </div>
                          {/* Player 2 */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 ${
                              match.winner === match.player2 ? 'bg-[#00D9A6]/10' : ''
                            }`}
                          >
                            <span
                              className={`text-sm ${
                                match.winner === match.player2
                                  ? 'text-[#00D9A6] font-medium'
                                  : match.player2 === 'TBD'
                                    ? 'text-white/20 italic'
                                    : 'text-white/60'
                              }`}
                            >
                              {match.player2}
                            </span>
                            {match.winner === match.player2 && (
                              <span className="text-xs text-[#00D9A6]">W</span>
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
          <div className="text-center mt-12">
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
              <p className="text-sm text-white/30 mt-3">Entry fee: {entryFee} MOLT</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Trophy, Users, Calendar, Clock } from 'lucide-react';

export interface TournamentCardProps {
  id: string;
  name: string;
  game: string;
  prizePool: number;
  participants: number;
  maxParticipants: number;
  status: 'live' | 'upcoming' | 'completed';
  format: string;
  startDate: string;
}

const statusConfig = {
  live: { dot: 'bg-green-400 animate-pulse', text: 'Live', textColor: 'text-green-400' },
  upcoming: { dot: 'bg-accent-amber', text: 'Upcoming', textColor: 'text-accent-amber' },
  completed: { dot: 'bg-white/30', text: 'Completed', textColor: 'text-white/40' },
};

export default function TournamentCard({
  id,
  name,
  game,
  prizePool,
  participants,
  maxParticipants,
  status,
  format,
  startDate,
}: TournamentCardProps) {
  const statusInfo = statusConfig[status];
  const fillPercent = Math.min((participants / maxParticipants) * 100, 100);

  return (
    <Link href={`/tournaments/${id}`} className="group block">
      <div className="glass-card p-5 h-full flex flex-col">
        {/* Status + Format */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <span className={`text-xs font-medium ${statusInfo.textColor}`}>{statusInfo.text}</span>
          </div>
          <span className="badge text-[10px] px-2 py-0.5">{format}</span>
        </div>

        {/* Name + Game */}
        <h3 className="font-display font-semibold text-white group-hover:text-neon-cyan transition-colors truncate">
          {name}
        </h3>
        <p className="text-sm text-white/40 mt-0.5">{game}</p>

        {/* Prize Pool */}
        <div className="mt-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent-amber" />
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">Prize Pool</p>
            <p className="font-display font-bold text-lg text-accent-amber">
              {prizePool.toLocaleString()}{' '}
              <span className="text-xs font-normal text-white/50">MBUCKS</span>
            </p>
          </div>
        </div>

        {/* Participants progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>
                {participants}/{maxParticipants} players
              </span>
            </div>
            <span>{Math.round(fillPercent)}%</span>
          </div>
          <div className="h-1.5 bg-surface-dark rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fillPercent}%`,
                background:
                  fillPercent >= 90
                    ? 'linear-gradient(90deg, #ff6b6b, #ff8a80)'
                    : 'linear-gradient(90deg, #14b8a6, #00ffe5)',
              }}
            />
          </div>
        </div>

        {/* Date + Info */}
        <div className="mt-auto pt-4 flex items-center gap-3 text-xs text-white/40 border-t border-white/5">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{startDate}</span>
          </div>
          {status === 'live' && (
            <div className="flex items-center gap-1 text-green-400">
              <Clock className="w-3 h-3" />
              <span>In progress</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

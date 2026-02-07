'use client';

import { useEffect, useRef } from 'react';
import type { GameEvent } from '@moltblox/protocol';

const EVENT_COLORS: Record<string, string> = {
  milestone: 'text-accent-amber',
  game_started: 'text-molt-400',
  game_ended: 'text-neon-cyan',
  match_found: 'text-green-400',
  match_failed: 'text-red-400',
  tower_placed: 'text-molt-400',
  tower_upgraded: 'text-accent-amber',
  enemy_killed: 'text-red-400',
  life_lost: 'text-accent-coral',
  wave_started: 'text-neon-pink',
  wave_completed: 'text-green-400',
  encounter_started: 'text-neon-pink',
  attack: 'text-red-400',
  skill_used: 'text-purple-400',
  level_up: 'text-accent-amber',
  player_defeated: 'text-accent-coral',
  note_hit: 'text-green-400',
  note_missed: 'text-red-400',
  jump: 'text-molt-400',
  item_collected: 'text-accent-amber',
  checkpoint_activated: 'text-green-400',
  level_complete: 'text-neon-cyan',
  player_died: 'text-accent-coral',
};

function formatEvent(event: GameEvent): string {
  const data = event.data || {};
  switch (event.type) {
    case 'milestone':
      return `Milestone: ${data.clicks} clicks!`;
    case 'game_started':
      return 'Game started';
    case 'game_ended':
      return data.winner ? `Game over! Winner: ${String(data.winner).slice(0, 12)}` : 'Game over!';
    case 'match_found':
      return `Match found!`;
    case 'match_failed':
      return 'No match';
    case 'tower_placed':
      return `Placed ${data.towerType} tower`;
    case 'tower_upgraded':
      return `Tower upgraded to level ${data.newLevel}`;
    case 'enemy_killed':
      return `Enemy killed (+${data.reward}g)`;
    case 'life_lost':
      return `Life lost! (${data.livesRemaining} left)`;
    case 'wave_started':
      return `Wave ${data.wave} started (${data.enemyCount} enemies)`;
    case 'wave_completed':
      return `Wave ${data.wave} cleared! (+${data.bonus}g bonus)`;
    case 'encounter_started':
      return `Encounter ${data.encounter}: ${data.enemy}`;
    case 'attack':
      return `Attack for ${data.damage} damage`;
    case 'skill_used':
      return `Used ${data.skill}`;
    case 'level_up':
      return `Level up! Now level ${data.level}`;
    case 'note_hit':
      return `${data.rating}! +${data.score} (${data.combo}x combo)`;
    case 'note_missed':
      return 'Miss! Combo broken';
    case 'item_collected':
      return `Collected ${data.type} (+${data.value})`;
    case 'checkpoint_activated':
      return 'Checkpoint reached!';
    case 'level_complete':
      return `Level complete! Score: ${data.score}`;
    case 'player_died':
      return `Died! (${data.livesRemaining} lives left)`;
    default:
      return event.type.replace(/_/g, ' ');
  }
}

export function EventFeed({ events }: { events: GameEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
      {events.slice(-15).map((event, i) => (
        <div
          key={`${event.timestamp}-${i}`}
          className={`text-xs font-mono ${EVENT_COLORS[event.type] || 'text-white/50'} animate-[fadeIn_0.2s_ease-out]`}
        >
          {formatEvent(event)}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

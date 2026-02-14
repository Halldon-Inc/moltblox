'use client';

import { useState, useCallback } from 'react';

interface Card {
  id: string;
  suit?: string;
  value?: string | number;
  faceUp?: boolean;
  label?: string;
  color?: string;
}

interface PlayerInfo {
  name: string;
  score?: number;
  isActive?: boolean;
}

interface CardRendererProps {
  hand: Card[];
  table?: Card[];
  onPlayCard: (cardId: string) => void;
  onDrawCard?: () => void;
  playerInfo?: PlayerInfo;
  canDraw?: boolean;
  maxHandDisplay?: number;
}

const SUIT_DISPLAY: Record<string, { symbol: string; color: string }> = {
  hearts: { symbol: '\u2665', color: 'text-red-400' },
  diamonds: { symbol: '\u2666', color: 'text-red-400' },
  clubs: { symbol: '\u2663', color: 'text-white' },
  spades: { symbol: '\u2660', color: 'text-white' },
};

function CardComponent({
  card,
  onClick,
  selected,
  hoverable = true,
  small = false,
}: {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  hoverable?: boolean;
  small?: boolean;
}) {
  const suit = card.suit ? SUIT_DISPLAY[card.suit.toLowerCase()] : null;
  const isFaceUp = card.faceUp !== false;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        'relative rounded-lg border transition-all duration-200 flex-shrink-0',
        small ? 'w-14 h-20' : 'w-20 h-28',
        isFaceUp
          ? 'bg-surface-light border-white/20'
          : 'bg-gradient-to-br from-molt-700 to-molt-900 border-molt-500/30',
        selected ? 'ring-2 ring-neon-cyan -translate-y-3 shadow-neon-sm' : '',
        hoverable && onClick ? 'hover:-translate-y-2 hover:border-molt-500/40 cursor-pointer' : '',
        !onClick ? 'cursor-default' : '',
        'select-none',
      ].join(' ')}
    >
      {isFaceUp ? (
        <div className="flex flex-col items-center justify-between h-full p-1.5">
          {/* Top value */}
          <div className="self-start">
            <span
              className={`font-mono font-bold ${small ? 'text-xs' : 'text-sm'} ${suit?.color || 'text-white'}`}
            >
              {card.value ?? card.label ?? '?'}
            </span>
          </div>

          {/* Center suit */}
          <div
            className={`${small ? 'text-xl' : 'text-3xl'} ${suit?.color || (card.color ? '' : 'text-white/80')}`}
            style={card.color ? { color: card.color } : undefined}
          >
            {suit?.symbol || card.label || '?'}
          </div>

          {/* Bottom value */}
          <div className="self-end rotate-180">
            <span
              className={`font-mono font-bold ${small ? 'text-xs' : 'text-sm'} ${suit?.color || 'text-white'}`}
            >
              {card.value ?? card.label ?? '?'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="w-3/4 h-3/4 rounded border border-molt-500/30 bg-molt-500/10 flex items-center justify-center">
            <span className="text-molt-500/50 font-display font-bold text-xs">M</span>
          </div>
        </div>
      )}
    </button>
  );
}

export default function CardRenderer({
  hand,
  table = [],
  onPlayCard,
  onDrawCard,
  playerInfo,
  canDraw = true,
  maxHandDisplay = 10,
}: CardRendererProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCardClick = useCallback(
    (cardId: string) => {
      if (selectedId === cardId) {
        onPlayCard(cardId);
        setSelectedId(null);
      } else {
        setSelectedId(cardId);
      }
    },
    [selectedId, onPlayCard],
  );

  const visibleHand = hand.slice(0, maxHandDisplay);
  const hiddenCount = Math.max(0, hand.length - maxHandDisplay);

  return (
    <div className="flex flex-col gap-5 min-h-[400px]">
      {/* Player info bar */}
      {playerInfo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${playerInfo.isActive ? 'bg-molt-500 animate-pulse' : 'bg-white/20'}`}
            />
            <span className="font-display font-bold text-white">{playerInfo.name}</span>
          </div>
          {playerInfo.score != null && (
            <span className="font-mono text-neon-cyan text-sm">Score: {playerInfo.score}</span>
          )}
        </div>
      )}

      {/* Table / community cards */}
      {table.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Table
          </h3>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {table.map((card) => (
              <CardComponent key={card.id} card={card} small />
            ))}
          </div>
        </div>
      )}

      {/* Draw pile */}
      {onDrawCard && (
        <div className="flex justify-center">
          <button
            onClick={onDrawCard}
            disabled={!canDraw}
            className={[
              'px-5 py-2.5 rounded-lg font-display font-bold text-sm',
              'bg-molt-500/10 border border-molt-500/30 text-molt-300',
              'hover:bg-molt-500/20 hover:border-molt-500/50',
              'transition-all duration-150 active:scale-95',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'select-none cursor-pointer',
            ].join(' ')}
          >
            Draw Card
          </button>
        </div>
      )}

      {/* Player hand */}
      <div className="glass-card p-4 mt-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Your Hand
          </h3>
          <span className="text-xs font-mono text-white/30">
            {hand.length} card{hand.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-end justify-center gap-2 flex-wrap min-h-[120px]">
          {visibleHand.map((card) => (
            <CardComponent
              key={card.id}
              card={{ ...card, faceUp: true }}
              onClick={() => handleCardClick(card.id)}
              selected={selectedId === card.id}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="w-20 h-28 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
              <span className="text-xs font-mono text-white/30">+{hiddenCount}</span>
            </div>
          )}
        </div>
        {selectedId && (
          <p className="text-xs text-white/40 text-center mt-2">
            Click the selected card again to play it
          </p>
        )}
      </div>
    </div>
  );
}

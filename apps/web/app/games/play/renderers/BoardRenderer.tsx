'use client';

import { useState, useCallback, type ReactNode } from 'react';

interface BoardRendererProps {
  board: (string | number | null)[][];
  onCellClick: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number } | null;
  validMoves?: { row: number; col: number }[];
  cellSize?: number;
  pieceMap?: Record<string | number, ReactNode>;
  lightColor?: string;
  darkColor?: string;
}

export default function BoardRenderer({
  board,
  onCellClick,
  selectedCell = null,
  validMoves = [],
  cellSize = 56,
  pieceMap = {},
  lightColor = 'bg-surface-hover',
  darkColor = 'bg-surface-dark',
}: BoardRendererProps) {
  const [hoverCell, setHoverCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;

  const isSelected = useCallback(
    (r: number, c: number) =>
      selectedCell != null && selectedCell.row === r && selectedCell.col === c,
    [selectedCell],
  );

  const isValidMove = useCallback(
    (r: number, c: number) => validMoves.some((m) => m.row === r && m.col === c),
    [validMoves],
  );

  const isHovered = useCallback(
    (r: number, c: number) => hoverCell != null && hoverCell.row === r && hoverCell.col === c,
    [hoverCell],
  );

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Column labels */}
      <div className="flex" style={{ paddingLeft: cellSize * 0.6 }}>
        {Array.from({ length: cols }).map((_, c) => (
          <div
            key={`col-${c}`}
            className="text-[10px] font-mono text-white/30 text-center"
            style={{ width: cellSize }}
          >
            {String.fromCharCode(65 + c)}
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Row labels */}
        <div className="flex flex-col justify-around" style={{ width: cellSize * 0.6 }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={`row-${r}`}
              className="text-[10px] font-mono text-white/30 text-center"
              style={{ height: cellSize, lineHeight: `${cellSize}px` }}
            >
              {rows - r}
            </div>
          ))}
        </div>

        {/* Board grid */}
        <div
          className="border border-white/10 rounded-lg overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isDark = (r + c) % 2 === 1;
              const selected = isSelected(r, c);
              const valid = isValidMove(r, c);
              const hovered = isHovered(r, c);
              const piece = cell != null ? pieceMap[cell] : null;

              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onCellClick(r, c)}
                  onMouseEnter={() => setHoverCell({ row: r, col: c })}
                  onMouseLeave={() => setHoverCell(null)}
                  className={[
                    'relative flex items-center justify-center',
                    'transition-all duration-150',
                    'select-none cursor-pointer',
                    'focus:outline-none',
                    isDark ? darkColor : lightColor,
                    selected ? 'ring-2 ring-inset ring-neon-cyan shadow-neon-sm z-10' : '',
                    valid && !selected ? 'ring-2 ring-inset ring-molt-500/60' : '',
                    hovered && !selected ? 'brightness-125' : '',
                  ].join(' ')}
                  style={{ width: cellSize, height: cellSize }}
                >
                  {/* Valid move dot */}
                  {valid && !piece && (
                    <div className="absolute w-3 h-3 rounded-full bg-molt-500/40" />
                  )}

                  {/* Piece */}
                  {piece != null && (
                    <div
                      className={`text-2xl transition-transform duration-150 ${
                        selected ? 'scale-110' : ''
                      }`}
                    >
                      {piece}
                    </div>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';

type CellState = 'empty' | 'filled' | 'clue' | 'selected' | 'error';

interface CellData {
  value: string | number | null;
  state: CellState;
  editable?: boolean;
}

interface PuzzleGridRendererProps {
  grid: CellData[][];
  onCellClick: (row: number, col: number, value?: string | number) => void;
  clues?: {
    rows?: (string | number)[][];
    cols?: (string | number)[][];
  };
  revealed?: { row: number; col: number }[];
  inputMode?: 'number' | 'toggle' | 'symbol';
  symbols?: string[];
  title?: string;
}

const NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function PuzzleGridRenderer({
  grid,
  onCellClick,
  clues,
  revealed = [],
  inputMode = 'number',
  symbols = [],
  title,
}: PuzzleGridRendererProps) {
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  const isRevealed = useCallback(
    (r: number, c: number) => revealed.some((rv) => rv.row === r && rv.col === c),
    [revealed],
  );

  const handleCellSelect = useCallback(
    (r: number, c: number) => {
      const cell = grid[r][c];
      if (inputMode === 'toggle') {
        onCellClick(r, c);
        return;
      }
      if (cell.state === 'clue' || !cell.editable) return;
      setSelectedCell({ row: r, col: c });
    },
    [grid, inputMode, onCellClick],
  );

  const handleInput = useCallback(
    (value: string | number) => {
      if (!selectedCell) return;
      onCellClick(selectedCell.row, selectedCell.col, value);
    },
    [selectedCell, onCellClick],
  );

  const handleClear = useCallback(() => {
    if (!selectedCell) return;
    onCellClick(selectedCell.row, selectedCell.col, '');
  }, [selectedCell, onCellClick]);

  const cellSize = Math.max(36, Math.min(52, Math.floor(400 / Math.max(rows, cols))));

  const getCellStyle = (cell: CellData, r: number, c: number): string => {
    const isSelected = selectedCell != null && selectedCell.row === r && selectedCell.col === c;
    const wasRevealed = isRevealed(r, c);

    const base = 'flex items-center justify-center font-mono font-bold transition-all duration-150';

    if (isSelected) {
      return `${base} ring-2 ring-neon-cyan bg-neon-cyan/10 text-white z-10`;
    }

    switch (cell.state) {
      case 'clue':
        return `${base} bg-surface-mid text-white/90`;
      case 'filled':
        return `${base} ${wasRevealed ? 'bg-molt-500/10 text-molt-300' : 'bg-surface-hover text-white'}`;
      case 'error':
        return `${base} bg-accent-coral/10 text-accent-coral border-accent-coral/40`;
      case 'selected':
        return `${base} bg-molt-500/10 text-neon-cyan`;
      default:
        return `${base} bg-surface-dark text-white/20 hover:bg-white/5`;
    }
  };

  const hasRowClues = clues?.rows && clues.rows.length > 0;
  const hasColClues = clues?.cols && clues.cols.length > 0;

  return (
    <div className="flex flex-col items-center gap-5">
      {title && <h3 className="font-display font-bold text-lg text-white">{title}</h3>}

      <div className="flex flex-col items-center">
        {/* Column clues */}
        {hasColClues && (
          <div className="flex" style={{ paddingLeft: hasRowClues ? cellSize * 2 : 0 }}>
            {clues!.cols!.map((colClue, c) => (
              <div
                key={`cclue-${c}`}
                className="flex flex-col items-center justify-end gap-0.5 pb-1"
                style={{ width: cellSize }}
              >
                {colClue.map((v, i) => (
                  <span
                    key={`cc-${c}-${i}`}
                    className="text-[10px] font-mono text-white/40 leading-tight"
                  >
                    {v}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex">
          {/* Row clues */}
          {hasRowClues && (
            <div className="flex flex-col">
              {clues!.rows!.map((rowClue, r) => (
                <div
                  key={`rclue-${r}`}
                  className="flex items-center justify-end gap-1 pr-2"
                  style={{ height: cellSize, minWidth: cellSize * 2 }}
                >
                  {rowClue.map((v, i) => (
                    <span key={`rc-${r}-${i}`} className="text-[10px] font-mono text-white/40">
                      {v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div
            className="border border-white/10 rounded-lg overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const borderRight =
                  c < cols - 1 && (c + 1) % 3 === 0
                    ? 'border-r border-white/20'
                    : c < cols - 1
                      ? 'border-r border-white/5'
                      : '';
                const borderBottom =
                  r < rows - 1 && (r + 1) % 3 === 0
                    ? 'border-b border-white/20'
                    : r < rows - 1
                      ? 'border-b border-white/5'
                      : '';

                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => handleCellSelect(r, c)}
                    className={[
                      getCellStyle(cell, r, c),
                      borderRight,
                      borderBottom,
                      'select-none cursor-pointer focus:outline-none',
                      cell.state === 'clue' ? 'cursor-default' : '',
                    ].join(' ')}
                    style={{ width: cellSize, height: cellSize, fontSize: cellSize * 0.45 }}
                  >
                    {cell.value != null && cell.value !== '' ? cell.value : ''}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>

      {/* Input controls */}
      {inputMode === 'number' && (
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {NUMBER_KEYS.map((n) => (
              <button
                key={n}
                onClick={() => handleInput(parseInt(n, 10))}
                disabled={!selectedCell}
                className={[
                  'w-10 h-10 rounded-lg font-mono font-bold text-lg',
                  'bg-surface-hover border border-white/10 text-white',
                  'hover:bg-molt-500/20 hover:border-molt-500/30',
                  'transition-all duration-100 active:scale-90',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={!selectedCell}
              className={[
                'px-4 h-10 rounded-lg font-mono text-sm',
                'bg-accent-coral/10 border border-accent-coral/20 text-accent-coral',
                'hover:bg-accent-coral/20 hover:border-accent-coral/40',
                'transition-all duration-100 active:scale-90',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'select-none cursor-pointer',
              ].join(' ')}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {inputMode === 'symbol' && symbols.length > 0 && (
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {symbols.map((sym) => (
              <button
                key={sym}
                onClick={() => handleInput(sym)}
                disabled={!selectedCell}
                className={[
                  'w-10 h-10 rounded-lg font-mono font-bold',
                  'bg-surface-hover border border-white/10 text-white',
                  'hover:bg-molt-500/20 hover:border-molt-500/30',
                  'transition-all duration-100 active:scale-90',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                {sym}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={!selectedCell}
              className={[
                'px-4 h-10 rounded-lg font-mono text-sm',
                'bg-accent-coral/10 border border-accent-coral/20 text-accent-coral',
                'hover:bg-accent-coral/20 hover:border-accent-coral/40',
                'transition-all duration-100 active:scale-90',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'select-none cursor-pointer',
              ].join(' ')}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

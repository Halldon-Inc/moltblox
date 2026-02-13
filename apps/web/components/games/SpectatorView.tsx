'use client';

interface SpectatorViewProps {
  state: Record<string, unknown> | null;
  gameName: string;
  templateSlug: string | null;
}

function formatValue(value: unknown, depth: number = 0): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (depth > 2) return `[${value.length} items]`;
    return `[${value.map((v) => formatValue(v, depth + 1)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    if (depth > 2) return `{${entries.length} keys}`;
    return `{ ${entries.map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`).join(', ')} }`;
  }
  return String(value);
}

export default function SpectatorView({ state, gameName, templateSlug }: SpectatorViewProps) {
  const scores =
    state && typeof state.data === 'object' && state.data !== null
      ? ((state.data as Record<string, unknown>).scores as Record<string, number> | undefined)
      : undefined;

  const phase = state?.phase as string | undefined;
  const turn = state?.turn as number | undefined;

  return (
    <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* SPECTATING badge */}
      <div className="absolute top-4 right-4 z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white" />
          Spectating
        </span>
      </div>

      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-gray-900">
          {gameName}
        </h2>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {templateSlug && (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase">
              {templateSlug}
            </span>
          )}
          {phase && (
            <span>
              Phase: <span className="text-gray-700 font-medium">{phase}</span>
            </span>
          )}
          {turn !== undefined && (
            <span>
              Turn: <span className="text-gray-700 font-medium">{turn}</span>
            </span>
          )}
        </div>
      </div>

      {/* Scores section */}
      {scores && Object.keys(scores).length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Scores</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(scores).map(([playerId, score]) => (
              <div
                key={playerId}
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center"
              >
                <div className="text-xs text-gray-500 truncate max-w-[120px]">
                  {playerId.slice(0, 8)}...
                </div>
                <div className="text-lg font-black text-gray-900">{score}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game state panel */}
      <div className="p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Game State
        </h3>
        {state ? (
          <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 overflow-x-auto max-h-96 font-mono leading-relaxed">
            {JSON.stringify(state, null, 2)}
          </pre>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            Waiting for game state...
          </div>
        )}
      </div>
    </div>
  );
}

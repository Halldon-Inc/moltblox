'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RhythmGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

type HitRating = 'perfect' | 'good' | 'ok' | 'miss';

interface Note {
  id: number;
  lane: 0 | 1 | 2 | 3;
  beatTime: number;
  hit: boolean;
  missed: boolean;
}

interface RhythmData {
  notes: Note[];
  currentBeat: number;
  totalBeats: number;
  bpm: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  maxCombos: Record<string, number>;
  multipliers: Record<string, number>;
  hitCounts: Record<string, Record<HitRating, number>>;
  difficulty: string;
  songComplete: boolean;
}

const LANE_COLORS = ['#ff6b6b', '#ffb74d', '#4fc3f7', '#81c784'] as const;
const LANE_KEYS = ['D', 'F', 'J', 'K'] as const;
const KEY_TO_LANE: Record<string, number> = { d: 0, f: 1, j: 2, k: 3 };

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const LANE_WIDTH = CANVAS_WIDTH / 4;
const HIT_ZONE_Y = CANVAS_HEIGHT * 0.8;
const NOTE_HEIGHT = 18;
const NOTE_WIDTH = LANE_WIDTH - 16;
const VISIBLE_BEATS_AHEAD = 8;

const DEFAULT_DATA: RhythmData = {
  notes: [],
  currentBeat: 0,
  totalBeats: 64,
  bpm: 120,
  scores: {},
  combos: {},
  maxCombos: {},
  multipliers: {},
  hitCounts: {},
  difficulty: 'normal',
  songComplete: false,
};

export default function RhythmRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(RhythmGame);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [started, setStarted] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('normal');
  const hitFlashRef = useRef<Record<number, string>>({});
  const ratingPopupRef = useRef<{
    text: string;
    lane: number;
    time: number;
  } | null>(null);
  const prevEventsLen = useRef(0);

  const data = (state?.data as unknown as RhythmData) ?? DEFAULT_DATA;
  const myScore = data.scores[playerId] ?? 0;
  const myCombo = data.combos[playerId] ?? 0;
  const myMultiplier = data.multipliers[playerId] ?? 1;
  const myHits = data.hitCounts[playerId] ?? { perfect: 0, good: 0, ok: 0, miss: 0 };
  const totalHits = myHits.perfect + myHits.good + myHits.ok;
  const totalAttempts = totalHits + myHits.miss;
  const accuracy = totalAttempts > 0 ? Math.round((totalHits / totalAttempts) * 100) : 100;
  const beatProgress = data.totalBeats > 0 ? (data.currentBeat / data.totalBeats) * 100 : 0;

  // Listen for hit/miss events to trigger visual feedback
  useEffect(() => {
    if (events.length > prevEventsLen.current) {
      const newEvents = events.slice(prevEventsLen.current);
      for (const ev of newEvents) {
        if (ev.type === 'note_hit') {
          const lane = (ev.data as { lane: number; rating: string }).lane;
          const rating = (ev.data as { rating: string }).rating;
          const labels: Record<string, string> = { perfect: 'Perfect!', good: 'Good!', ok: 'OK!' };
          hitFlashRef.current = { ...hitFlashRef.current, [lane]: LANE_COLORS[lane] };
          ratingPopupRef.current = { text: labels[rating] || rating, lane, time: Date.now() };
          setTimeout(() => {
            const next = { ...hitFlashRef.current };
            delete next[lane];
            hitFlashRef.current = next;
          }, 200);
          setTimeout(() => {
            if (ratingPopupRef.current && ratingPopupRef.current.time <= Date.now() - 500) {
              ratingPopupRef.current = null;
            }
          }, 600);
        }
        if (ev.type === 'note_missed') {
          const lane = (ev.data as { lane: number }).lane;
          hitFlashRef.current = { ...hitFlashRef.current, [lane]: '#333' };
          setTimeout(() => {
            const next = { ...hitFlashRef.current };
            delete next[lane];
            hitFlashRef.current = next;
          }, 300);
        }
      }
    }
    prevEventsLen.current = events.length;
  }, [events]);

  // Auto-advance beat at BPM rate
  useEffect(() => {
    if (!started || isGameOver || data.songComplete) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const msPerBeat = (60 / data.bpm) * 1000;
    intervalRef.current = setInterval(() => {
      dispatch('advance_beat');
    }, msPerBeat);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [started, isGameOver, data.songComplete, data.bpm, dispatch]);

  // Keyboard input
  useEffect(() => {
    if (!started || isGameOver) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const lane = KEY_TO_LANE[e.key.toLowerCase()];
      if (lane !== undefined) {
        e.preventDefault();
        dispatch('hit_note', { lane });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, isGameOver, dispatch]);

  // Keep data in a ref so the RAF loop doesn't tear down on every state change
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Canvas rendering loop — runs once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Lane dividers
      for (let i = 0; i <= 4; i++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * LANE_WIDTH, 0);
        ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT);
        ctx.stroke();
      }

      // Lane background tint
      const hf = hitFlashRef.current;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = hf[i]
          ? hf[i] === '#333'
            ? 'rgba(50,50,50,0.3)'
            : `${LANE_COLORS[i]}22`
          : 'rgba(255,255,255,0.02)';
        ctx.fillRect(i * LANE_WIDTH + 1, 0, LANE_WIDTH - 2, CANVAS_HEIGHT);
      }

      // Hit zone line (glowing)
      const gradient = ctx.createLinearGradient(0, HIT_ZONE_Y - 3, 0, HIT_ZONE_Y + 3);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, HIT_ZONE_Y - 3, CANVAS_WIDTH, 6);

      // Lane target circles at hit zone
      for (let i = 0; i < 4; i++) {
        const cx = i * LANE_WIDTH + LANE_WIDTH / 2;
        ctx.beginPath();
        ctx.arc(cx, HIT_ZONE_Y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = hf[i] && hf[i] !== '#333' ? LANE_COLORS[i] : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = hf[i] && hf[i] !== '#333' ? 3 : 2;
        ctx.stroke();

        // Flash fill
        if (hf[i] && hf[i] !== '#333') {
          ctx.beginPath();
          ctx.arc(cx, HIT_ZONE_Y, 14, 0, Math.PI * 2);
          ctx.fillStyle = `${LANE_COLORS[i]}66`;
          ctx.fill();
        }
      }

      // Draw notes
      const d = dataRef.current;
      const currentBeat = d.currentBeat;
      for (const note of d.notes) {
        if (note.hit || note.missed) continue;

        const beatsAway = note.beatTime - currentBeat;
        // Only render notes that are within visible range
        if (beatsAway < -1 || beatsAway > VISIBLE_BEATS_AHEAD) continue;

        // Map beat position to Y: notes at currentBeat are at HIT_ZONE_Y,
        // notes VISIBLE_BEATS_AHEAD ahead are at top
        const yRatio = 1 - beatsAway / VISIBLE_BEATS_AHEAD;
        const y = yRatio * HIT_ZONE_Y;

        const x = note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_WIDTH) / 2;
        const color = LANE_COLORS[note.lane];

        // Highlight notes near hit zone (within 2 beats)
        const isNearHitZone = Math.abs(beatsAway) <= 2;

        // Note glow
        if (isNearHitZone) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
        }

        // Note body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y - NOTE_HEIGHT / 2, NOTE_WIDTH, NOTE_HEIGHT, 4);
        ctx.fill();

        // Note shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y - NOTE_HEIGHT / 2 + 2, NOTE_WIDTH - 4, NOTE_HEIGHT / 3, 2);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Rating popup
      const rp = ratingPopupRef.current;
      if (rp) {
        const age = Date.now() - rp.time;
        if (age < 600) {
          const alpha = Math.max(0, 1 - age / 600);
          const popupY = HIT_ZONE_Y - 40 - (age / 600) * 30;
          const cx = rp.lane * LANE_WIDTH + LANE_WIDTH / 2;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle =
            rp.text === 'Perfect!' ? '#ffd700' : rp.text === 'Good!' ? '#4fc3f7' : '#aaa';
          ctx.fillText(rp.text, cx, popupY);
          ctx.restore();
        }
      }

      // Keyboard hints at bottom
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        const cx = i * LANE_WIDTH + LANE_WIDTH / 2;
        const ky = CANVAS_HEIGHT - 20;

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(cx - 14, ky - 12, 28, 24, 6);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(LANE_KEYS[i], cx, ky);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleStart = useCallback(
    (difficulty: string) => {
      dispatch('set_difficulty', { difficulty });
      setStarted(true);
    },
    [dispatch],
  );

  const handleRestart = useCallback(() => {
    setStarted(false);
    hitFlashRef.current = {};
    ratingPopupRef.current = null;
    prevEventsLen.current = 0;
    restart();
  }, [restart]);

  const handleLaneClick = useCallback(
    (lane: number) => {
      if (!started || isGameOver) return;
      dispatch('hit_note', { lane });
    },
    [started, isGameOver, dispatch],
  );

  return (
    <GameShell
      name="Beat Blaster"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={handleRestart}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Difficulty selector (before starting) */}
        {!started && (
          <div className="flex flex-col items-center gap-6 py-8">
            <h2 className="text-xl font-display font-bold text-white/90">Select Difficulty</h2>
            <div className="flex gap-3">
              {(['easy', 'normal', 'hard'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={[
                    'px-5 py-2.5 rounded-lg font-semibold text-sm capitalize transition-all duration-150',
                    selectedDifficulty === diff
                      ? 'bg-molt-500 text-white shadow-lg shadow-molt-500/30'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
                  ].join(' ')}
                >
                  {diff}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40 max-w-[300px] text-center">
              {selectedDifficulty === 'easy' && 'Relaxed pace, fewer notes. Great for learning.'}
              {selectedDifficulty === 'normal' && 'Balanced challenge with moderate note density.'}
              {selectedDifficulty === 'hard' &&
                'Dense patterns with chords. For experienced players.'}
            </p>
            <button
              onClick={() => handleStart(selectedDifficulty)}
              className={[
                'px-8 py-3 rounded-xl font-display font-bold text-lg',
                'bg-gradient-to-r from-molt-500 to-neon-cyan text-white',
                'shadow-lg shadow-molt-500/30',
                'hover:shadow-xl hover:shadow-molt-500/50',
                'transition-all duration-150',
                'active:scale-95',
              ].join(' ')}
            >
              Start
            </button>
          </div>
        )}

        {/* Stats bar (once started) */}
        {started && (
          <>
            <div className="flex items-center justify-center gap-6 w-full max-w-[420px]">
              {/* Score */}
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-neon-cyan tabular-nums">
                  {myScore.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Score</div>
              </div>

              {/* Combo */}
              <div className="text-center">
                <div className="text-xl font-mono font-bold text-accent-amber tabular-nums">
                  {myCombo > 0 ? `${myCombo}x` : '--'}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">
                  Combo {myMultiplier > 1 ? `(${myMultiplier}x)` : ''}
                </div>
              </div>

              {/* Accuracy */}
              <div className="text-center">
                <div className="text-xl font-mono font-bold text-white/80 tabular-nums">
                  {accuracy}%
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Accuracy</div>
              </div>
            </div>

            {/* Canvas game area */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="rounded-xl border border-white/10"
                style={{ imageRendering: 'auto' }}
              />

              {/* Clickable lane overlays for touch/mouse */}
              <div className="absolute inset-0 flex rounded-xl overflow-hidden">
                {[0, 1, 2, 3].map((lane) => (
                  <button
                    key={lane}
                    onClick={() => handleLaneClick(lane)}
                    className="flex-1 opacity-0 hover:opacity-100 cursor-pointer transition-opacity duration-75"
                    style={{ background: `${LANE_COLORS[lane]}08` }}
                    aria-label={`Lane ${lane + 1} (${LANE_KEYS[lane]})`}
                  />
                ))}
              </div>
            </div>

            {/* Beat progress bar */}
            <div className="w-full max-w-[400px]">
              <div className="flex justify-between text-[10px] text-white/40 mb-1">
                <span>Beat {data.currentBeat}</span>
                <span>{data.totalBeats}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-molt-500 to-neon-cyan rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${Math.min(beatProgress, 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}

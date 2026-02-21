'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ClickerGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';
import { MousePointerClick, Zap } from 'lucide-react';

interface ClickerData {
  clicks: Record<string, number>;
  targetClicks: number;
  lastAction: string | null;
}

interface ClickParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const PARTICLE_COLORS = ['#e87927', '#00e5ff', '#ff6b6b', '#ffd700', '#81c784', '#ff80ab'];

let particleIdCounter = 0;

function spawnClickParticles(x: number, y: number, count: number): ClickParticle[] {
  const particles: ClickParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1.5;
    particles.push({
      id: particleIdCounter++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 600 + Math.random() * 400,
      maxLife: 800,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      size: 3 + Math.random() * 4,
    });
  }
  return particles;
}

export default function ClickerRenderer({
  gameName,
  gameConfig,
}: {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}) {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } = useGameEngine(
    ClickerGame,
    gameConfig,
  );

  const [ripple, setRipple] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const [particles, setParticles] = useState<ClickParticle[]>([]);
  const prevEventsLen = useRef(0);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<ClickParticle[]>([]);
  const lastTimeRef = useRef(0);
  const rippleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = (state?.data as unknown as ClickerData) ?? {
    clicks: {},
    targetClicks: 100,
    lastAction: null,
  };
  const myClicks = data.clicks[playerId] ?? 0;
  const target = data.targetClicks;
  const progress = Math.min((myClicks / target) * 100, 100);

  // Particle animation loop
  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const current = particlesRef.current;
      if (current.length > 0) {
        const alive: ClickParticle[] = [];
        for (const p of current) {
          p.life -= dt;
          if (p.life > 0) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // gravity
            alive.push(p);
          }
        }
        particlesRef.current = alive;
        setParticles([...alive]);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    };
  }, []);

  // Detect new milestone events
  useEffect(() => {
    if (events.length > prevEventsLen.current) {
      const newEvents = events.slice(prevEventsLen.current);
      if (newEvents.some((e) => e.type === 'milestone')) {
        setMilestone(true);
        // Spawn burst of particles for milestone
        const burst = spawnClickParticles(0, 0, 16);
        particlesRef.current = [...particlesRef.current, ...burst];
        setParticles([...particlesRef.current]);
        const timer = setTimeout(() => setMilestone(false), 800);
        return () => clearTimeout(timer);
      }
    }
    prevEventsLen.current = events.length;
  }, [events]);

  const handleClick = useCallback(() => {
    dispatch('click');
    setRipple(true);
    // Spawn click particles (centered around 0,0 relative to button)
    const newParticles = spawnClickParticles(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      6,
    );
    particlesRef.current = [...particlesRef.current, ...newParticles];
    setParticles([...particlesRef.current]);
    if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    rippleTimerRef.current = setTimeout(() => setRipple(false), 400);
  }, [dispatch]);

  const handleMultiClick = useCallback(() => {
    dispatch('multi_click', { amount: 5 });
    setRipple(true);
    const newParticles = spawnClickParticles(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      12,
    );
    particlesRef.current = [...particlesRef.current, ...newParticles];
    setParticles([...particlesRef.current]);
    if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    rippleTimerRef.current = setTimeout(() => setRipple(false), 400);
  }, [dispatch]);

  return (
    <GameShell
      name={gameName || 'Click Race'}
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      {/* Scoped keyframes */}
      <style>{`
        @keyframes clicker-ripple {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232,121,39,0.5); }
          50% { transform: scale(1.08); box-shadow: 0 0 30px 10px rgba(232,121,39,0.3); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232,121,39,0); }
        }
        @keyframes clicker-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes milestone-flash {
          0% { opacity: 0; transform: scale(0.8); }
          20% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes milestone-particle {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.5); }
        }
        @keyframes clicker-bg-drift {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        @keyframes score-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .clicker-btn-ripple { animation: clicker-ripple 0.4s ease-out; }
        .clicker-ring { animation: clicker-pulse-ring 0.6s ease-out forwards; }
        .milestone-burst { animation: milestone-flash 0.8s ease-out forwards; }
        .milestone-particle { animation: milestone-particle 0.8s ease-out forwards; }
      `}</style>

      <div className="flex flex-col items-center justify-center min-h-[420px] gap-8 relative overflow-hidden">
        {/* Background pattern: subtle animated gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(232,121,39,0.06) 0%, transparent 50%), ' +
              'radial-gradient(ellipse at 70% 80%, rgba(0,229,255,0.05) 0%, transparent 50%), ' +
              'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.01) 40px, rgba(255,255,255,0.01) 41px)',
          }}
        />

        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
          }}
        />

        {/* Milestone celebration overlay */}
        {milestone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="milestone-burst text-3xl font-display font-bold"
              style={{
                color: '#e87927',
                textShadow: '0 0 20px rgba(232,121,39,0.8), 0 0 40px rgba(232,121,39,0.4)',
              }}
            >
              Milestone!
            </div>
            {/* Particles */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="milestone-particle absolute w-2 h-2 rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `rotate(${i * 45}deg) translateX(40px)`,
                  animationDelay: `${i * 0.05}s`,
                  backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                  boxShadow: `0 0 6px ${PARTICLE_COLORS[i % PARTICLE_COLORS.length]}`,
                }}
              />
            ))}
          </div>
        )}

        {/* Click count with glow and drop shadow */}
        <div className="text-center relative z-[2]">
          <div
            className="text-6xl font-mono font-bold tabular-nums"
            style={{
              color: '#00e5ff',
              textShadow:
                '0 0 10px rgba(0,229,255,0.6), 0 0 30px rgba(0,229,255,0.3), 0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {myClicks}
          </div>
          <div
            className="text-sm mt-1"
            style={{
              color: 'rgba(255,255,255,0.5)',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            of {target} clicks
          </div>
        </div>

        {/* Progress bar with glow */}
        <div className="w-full max-w-xs relative z-[2]">
          <div className="flex justify-between text-xs text-white/50 mb-1.5">
            <span>Progress</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-150 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #e87927, #00e5ff)',
                boxShadow:
                  progress > 5
                    ? '0 0 8px rgba(0,229,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                    : 'none',
              }}
            />
          </div>
        </div>

        {/* Click button with enhanced visuals */}
        <div className="relative z-[2]">
          {/* Ambient glow behind button */}
          <div
            className="absolute inset-[-20px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(232,121,39,0.15) 0%, transparent 70%)',
            }}
          />

          {/* Click particles */}
          {particles.map((p) => {
            const alpha = Math.max(0, p.life / p.maxLife);
            return (
              <div
                key={p.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `calc(50% + ${p.x}px)`,
                  top: `calc(50% + ${p.y}px)`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  opacity: alpha,
                  boxShadow: `0 0 ${p.size + 2}px ${p.color}`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}

          {/* Ripple ring */}
          {ripple && (
            <div className="clicker-ring absolute inset-0 rounded-full border-2 border-molt-500 pointer-events-none" />
          )}

          <button
            onClick={handleClick}
            disabled={isGameOver}
            className={[
              'relative w-[150px] h-[150px] rounded-full',
              'flex flex-col items-center justify-center gap-1',
              'text-white font-display font-bold text-lg',
              'transition-all duration-150',
              'active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-molt-500/50 focus:ring-offset-2 focus:ring-offset-surface-dark',
              'select-none cursor-pointer',
              ripple ? 'clicker-btn-ripple' : '',
            ].join(' ')}
            style={{
              background:
                'radial-gradient(circle at 40% 35%, #f5993d 0%, #e87927 40%, #c4601a 100%)',
              boxShadow: ripple
                ? '0 0 30px 10px rgba(232,121,39,0.4), inset 0 2px 0 rgba(255,255,255,0.2), 0 4px 15px rgba(0,0,0,0.3)'
                : '0 0 15px 3px rgba(232,121,39,0.3), inset 0 2px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <MousePointerClick className="w-8 h-8 drop-shadow-lg" />
            CLICK
          </button>
        </div>

        {/* Multi-click button with enhanced style */}
        <button
          onClick={handleMultiClick}
          disabled={isGameOver}
          className={[
            'relative z-[2] flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-semibold',
            'transition-all duration-150',
            'active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'select-none cursor-pointer',
          ].join(' ')}
          style={{
            background:
              'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(0,229,255,0.05) 100%)',
            border: '1px solid rgba(0,229,255,0.3)',
            color: '#00e5ff',
            boxShadow: '0 0 8px rgba(0,229,255,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <Zap className="w-4 h-4" />
          Multi-Click (x5)
        </button>
      </div>
    </GameShell>
  );
}

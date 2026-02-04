'use client';

const CUBE_COLORS = [
  'bg-molt-400',
  'bg-molt-600',
  'bg-neon-cyan',
  'bg-neon-pink',
  'bg-accent-coral',
  'bg-molt-950',
  'bg-white',
];

interface FloatingCubesProps {
  count: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export default function FloatingCubes({ count }: FloatingCubesProps) {
  const cubes = Array.from({ length: count }, (_, i) => {
    const r = (step: number) => seededRandom(i * 7 + step);
    const size = 8 + Math.floor(r(0) * 10);
    const left = r(1) * 100;
    const top = r(2) * 100;
    const color = CUBE_COLORS[Math.floor(r(3) * CUBE_COLORS.length)];
    const delay = r(4) * 20;
    const duration = 16 + r(5) * 16;
    const opacity = 0.15 + r(6) * 0.35;

    return (
      <span
        key={i}
        className={`voxel-cube ${color}`}
        style={{
          width: size,
          height: size,
          left: `${left}%`,
          top: `${top}%`,
          opacity,
          animationDelay: `${-delay}s`,
          animationDuration: `${duration}s`,
        }}
      />
    );
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {cubes}
    </div>
  );
}

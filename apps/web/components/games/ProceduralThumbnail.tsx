'use client';

/* ------------------------------------------------------------------ */
/*  ProceduralThumbnail: deterministic SVG thumbnails from game metadata */
/* ------------------------------------------------------------------ */

interface ProceduralThumbnailProps {
  name: string;
  genre?: string;
  templateSlug?: string | null;
  className?: string;
}

/* ---- Deterministic 32-bit hash ---- */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h >>> 0; // unsigned
}

/* ---- Genre color palettes ---- */
interface GenreColors {
  hueMin: number;
  hueMax: number;
  sat: number;
  lit: number;
}

const GENRE_PALETTE: Record<string, GenreColors> = {
  arcade: { hueMin: 320, hueMax: 350, sat: 75, lit: 50 },
  puzzle: { hueMin: 170, hueMax: 200, sat: 60, lit: 45 },
  multiplayer: { hueMin: 30, hueMax: 60, sat: 80, lit: 50 },
  casual: { hueMin: 100, hueMax: 140, sat: 55, lit: 45 },
  competitive: { hueMin: 0, hueMax: 20, sat: 75, lit: 45 },
  strategy: { hueMin: 210, hueMax: 240, sat: 65, lit: 40 },
  action: { hueMin: 15, hueMax: 40, sat: 80, lit: 48 },
  rpg: { hueMin: 260, hueMax: 290, sat: 60, lit: 42 },
  simulation: { hueMin: 140, hueMax: 170, sat: 50, lit: 42 },
  sports: { hueMin: 80, hueMax: 110, sat: 60, lit: 42 },
  card: { hueMin: 350, hueMax: 380, sat: 65, lit: 38 },
  board: { hueMin: 25, hueMax: 45, sat: 50, lit: 35 },
  other: { hueMin: 190, hueMax: 220, sat: 30, lit: 35 },
};

function getGenreColors(genre: string, hash: number): { primary: string; secondary: string } {
  const key = genre.toLowerCase();
  const palette = GENRE_PALETTE[key] ?? GENRE_PALETTE.other;
  const range = palette.hueMax - palette.hueMin;
  const offset = (hash % 31) - 15; // +/- 15 degrees
  const hue = palette.hueMin + (((hash % range) + range) % range) + offset;
  const h = ((hue % 360) + 360) % 360;
  return {
    primary: `hsl(${h}, ${palette.sat}%, ${palette.lit}%)`,
    secondary: `hsl(${(h + 30) % 360}, ${Math.max(palette.sat - 15, 20)}%, ${Math.max(palette.lit - 12, 15)}%)`,
  };
}

/* ---- Template category detection ---- */
type TemplateCategory =
  | 'original'
  | 'beat-em-up'
  | 'os'
  | 'tp'
  | 'bgio'
  | 'rlcard'
  | 'cv'
  | 'fbg'
  | 'mg'
  | 'wg'
  | 'sol'
  | 'cg'
  | 'ig'
  | 'unknown';

const BEAT_EM_UP_SLUGS = [
  'side-battler',
  'street-fighter',
  'arena-brawl',
  'kung-fu',
  'boxing-ring',
  'karate-clash',
  'ninja-fight',
  'robot-wars',
  'sword-duel',
  'wrestling-ring',
];

function getTemplateCategory(slug: string | null | undefined): TemplateCategory {
  if (!slug) return 'unknown';
  const s = slug.toLowerCase();
  if (BEAT_EM_UP_SLUGS.some((b) => s.includes(b))) return 'beat-em-up';
  if (s.startsWith('os-')) return 'os';
  if (s.startsWith('tp-')) return 'tp';
  if (s.startsWith('bgio-')) return 'bgio';
  if (s.startsWith('rlcard-')) return 'rlcard';
  if (s.startsWith('cv-')) return 'cv';
  if (s.startsWith('fbg-')) return 'fbg';
  if (s.startsWith('mg-')) return 'mg';
  if (s.startsWith('wg-')) return 'wg';
  if (s.startsWith('sol-')) return 'sol';
  if (s.startsWith('cg-')) return 'cg';
  if (s.startsWith('ig-')) return 'ig';
  return 'original';
}

/* ---- SVG pattern renderers ---- */
function renderPattern(category: TemplateCategory, patternId: string) {
  const opacity = 0.12;
  const fill = `rgba(255,255,255,${opacity})`;
  const stroke = `rgba(255,255,255,${opacity})`;

  switch (category) {
    case 'os': // Hex grid
      return (
        <pattern id={patternId} width="30" height="26" patternUnits="userSpaceOnUse">
          <polygon
            points="15,0 30,7.5 30,22.5 15,26 0,22.5 0,7.5"
            fill="none"
            stroke={stroke}
            strokeWidth="0.8"
          />
        </pattern>
      );
    case 'tp': // Crosshatch diagonals
      return (
        <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="16" y2="16" stroke={stroke} strokeWidth="0.7" />
          <line x1="16" y1="0" x2="0" y2="16" stroke={stroke} strokeWidth="0.7" />
        </pattern>
      );
    case 'bgio': // Checkerboard
      return (
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill={fill} />
          <rect x="10" y="10" width="10" height="10" fill={fill} />
        </pattern>
      );
    case 'rlcard': // Diamond repeats
      return (
        <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
          <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke={stroke} strokeWidth="0.8" />
        </pattern>
      );
    case 'cv': // Chess squares
      return (
        <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={fill} />
          <rect x="12" y="12" width="12" height="12" fill={fill} />
        </pattern>
      );
    case 'fbg': // Polka dots
      return (
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="3" fill={fill} />
        </pattern>
      );
    case 'mg': // Pixel squares
      return (
        <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="5" height="5" fill={fill} />
          <rect x="9" y="9" width="5" height="5" fill={fill} />
        </pattern>
      );
    case 'wg': // Letter scatter
      return (
        <pattern id={patternId} width="30" height="30" patternUnits="userSpaceOnUse">
          <text x="5" y="15" fontSize="12" fill={fill} fontFamily="monospace">
            A
          </text>
          <text x="18" y="26" fontSize="10" fill={fill} fontFamily="monospace">
            Z
          </text>
        </pattern>
      );
    case 'sol': // Card suits
      return (
        <pattern id={patternId} width="32" height="32" patternUnits="userSpaceOnUse">
          <text x="4" y="14" fontSize="12" fill={fill}>
            &#9824;
          </text>
          <text x="18" y="28" fontSize="12" fill={fill}>
            &#9829;
          </text>
        </pattern>
      );
    case 'cg': // Card fans
      return (
        <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse">
          <rect
            x="4"
            y="4"
            width="8"
            height="12"
            rx="1"
            fill="none"
            stroke={stroke}
            strokeWidth="0.7"
            transform="rotate(-10 8 10)"
          />
          <rect
            x="10"
            y="4"
            width="8"
            height="12"
            rx="1"
            fill="none"
            stroke={stroke}
            strokeWidth="0.7"
            transform="rotate(10 14 10)"
          />
        </pattern>
      );
    case 'ig': // Upward arrows
      return (
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <polyline points="4,14 10,6 16,14" fill="none" stroke={stroke} strokeWidth="1" />
        </pattern>
      );
    case 'beat-em-up': // Lightning zigzag
      return (
        <pattern id={patternId} width="24" height="32" patternUnits="userSpaceOnUse">
          <polyline
            points="6,0 14,10 8,12 16,24 10,26 18,32"
            fill="none"
            stroke={stroke}
            strokeWidth="1"
          />
        </pattern>
      );
    case 'original': // Circuits
      return (
        <pattern id={patternId} width="32" height="32" patternUnits="userSpaceOnUse">
          <line x1="0" y1="16" x2="12" y2="16" stroke={stroke} strokeWidth="0.8" />
          <circle cx="14" cy="16" r="2" fill={fill} />
          <line x1="16" y1="16" x2="32" y2="16" stroke={stroke} strokeWidth="0.8" />
          <line x1="16" y1="0" x2="16" y2="12" stroke={stroke} strokeWidth="0.8" />
          <circle cx="16" cy="14" r="1.5" fill={fill} />
        </pattern>
      );
    default: // unknown: scattered circles
      return (
        <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="2" fill={fill} />
          <circle cx="18" cy="18" r="3" fill={fill} />
        </pattern>
      );
  }
}

/* ---- Category icon glyphs ---- */
function renderCategoryIcon(category: TemplateCategory, x: number, y: number) {
  const fill = 'rgba(255,255,255,0.15)';
  const size = 28;

  switch (category) {
    case 'os':
      return (
        <polygon
          points={`${x},${y - size / 2} ${x + size / 2},${y} ${x + size / 2},${y + size / 2} ${x},${y + size} ${x - size / 2},${y + size / 2} ${x - size / 2},${y}`}
          fill={fill}
        />
      );
    case 'cv':
      return <rect x={x - 12} y={y - 12} width="24" height="24" rx="2" fill={fill} />;
    case 'beat-em-up':
      return (
        <polygon
          points={`${x},${y - 14} ${x + 4},${y - 4} ${x - 2},${y - 2} ${x + 6},${y + 14} ${x - 4},${y + 2} ${x + 2},${y + 4}`}
          fill={fill}
        />
      );
    case 'fbg':
      return <circle cx={x} cy={y} r="12" fill={fill} />;
    case 'mg':
      return <rect x={x - 10} y={y - 10} width="20" height="20" fill={fill} />;
    case 'sol':
    case 'cg':
    case 'rlcard':
      return (
        <polygon
          points={`${x},${y - 14} ${x + 10},${y} ${x},${y + 14} ${x - 10},${y}`}
          fill={fill}
        />
      );
    case 'ig':
      return (
        <polygon points={`${x - 12},${y + 10} ${x},${y - 12} ${x + 12},${y + 10}`} fill={fill} />
      );
    default:
      return <circle cx={x} cy={y} r="10" fill={fill} />;
  }
}

/* ---- Main component ---- */
export default function ProceduralThumbnail({
  name,
  genre = 'other',
  templateSlug,
  className,
}: ProceduralThumbnailProps) {
  const hash = hashString(name);
  const { primary, secondary } = getGenreColors(genre, hash);
  const category = getTemplateCategory(templateSlug);
  const patternId = `pat-${hash}`;
  const gradientId = `grad-${hash}`;
  const initial = (name[0] ?? '?').toUpperCase();

  return (
    <svg
      viewBox="0 0 400 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        {renderPattern(category, patternId)}
      </defs>

      {/* Layer 1: gradient background */}
      <rect width="400" height="200" fill={`url(#${gradientId})`} />

      {/* Layer 2: pattern overlay */}
      <rect width="400" height="200" fill={`url(#${patternId})`} />

      {/* Layer 3: large initial letter */}
      <text
        x="200"
        y="125"
        textAnchor="middle"
        fontSize="140"
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
        fill="rgba(255,255,255,0.08)"
        style={{ userSelect: 'none' }}
      >
        {initial}
      </text>

      {/* Layer 4: category icon */}
      {renderCategoryIcon(category, 360, 165)}
    </svg>
  );
}

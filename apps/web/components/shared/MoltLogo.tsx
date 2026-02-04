import { type SVGProps } from 'react';

interface MoltLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function MoltLogo({ size = 32, className, ...props }: MoltLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="molt-star-grad" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00ffe5" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <filter id="molt-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* 4-pointed star / spark with thin elongated points */}
      <g filter="url(#molt-glow)">
        {/* Vertical point - top */}
        <path
          d="M32 4 L34.5 27 L32 30 L29.5 27 Z"
          fill="url(#molt-star-grad)"
        />
        {/* Vertical point - bottom */}
        <path
          d="M32 60 L29.5 37 L32 34 L34.5 37 Z"
          fill="url(#molt-star-grad)"
        />
        {/* Horizontal point - right */}
        <path
          d="M60 32 L37 34.5 L34 32 L37 29.5 Z"
          fill="url(#molt-star-grad)"
        />
        {/* Horizontal point - left */}
        <path
          d="M4 32 L27 29.5 L30 32 L27 34.5 Z"
          fill="url(#molt-star-grad)"
        />
        {/* Center diamond */}
        <path
          d="M32 26 L38 32 L32 38 L26 32 Z"
          fill="url(#molt-star-grad)"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

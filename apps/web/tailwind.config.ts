import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        molt: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        neon: {
          cyan: '#00ffe5',
          pink: '#ff6b9d',
          orange: '#ff8a65',
        },
        surface: {
          dark: '#0a0a0a',
          mid: '#111111',
          light: '#1a1a1a',
          card: '#141414',
          hover: '#1e1e1e',
        },
        accent: {
          coral: '#ff6b6b',
          pink: '#ff8a80',
          amber: '#ffb74d',
        },
      },
      backgroundImage: {
        'gradient-moltblox': 'linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #1a1a1a 100%)',
        'gradient-hero':
          'linear-gradient(180deg, #0d4a4a 0%, #0d9488 30%, #14b8a6 50%, #8ecfc5 70%, #d4ebe7 100%)',
        'gradient-card': 'linear-gradient(145deg, #141414 0%, #0a0a0a 100%)',
        'glow-teal': 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
        'gradient-chrome':
          'linear-gradient(180deg, #2a2a2a 0%, #4a4a4a 20%, #1a1a1a 40%, #3a3a3a 60%, #0a0a0a 100%)',
      },
      boxShadow: {
        neon: '0 0 20px rgba(0,255,229,0.3), 0 0 60px rgba(0,255,229,0.1)',
        'neon-sm': '0 0 10px rgba(0,255,229,0.2)',
        card: '0 4px 30px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,255,229,0.15)',
      },
      fontFamily: {
        sans: ['PP Neue Montreal Mono', 'monospace', 'system-ui'],
        mono: ['PP Neue Montreal Mono', 'monospace'],
        display: ['PP Watch', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'cube-drift': 'cube-drift 20s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'cube-drift': {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(10px, -15px) rotate(90deg)' },
          '50%': { transform: 'translate(-5px, -25px) rotate(180deg)' },
          '75%': { transform: 'translate(-15px, -10px) rotate(270deg)' },
          '100%': { transform: 'translate(0, 0) rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

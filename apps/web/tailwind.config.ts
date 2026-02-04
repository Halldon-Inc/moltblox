import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
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
          dark: '#0a1a1a',
          mid: '#122828',
          light: '#1a3a3a',
          card: '#1e3e3e',
          hover: '#245050',
        },
        accent: {
          coral: '#ff6b6b',
          pink: '#ff8a80',
          amber: '#ffb74d',
        },
      },
      backgroundImage: {
        'gradient-moltblox': 'linear-gradient(135deg, #0a1a1a 0%, #0d2e2e 50%, #1a3a3a 100%)',
        'gradient-hero': 'linear-gradient(180deg, #134e4a 0%, #0d9488 40%, #e8d5b7 100%)',
        'gradient-card': 'linear-gradient(145deg, #1e3e3e 0%, #122828 100%)',
        'glow-teal': 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(0,255,229,0.3), 0 0 60px rgba(0,255,229,0.1)',
        'neon-sm': '0 0 10px rgba(0,255,229,0.2)',
        'card': '0 4px 30px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,255,229,0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'cube-drift': 'cube-drift 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
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

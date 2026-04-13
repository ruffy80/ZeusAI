/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html'
  ],
  theme: {
    extend: {}
  },
  plugins: []
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#f59e0b',
        },
        platinum: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          DEFAULT: '#e2e8f0',
        },
        neon: {
          blue:   '#00f0ff',
          purple: '#9f00ff',
          pink:   '#ff00d4',
          green:  '#00ff88',
          gold:   '#ffd700',
        },
      },
      fontFamily: {
        luxury: ['"Playfair Display"', 'Georgia', 'serif'],
        mono:   ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'spin-slow':   'spin 8s linear infinite',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow':        'glow 2s ease-in-out infinite alternate',
        'float':       'float 6s ease-in-out infinite',
        'holographic': 'holographic 4s linear infinite',
      },
      keyframes: {
        glow: {
          '0%':   { 'box-shadow': '0 0 5px #f59e0b, 0 0 10px #f59e0b' },
          '100%': { 'box-shadow': '0 0 20px #f59e0b, 0 0 40px #f59e0b, 0 0 80px #f59e0b' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-20px)' },
        },
        holographic: {
          '0%':   { 'background-position': '0% 50%' },
          '50%':  { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

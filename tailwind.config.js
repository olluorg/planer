/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          card: 'var(--bg-card)',
          soft: 'var(--bg-soft)',
          hover: 'var(--bg-hover)',
        },
        border: { DEFAULT: 'var(--border)', soft: 'var(--border-soft)' },
        text: { DEFAULT: 'var(--text)', muted: 'var(--text-muted)', dim: 'var(--text-dim)' },
        accent: { DEFAULT: 'var(--accent, #6366f1)', soft: 'var(--accent-soft, #818cf8)' },
        // Полная шкала Primary (indigo/violet)
        primary: {
          50:  '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81',
        },
        // Neutral (slate)
        neutral: {
          50:  '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a',
        },
        // Семантические (Data Viz board)
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        warn: '#f59e0b',
        // Палитра серий для графиков
        chart: {
          1: '#6366f1', 2: '#8b5cf6', 3: '#22c55e',
          4: '#f59e0b', 5: '#ec4899', 6: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { none: '0', sm: '4px', DEFAULT: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', '3xl': '24px', full: '9999px' },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)',
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        lift: '0 8px 28px rgba(99, 102, 241, 0.16)',
        xl: '0 20px 50px rgba(15, 23, 42, 0.12)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        emphasized: 'cubic-bezier(0.22, 1, 0.36, 1)',
        decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: {
        fast: '100ms',
        base: '150ms',
        slow: '300ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'pulse-ok': { '0%': { backgroundColor: 'transparent' }, '40%': { backgroundColor: 'rgba(34,197,94,0.18)' }, '100%': { backgroundColor: 'transparent' } },
        'check-pop': { '0%': { transform: 'scale(0.85)' }, '50%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'toast-in': { from: { opacity: 0, transform: 'translateY(12px) scale(0.98)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms ease-out',
        'pulse-ok': 'pulse-ok 600ms ease-out',
        'check-pop': 'check-pop 220ms ease-out',
        'scale-in': 'scale-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.4s infinite',
        'toast-in': 'toast-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

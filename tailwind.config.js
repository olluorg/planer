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
        accent: { DEFAULT: 'var(--accent, #22c55e)', soft: 'var(--accent-soft, #16a34a)' },
        warn: '#eab308',
        danger: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '9999px' },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'pulse-ok': { '0%': { backgroundColor: 'transparent' }, '40%': { backgroundColor: 'rgba(34,197,94,0.18)' }, '100%': { backgroundColor: 'transparent' } },
        'check-pop': { '0%': { transform: 'scale(0.85)' }, '50%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms ease-out',
        'pulse-ok': 'pulse-ok 600ms ease-out',
        'check-pop': 'check-pop 220ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

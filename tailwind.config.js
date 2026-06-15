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
      borderRadius: { none: '0', sm: '4px', DEFAULT: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', '3xl': '24px', full: '9999px' },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)',
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        lift: '0 8px 28px rgba(99, 102, 241, 0.16)',
      },
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

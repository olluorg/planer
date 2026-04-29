/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0a0a', card: '#141414', soft: '#1a1a1a', hover: '#1f1f1f' },
        border: { DEFAULT: '#262626', soft: '#1f1f1f' },
        text: { DEFAULT: '#fafafa', muted: '#a3a3a3', dim: '#737373' },
        accent: { DEFAULT: '#22c55e', soft: '#16a34a' },
        warn: '#eab308',
        danger: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px' },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

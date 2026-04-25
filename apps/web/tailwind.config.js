import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Anchor content globs at this file's directory so Tailwind finds the source
// regardless of which cwd Vite happens to launch from.
const HERE = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [join(HERE, 'index.html'), join(HERE, 'src/**/*.{ts,tsx}')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Lighthouse — warm-modern dark palette.
        // The base is a deep warm slate (slight cool tint) with a coral
        // primary and clear data-viz accents that read well at small sizes.
        lh: {
          ink:        '#08090c',  // page
          paper:      '#0d0f14',  // sidebar / elevated bg
          slab:       '#12151b',  // card surface
          slab2:      '#181c24',  // elevated card / hover
          line:       '#1d212a',  // hairline border
          line2:      '#272d39',  // active / strong border
          mute:       '#8a91a0',  // secondary text
          fore:       '#eaeef5',  // primary text
          // Brand accent (coral)
          coral:      '#e58e5a',
          coralDeep:  '#d87642',
          // Data viz
          gold:       '#f5b94f',
          mint:       '#74c997',
          rose:       '#e88a91',
          azure:      '#7cc1e9',
          violet:     '#b39de0',
          sky:        '#7fb1d9',
          // Status semantics
          ok:         '#74c997',
          warn:       '#f5b94f',
          danger:     '#e88a91',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Tightened type scale.
        '2xs': ['11px', { lineHeight: '14px' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '18px' }],
        base:  ['14px', { lineHeight: '20px' }],
        lg:    ['16px', { lineHeight: '22px' }],
        xl:    ['18px', { lineHeight: '24px' }],
        '2xl': ['22px', { lineHeight: '28px' }],
        '3xl': ['28px', { lineHeight: '34px' }],
        '4xl': ['36px', { lineHeight: '42px' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        snug: '-0.015em',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03), 0 16px 40px -24px rgba(0,0,0,0.7)',
        cardHover: '0 1px 0 0 rgba(255,255,255,0.05), 0 24px 48px -24px rgba(0,0,0,0.8)',
        glow: '0 0 0 1px rgba(229,142,90,0.2), 0 8px 32px -16px rgba(229,142,90,0.4)',
        focus: '0 0 0 3px rgba(229,142,90,0.25)',
      },
      backgroundImage: {
        'lh-grad-gold': 'linear-gradient(135deg, #f5b94f 0%, #e58e5a 100%)',
        'lh-grad-coral': 'linear-gradient(135deg, #e58e5a 0%, #b85d8b 100%)',
        'lh-radial': 'radial-gradient(circle at 50% 0%, rgba(229,142,90,0.08) 0%, transparent 60%)',
        'lh-grid': 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-right': 'slideInRight 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'shimmer': 'shimmer 1.4s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};

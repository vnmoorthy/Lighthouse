/** @type {import('tailwindcss').Config} */
export default {
  // Content paths are absolute-from-config-file so this works whether Vite
  // runs from the repo root or from apps/web.
  content: [
    new URL('./index.html', import.meta.url).pathname,
    new URL('./src/**/*.{ts,tsx}', import.meta.url).pathname,
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Lighthouse "warm-cool" palette. Keeping it in tailwind.config.js
        // means we can use it as utility classes (text-lh-mint etc.) and
        // get autocomplete in editors.
        lh: {
          ink:    '#0b0f17',
          paper:  '#0f1623',
          slab:   '#131a26',
          line:   '#1f2937',
          line2:  '#243044',
          mute:   '#94a3b8',
          fore:   '#e7eef8',
          mint:   '#86efac',
          gold:   '#fbbf24',
          rose:   '#fda4af',
          azure:  '#7dd3fc',
          violet: '#c4b5fd',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04), 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};

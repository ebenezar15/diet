/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        turmeric: 'rgb(var(--turmeric) / <alpha-value>)',
        chilli: 'rgb(var(--chilli) / <alpha-value>)',
        leaf: 'rgb(var(--leaf) / <alpha-value>)',
        coconut: 'rgb(var(--coconut) / <alpha-value>)',
        sky: 'rgb(var(--sky) / <alpha-value>)',
        plum: 'rgb(var(--plum) / <alpha-value>)'
      },
      fontFamily: {
        display: ['"Baloo 2"', '"Noto Sans Tamil"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        body: ['Inter', '"Noto Sans Tamil"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif']
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { soft: '0 6px 24px -8px rgb(0 0 0 / 0.18)' }
    }
  },
  plugins: []
};

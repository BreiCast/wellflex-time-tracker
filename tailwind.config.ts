import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        wetrack: ['Wellflex1', 'sans-serif'],
      },
      // Design tokens. Additive (extend) so existing indigo-*/slate-*/rounded-*/
      // shadow-* utilities keep working while screens migrate incrementally.
      colors: {
        // Brand primary (was indigo-600 as the de-facto primary). Use `primary`
        // instead of scattering `indigo-*` literals.
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#4f46e5',
        },
        // App canvas background (already applied to <body> in globals.css).
        canvas: '#f8fafc',
      },
      borderRadius: {
        control: '1rem', // buttons / inputs
        card: '1.5rem', // standard cards
        'card-lg': '2rem', // large feature cards
      },
      boxShadow: {
        card: '0 20px 50px -12px rgba(0, 0, 0, 0.05)',
        'card-sm': '0 8px 30px rgba(0, 0, 0, 0.04)',
        lift: '0 20px 50px -12px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
export default config


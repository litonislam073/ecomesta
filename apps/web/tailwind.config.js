/**
 * Landing page template colours: `bg-sp-brand`, `text-cp-gold/60`… Each one
 * reads a CSS variable ("r g b") the landing page sets, so a merchant's colour
 * choice recolours the whole template.
 */
const landingPalette = require('./src/components/landing/landing-palette.json');

const landingColors = Object.fromEntries(
  Object.values(landingPalette).map(({ prefix, tokens }) => [
    prefix,
    Object.fromEntries(
      Object.keys(tokens).map((token) => [token, `rgb(var(--${prefix}-${token}) / <alpha-value>)`]),
    ),
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      colors: landingColors,
    },
  },
  plugins: [],
};

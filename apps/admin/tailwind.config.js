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
    },
  },
  plugins: [],
};

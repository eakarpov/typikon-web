/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'var(--font-old-standard)',
        ],
        'sans-serif': [
          'var(--font-monomakh)',
        ],
      }
    },
  },
  plugins: [],
}

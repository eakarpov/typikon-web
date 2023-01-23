/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'ui-serif',
          'Georgia',
          'OldStandard',
        ],
      }
    },
  },
  plugins: [],
}

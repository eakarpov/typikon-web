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
        // Выбор читателя приезжает в --cs-font (см. src/lib/settings/reading);
        // без выбора остаётся Мономах — он полнее прочих по составу знаков.
        'sans-serif': [
          'var(--cs-font, var(--font-monomakh))',
        ],
      }
    },
  },
  plugins: [],
}

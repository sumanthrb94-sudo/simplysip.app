/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ivory': '#F5F2ED',
        'ink': '#1D1C1A',
        'ash': '#6F6A63',
        'brand': '#C6A05A',
      },
      fontFamily: {
        'display': ['"Source Sans Pro"', 'sans-serif'],
        'script': ['"Style Script"', 'cursive'],
        'sans': ['"DM Sans"', 'sans-serif'],
        'serif': ['"Source Serif Pro"', 'serif'],
      },
    },
  },
  plugins: [],
}

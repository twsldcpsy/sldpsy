/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2C3E50',
        secondary: '#7DA2A9',
        accent: '#C6B6A8',
      },
      fontFamily: {
        sans: ['"LxgwWenKai"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

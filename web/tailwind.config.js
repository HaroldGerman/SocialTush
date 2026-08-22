/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#f7f6fb',
          dark: '#0d0b14',
        },
        surface: {
          light: '#ffffff',
          dark: '#15111f',
        },
        border: {
          light: '#e7e3ef',
          dark: '#2b2139',
        },
        primary: {
          DEFAULT: '#6d28d9',
          hover: '#5b21b6',
          soft: '#f3e8ff',
        },
        accent: {
          DEFAULT: '#f43f5e',
          hover: '#e11d48',
          soft: '#ffe4e6',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

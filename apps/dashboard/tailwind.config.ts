import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0d13',
        foreground: '#e9edf3',
        gray: {
          900: '#121620', // panels
          800: '#141921', // buttons
          700: '#22283a', // borders
        },
        primary: {
          500: '#6366f1',
          400: '#818cf8',
        }
      },
    },
  },
  plugins: [],
};
export default config;
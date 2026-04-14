import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Match project dark theme palette
        surface: {
          DEFAULT: '#0f1117',
          card: '#171923',
          elevated: '#1e2230',
        },
      },
    },
  },
  plugins: [],
};

export default config;

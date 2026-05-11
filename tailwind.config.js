/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#05070a',
          lighter: '#0a0f18',
        },
        focus: {
          DEFAULT: '#00f7ff', // Vibrant Cyan
          glow: 'rgba(0, 247, 255, 0.4)',
        },
        break: {
          DEFAULT: '#7d61ff', // Royal Purple
          glow: 'rgba(125, 97, 255, 0.4)',
        },
        accent: {
          pink: '#ff2e97',
          orange: '#ff8a00',
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 20px 50px rgba(0, 0, 0, 0.8)',
        'glow-focus': '0 0 15px rgba(0, 247, 255, 0.2)',
        'glow-break': '0 0 15px rgba(125, 97, 255, 0.2)',
        'glow-pink': '0 0 15px rgba(255, 46, 151, 0.2)',
      },
    },
  },
  plugins: [],
};

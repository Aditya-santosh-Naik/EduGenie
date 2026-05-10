import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          900: '#0f1115',
          800: '#16181d',
          panel: '#0b0d10'
        },
        text: {
          main: '#e6eef6',
          muted: '#9aa3b2'
        },
        accent: {
          400: '#9b6cff',
          500: '#6c5ce7',
          600: '#5548c8'
        },
        success: '#22c55e',
        warning: '#ffb020',
        danger: '#ff6b6b',
        glass: 'rgba(255,255,255,0.03)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      backdropBlur: {
        xs: '2px'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(108, 92, 231, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(108, 92, 231, 0.6)' }
        }
      }
    }
  },
  plugins: []
};

export default config;

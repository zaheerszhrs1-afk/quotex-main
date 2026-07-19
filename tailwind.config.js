/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Quotex dark palette (inspected design language)
        qx: {
          bg: '#0E1621',          // app background
          panel: '#131A26',       // panels / cards
          panel2: '#1B2435',      // raised panel
          border: '#222C3C',      // hairline borders
          input: '#0B121C',       // input background
          green: '#00C076',       // primary / UP / bullish
          greenHover: '#0FAF59',
          red: '#FF6258',         // DOWN / bearish / loss
          redHover: '#F44C41',
          text: '#FFFFFF',
          textDim: '#7E8A99',     // secondary text
          textMute: '#566273',
          gold: '#F5B70A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 4px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 3px rgba(0,192,118,0.25)',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(120%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(0,192,118,0)' },
          '30%': { backgroundColor: 'rgba(0,192,118,0.18)' },
          '100%': { backgroundColor: 'rgba(0,192,118,0)' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(255,98,88,0)' },
          '30%': { backgroundColor: 'rgba(255,98,88,0.18)' },
          '100%': { backgroundColor: 'rgba(255,98,88,0)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        qxspin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        qxpulse: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(0.82)', opacity: '0.55' },
        },
        qxdot: {
          '0%,100%': { opacity: '0.25', transform: 'translateY(0)' },
          '50%': { opacity: '1', transform: 'translateY(-2px)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-120%) scale(0.96)', opacity: '0' },
          '60%': { transform: 'translateY(6%) scale(1.01)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        slideUpOut: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-120%) scale(0.96)', opacity: '0' },
        },
      },
      animation: {
        slideIn: 'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
        flashGreen: 'flashGreen 0.8s ease-out',
        flashRed: 'flashRed 0.8s ease-out',
        pulseDot: 'pulseDot 1.2s ease-in-out infinite',
        qxspin: 'qxspin 1s linear infinite',
        qxpulse: 'qxpulse 1.4s ease-in-out infinite',
        qxdot: 'qxdot 1s ease-in-out infinite',
        slideDown: 'slideDown 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        slideUpOut: 'slideUpOut 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
      },
    },
  },
  plugins: [],
}

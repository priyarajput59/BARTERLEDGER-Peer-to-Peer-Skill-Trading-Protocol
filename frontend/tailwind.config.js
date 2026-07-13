/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:       '#0C0F0A',
        ledger:    '#141810',
        folio:     '#1C221A',
        teal:      '#2D7A5E',
        'teal-lt': '#3FA07C',
        amber:     '#C4922A',
        'amber-lt':'#E0AA3E',
        parchment: '#E8E0CC',
        sage:      '#8FA882',
        muted:     '#5A6454',
        faint:     '#323B2E',
        seal:      '#8B2020',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body:    ['"Inter"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
      backgroundImage: {
        'ledger-grain': `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 28px,
            rgba(45,122,94,0.04) 28px,
            rgba(45,122,94,0.04) 29px
          )
        `,
        'teal-glow': 'radial-gradient(ellipse at 30% 40%, rgba(45,122,94,0.12) 0%, transparent 60%)',
        'amber-glow':'radial-gradient(ellipse at 70% 60%, rgba(196,146,42,0.08) 0%, transparent 50%)',
      },
      boxShadow: {
        'stamp':  'inset 0 0 0 2px rgba(196,146,42,0.3), 0 0 20px rgba(196,146,42,0.08)',
        'card':   '0 1px 0 rgba(232,224,204,0.04), 0 4px 24px rgba(0,0,0,0.4)',
        'teal':   '0 0 24px rgba(45,122,94,0.25)',
        'seal':   '0 0 0 3px rgba(139,32,32,0.4)',
      },
      animation: {
        'shimmer':     'shimmer 3s ease-in-out infinite',
        'stamp-in':    'stamp-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'quill':       'quill 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%,100%': { opacity: '0.6' },
          '50%':     { opacity: '1'   },
        },
        'stamp-in': {
          from: { transform: 'scale(1.4) rotate(-8deg)', opacity: '0' },
          to:   { transform: 'scale(1) rotate(0deg)',    opacity: '1' },
        },
        quill: {
          '0%,100%': { transform: 'rotate(-5deg)' },
          '50%':     { transform: 'rotate(5deg)'  },
        },
      },
    },
  },
  plugins: [],
}

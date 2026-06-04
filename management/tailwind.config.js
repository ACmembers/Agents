/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        phoebe: {
          50: '#fef9ee',
          100: '#fef0d2',
          200: '#fcdea4',
          300: '#f9c66b',
          400: '#f5a92f',
          500: '#f19014',  // 菲比金橙
          600: '#d9730a',
          700: '#b4550c',
          800: '#924311',
          900: '#773710',
          950: '#401c06'
        },
        ivory: {
          50: '#fdfbf7',
          100: '#faf5ea',  // 象牙白
          200: '#f4e9d1',
          300: '#ebd9ae',
          400: '#e0c380',
          500: '#d5ac59',
          600: '#c79540',
          700: '#a67936',
          800: '#876230',
          900: '#6e502b',
          950: '#3b2915'
        },
        slateblue: {
          50: '#f4f6f9',
          100: '#e4e8f0',
          200: '#cdd4e2',
          300: '#a9b4cc',
          400: '#7f8db1',
          500: '#606f98',
          600: '#4c5a7e',
          700: '#3e4967',  // 深蓝灰
          800: '#363f56',
          900: '#30374a',
          950: '#1a1f2b'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}

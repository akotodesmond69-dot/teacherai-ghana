// Purpose: Tailwind config, wired to the color tokens decided in Phase 2's
// design system (chalkboard green, gold-thread accent, notebook background).
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chalkboard: '#1F4D3E',
        'gold-thread': '#D8A33D',
        notebook: '#F7F3EA',
        ink: '#211F1B',
        'info-blue': '#2D5A8C',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

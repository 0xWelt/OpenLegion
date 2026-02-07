/** @type {import('tailwindcss').Config} */
import animate from 'tailwindcss-animate'

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        'oc-bg': 'rgb(var(--oc-bg))',
        'oc-surface': 'rgb(var(--oc-surface))',
        'oc-surface-hover': 'rgb(var(--oc-surface-hover))',
        'oc-border': 'rgb(var(--oc-border))',
        'oc-text': 'rgb(var(--oc-text))',
        'oc-text-muted': 'rgb(var(--oc-text-muted))',
        'oc-primary': '#22c55e',
        'oc-primary-hover': '#16a34a',
        'oc-accent': '#8b5cf6',
        // Additional colors for code blocks (matching kimi-cli naming)
        'muted-foreground': 'rgb(var(--oc-text-muted))',
        'card': 'rgb(var(--oc-surface))',
        'border': 'rgb(var(--oc-border))',
        'foreground': 'rgb(var(--oc-text))',
        'secondary': 'rgb(var(--oc-surface-hover))',
        'primary': 'rgb(var(--oc-text))',
        'primary-foreground': 'rgb(var(--oc-bg))',
        'ring': 'rgb(var(--oc-text-muted))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
}

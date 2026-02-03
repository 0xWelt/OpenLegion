/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // OpenClaw dark theme colors
        'oc-bg': '#0f0f10',
        'oc-surface': '#18181a',
        'oc-surface-hover': '#1f1f22',
        'oc-border': '#27272a',
        'oc-text': '#fafafa',
        'oc-text-muted': '#a1a1aa',
        'oc-primary': '#22c55e',
        'oc-primary-hover': '#16a34a',
        'oc-accent': '#8b5cf6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

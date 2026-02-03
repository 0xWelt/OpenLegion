import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',  // Use relative paths for assets
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:18790',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_API_TARGET?.replace('http', 'ws') ?? 'ws://127.0.0.1:18790',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

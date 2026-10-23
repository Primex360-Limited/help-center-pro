import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 400,
    },
    hmr: {
      overlay: true,
    },
    // Dev-only same-origin fallback when VITE_API_URL is unset.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4008',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:4008',
        changeOrigin: true,
      },
    },
  },
})

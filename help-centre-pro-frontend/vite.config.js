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
    // Same-origin proxy so auth cookies work (localhost ≠ 127.0.0.1 cross-site).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4008',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://127.0.0.1:4008',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

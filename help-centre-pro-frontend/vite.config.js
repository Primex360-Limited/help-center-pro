import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Where the dev server proxies `/api` + `/health`.
// - Local dev (default): the backend running on this machine.
// - Docker Compose:      VITE_PROXY_TARGET=http://backend:4008, otherwise the
//   container would proxy to 127.0.0.1:4008 *inside itself* and every login
//   would fail with an empty 500 ("Cannot reach the API").
const apiProxyTarget = (process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4008').replace(/\/$/, '')

/**
 * Turn a dead proxy target into an explicit, actionable JSON error instead of
 * http-proxy's bare empty 500 body (which the app can only report as
 * "Cannot reach the API").
 */
function proxyOptions() {
  return {
    target: apiProxyTarget,
    changeOrigin: true,
    secure: false,
    configure: (proxy) => {
      proxy.on('error', (err, _req, res) => {
        if (!res || res.headersSent || typeof res.writeHead !== 'function') return
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(
          JSON.stringify({
            success: false,
            message:
              `Cannot reach the API at ${apiProxyTarget}. Start the backend on port 4008 ` +
              `(or set VITE_PROXY_TARGET), and make sure nothing else is bound to that port.`,
            code: err?.code || 'PROXY_ERROR',
          })
        )
      })
    },
  }
}

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
      '/api': proxyOptions(),
      '/health': proxyOptions(),
    },
  },
})

/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In development the Vite server proxies /api to the backend and strips the
// prefix, exactly as nginx does in Docker. The SPA therefore always calls the
// same origin, and the httpOnly session cookie stays first-party (ADR-0002).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          // Libraries change less often than the app, so their chunks stay cached across releases.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
                priority: 3,
              },
              { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 2 },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
      // Whole-page tests type into many fields; leave room for slower CI machines.
      testTimeout: 15_000,
      // Dates and times in assertions are written for UTC.
      env: { TZ: 'UTC' },
    },
  }
})

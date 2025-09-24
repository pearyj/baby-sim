import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          // Handle proxy errors
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (_, req) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    // Enable dead code elimination
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log and console.debug in production, but keep console.warn and console.error
        drop_console: false, // Don't drop all console methods
        pure_funcs: ['console.log', 'console.debug'], // Only drop specific console methods
        drop_debugger: true,
      },
    },
  },
  esbuild: {
    // Only remove console.log and console.debug during development builds, keep console.warn and console.error
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
  },
})

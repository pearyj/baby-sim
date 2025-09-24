import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

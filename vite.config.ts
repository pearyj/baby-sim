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
        // Remove console logs in production
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  esbuild: {
    // Remove console logs during development builds as well if needed
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})

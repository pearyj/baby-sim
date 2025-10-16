import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Expose non-VITE prefixed environment variables to the client
    // This allows compatibility with existing Vercel deployments
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY),
    'import.meta.env.VITE_PAYWALL_VERSION': JSON.stringify(process.env.PAYWALL_VERSION || process.env.VITE_PAYWALL_VERSION),
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

import { createClient } from '@supabase/supabase-js';

// Use Vite environment variables (exposed with VITE_ prefix). These should be
// provided at build time via .env files or your hosting provider's dashboard.
const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast so that invalid deployments are caught early.
  throw new Error('Supabase credentials are missing. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
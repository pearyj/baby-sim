import { createClient } from '@supabase/supabase-js';

// Allow both browser-prefixed (VITE_) and standard serverless env variable names so that
// the functions work regardless of where the credentials are configured.
// We purposely fall back in order of most-secure to least-secure key types.

const SUPABASE_URL =
  process.env.SUPABASE_URL || // preferred for serverless envs
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || // service-role key (preferred)
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY; // fallback for local dev where someone copied the key with a VITE_ prefix

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // Fail fast so that mis-configuration is obvious in the logs.
  throw new Error(
    'Supabase credentials missing: please set SUPABASE_URL and SUPABASE_SERVICE_KEY (service role) in the environment.'
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    // Service role keys should never persist a session
    persistSession: false,
    autoRefreshToken: false,
  },
}); 
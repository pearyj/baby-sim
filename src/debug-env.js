console.log('Environment check:', { VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...' });

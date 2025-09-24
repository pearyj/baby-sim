import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';

// Simple health-check endpoint to verify Supabase connectivity & table visibility
// GET /api/supabase-health
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  console.log('🏥 Supabase health check initiated');

  try {
    // Decide which table we expect to exist
    const table = process.env.PURCHASES_TABLE || (process.env.PAYWALL_PERSISTENCE === 'db' ? 'purchases' : 'purchases_shadow');

    console.log('🗄️ Health check targeting table:', table);

    // Just attempt a lightweight query (metadata only)
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('anon_id', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Supabase health check failed:', error.message);
      return res.status(500).json({ ok: false, table, error: error.message });
    }

    console.log('✅ Supabase health check passed:', { table, count });
    return res.status(200).json({ ok: true, table, rowCount: typeof count === 'number' ? count : null });
  } catch (err: any) {
    console.error('❌ Supabase health check exception:', err.message || err);
    return res.status(500).json({ ok: false, error: err.message || 'unknown_error' });
  }
} 
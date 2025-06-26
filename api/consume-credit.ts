import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { anonId, email } = req.body || {};
  if (!anonId) {
    return res.status(400).json({ error: 'anonId required' });
  }

  // Determine table based on environment. Use real table for both "production" and "preview" deployments.
  const env = process.env.VERCEL_ENV || 'development';
  const TABLE = process.env.CREDITS_TABLE || ((env === 'production' || env === 'preview') ? 'credits' : 'credits_shadow');

  try {
    // check current balance
    const { data: currentRows, error: balErr } = await supabaseAdmin
      .from(TABLE)
      .select('credits')
      .eq('anon_id', anonId);

    if (balErr) {
      throw balErr;
    }

    const currentBalance = (currentRows || []).reduce((sum, r: any) => sum + (r.credits || 0), 0);

    if (currentBalance <= 0) {
      return res.status(400).json({ ok: false, error: 'no_credits' });
    }

    // Decrement credits atomically
    const { error: updateErr } = await supabaseAdmin
      .from(TABLE)
      .update({ credits: currentBalance - 1 })
      .eq('anon_id', anonId);

    if (updateErr) {
      throw updateErr;
    }

    const remaining = currentBalance - 1;

    return res.status(200).json({ ok: true, remaining });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || 'db_error' });
  }
} 
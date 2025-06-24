import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Production debugging: Always log consume-credit API calls
  console.warn('🔍 PAYWALL DEBUG - Consume Credit API called:', {
    method: req.method,
    body: {
      anonId: req.body?.anonId?.slice(-8),
      email: req.body?.email
    },
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { anonId, email } = req.body || {};
  if (!anonId) {
    console.warn('🔍 PAYWALL DEBUG - Consume credit failed: no anonId');
    return res.status(400).json({ error: 'anonId required' });
  }

  const TABLE = process.env.CREDITS_TABLE || (process.env.VERCEL_ENV === 'production' ? 'credits' : 'credits_shadow');

  console.warn('🔍 PAYWALL DEBUG - Consuming credit from table:', {
    table: TABLE,
    anonId: anonId.slice(-8),
    email,
    timestamp: new Date().toISOString()
  });

  try {
    // check current balance
    const { data: currentRows, error: balErr } = await supabaseAdmin
      .from(TABLE)
      .select('credits')
      .eq('anon_id', anonId);

    if (balErr) {
      console.warn('🔍 PAYWALL DEBUG - Error fetching current balance:', {
        error: balErr.message,
        anonId: anonId.slice(-8),
        timestamp: new Date().toISOString()
      });
      throw balErr;
    }

    const currentBalance = (currentRows || []).reduce((sum, r: any) => sum + (r.credits || 0), 0);

    console.warn('🔍 PAYWALL DEBUG - Current balance check:', {
      anonId: anonId.slice(-8),
      currentBalance,
      rowCount: currentRows?.length || 0,
      timestamp: new Date().toISOString()
    });

    if (currentBalance <= 0) {
      console.warn('🔍 PAYWALL DEBUG - Consume credit failed: no credits available');
      return res.status(400).json({ ok: false, error: 'no_credits' });
    }

    // Decrement credits atomically
    const { error: updateErr } = await supabaseAdmin
      .from(TABLE)
      .update({ credits: currentBalance - 1 })
      .eq('anon_id', anonId);

    if (updateErr) {
      console.warn('🔍 PAYWALL DEBUG - Error updating credits:', {
        error: updateErr.message,
        anonId: anonId.slice(-8),
        timestamp: new Date().toISOString()
      });
      throw updateErr;
    }

    const remaining = currentBalance - 1;
    console.warn('🔍 PAYWALL DEBUG - Credit consumed successfully:', {
      anonId: anonId.slice(-8),
      previousBalance: currentBalance,
      remaining,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ ok: true, remaining });
  } catch (e: any) {
    console.warn('🔍 PAYWALL DEBUG - consume-credit error:', {
      error: e.message || 'Unknown error',
      anonId: anonId?.slice(-8),
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ ok: false, error: e.message || 'db_error' });
  }
} 
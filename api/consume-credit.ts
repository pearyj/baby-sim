import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';
import { applyCors, handlePreflight, rateLimit } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);
  if (!rateLimit(req, res, 'consume-credit', 120)) return;

  const { anonId, email, amount } = req.body || {};
  if (!anonId) {
    return res.status(400).json({ error: 'anonId required' });
  }

  // Determine table based on environment. Use real table for both "production" and "preview" deployments.
  const env = process.env.VERCEL_ENV || 'development';
  const PREFERRED_TABLE = process.env.CREDITS_TABLE || ((env === 'production' || env === 'preview') ? 'credits' : 'credits_shadow');

  try {
    // Helper to select rows; if email provided, use email strictly to avoid mixing balances
    const selectRows = async (table: string) => {
      let query = supabaseAdmin.from(table).select('credits, anon_id, email');
      if (email && typeof email === 'string' && email.length > 0) {
        query = query.eq('email', email);
      } else {
        query = query.eq('anon_id', anonId);
      }
      return query;
    };

    // Probe preferred table, fallback to real table if shadow family doesn't exist (42P01)
    let tableToUse = PREFERRED_TABLE;
    let currentRows: any[] = [];
    {
    const { data, error } = await selectRows(tableToUse);
      if (error && (error as any).code === '42P01') {
        // Table not found, fallback to 'credits'
        tableToUse = 'credits';
        const retry = await selectRows(tableToUse);
        if (retry.error) throw retry.error;
        currentRows = (retry.data as any[]) || [];
      } else if (error) {
        throw error;
      } else {
        currentRows = (data as any[]) || [];
      }
    }

    // Default decrement amount is 1 credit (image gen). Allow fractional for premium LLM.
    const decrement = typeof amount === 'number' && amount > 0 ? amount : 1;
    const dec = Math.max(0, Math.round(decrement * 100) / 100);

    // Optimistic concurrency: try update using current observed balance in WHERE clause; retry a few times on conflict.
    let attempts = 0;
    let lastObserved = currentRows?.[0]?.credits ?? 0;
    while (attempts < 3) {
      const remainingRaw = Number(lastObserved) - dec;
      if (remainingRaw < -1e-9) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(400).json({ ok: false, error: 'no_credits' });
      }
      const remaining = Math.max(0, Math.round(remainingRaw * 100) / 100);

      let update = supabaseAdmin
        .from(tableToUse)
        .update({ credits: remaining });

      if (email && typeof email === 'string' && email.length > 0) {
        update = update.eq('email', email).eq('credits', lastObserved);
      } else {
        update = update.eq('anon_id', anonId).eq('credits', lastObserved);
      }

      const { data: updated, error: updErr } = await update.select('credits');
      if (updErr) throw updErr;
      if (updated && updated.length > 0) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ ok: true, remaining });
      }
      // Reload current balance and retry
      const { data: reread, error: rereadErr } = await supabaseAdmin
        .from(tableToUse)
        .select('credits')
        .limit(1)
        .maybeSingle();
      if (rereadErr) throw rereadErr;
      lastObserved = reread?.credits ?? lastObserved;
      attempts += 1;
    }

    // If we reach here, concurrency prevented update
    res.setHeader('Cache-Control', 'no-store');
    return res.status(409).json({ ok: false, error: 'concurrent_update' });
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, error: e.message || 'db_error' });
  }
} 
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    const currentBalance = (currentRows || []).reduce((sum, r: any) => sum + (Number(r.credits) || 0), 0);

    // Default decrement amount is 1 credit (image gen). Allow fractional for premium LLM.
    const decrement = typeof amount === 'number' && amount > 0 ? amount : 1;

    if (currentBalance <= 0 || currentBalance - decrement < -1e-9) {
      return res.status(400).json({ ok: false, error: 'no_credits' });
    }

    // Compute remaining with stable rounding to 2 decimals to avoid FP artifacts
    const remainingRaw = currentBalance - decrement;
    const remaining = Math.max(0, Math.round(remainingRaw * 100) / 100);

    // Decide which row to update
    let updateQuery = supabaseAdmin.from(tableToUse).update({ credits: remaining });
    if (email && typeof email === 'string' && email.length > 0) {
      // When consuming by email, update that email's row and sync anon_id
      updateQuery = supabaseAdmin
        .from(tableToUse)
        .update({ credits: remaining, anon_id: anonId })
        .eq('email', email);
    } else {
      // Otherwise, update by anon_id
      updateQuery = updateQuery.eq('anon_id', anonId);
    }

    const { error: updateErr } = await updateQuery;
    if (updateErr) {
      throw updateErr;
    }

    // Avoid any intermediary caching of credit writes/reads
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, remaining });
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, error: e.message || 'db_error' });
  }
} 
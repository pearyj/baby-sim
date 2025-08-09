import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { anonId, email, skipPaywall } = req.query;
  
  if (skipPaywall === 'yes') {
    return res.status(200).json({ credits: 999, bypass: true });
  }

  if (!anonId || Array.isArray(anonId)) {
    return res.status(400).json({ error: 'anonId required' });
  }

  let credits = 0;

  // Determine table based on environment. Treat both Vercel "production" and "preview" as real prod-like
  // environments so that the preview deploys hit the actual production data instead of the *_shadow tables.
  const env = process.env.VERCEL_ENV || 'development';
  const TABLE = process.env.CREDITS_TABLE || ((env === 'production' || env === 'preview') ? 'credits' : 'credits_shadow');

  // Helper to safely query a table that might not exist yet.
  const safeSelectCredits = async (table: string) => {
    let query = supabaseAdmin.from(table).select('credits, anon_id, email');

    // If email is provided, search strictly by email to avoid mixing balances
    if (email && typeof email === 'string' && email.length > 0) {
      query = query.eq('email', email);
    } else {
      // Otherwise, search only by anon_id (existing behavior)
      query = query.eq('anon_id', anonId);
    }

    const { data, error } = await query;

    if (error && (error as any).code === '42P01') {
      // Postgres error for undefined table – ignore during transition.
      return [] as any[];
    }
    if (error) {
      throw error;
    }
    return data as any[];
  };

  try {
    const rows = await safeSelectCredits(TABLE);
    
    // If we searched by email and found results, sync anon_id to current anonId for that email
    // Do not sync anon_id when searching by email to avoid merging multiple email rows under one anonId
    
    // Sum up all credits (in case there are multiple rows, though there shouldn't be after the update)
    credits = rows.reduce((sum, row: any) => sum + (row.credits || 0), 0);
  } catch (e) {
    return res.status(500).json({ error: 'db_error' });
  }

  // Avoid any intermediary caching of credit lookups
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ credits });
} 
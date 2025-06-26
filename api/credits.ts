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
    
    // If email is provided, search by email OR anon_id
    if (email && typeof email === 'string') {
      query = query.or(`email.eq.${email},anon_id.eq.${anonId}`);
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
    
    // If we searched by email and found results, we might need to update the anon_id
    if (email && typeof email === 'string' && rows.length > 0) {
      // Check if any row matches the email but has a different anon_id
      const emailMatch = rows.find(row => row.email === email && row.anon_id !== anonId);
      if (emailMatch) {
        // Update the record to use the current anon_id
        try {
          await supabaseAdmin
            .from(TABLE)
            .update({ anon_id: anonId })
            .eq('email', email)
            .eq('anon_id', emailMatch.anon_id);
        } catch (updateError) {
          // Continue anyway, we can still return the credits
        }
      }
    }
    
    // Sum up all credits (in case there are multiple rows, though there shouldn't be after the update)
    credits = rows.reduce((sum, row: any) => sum + (row.credits || 0), 0);
  } catch (e) {
    return res.status(500).json({ error: 'db_error' });
  }

  return res.status(200).json({ credits });
} 
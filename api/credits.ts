import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Production debugging: Always log credits API calls
  console.warn('🔍 PAYWALL DEBUG - Credits API called:', {
    method: req.method,
    query: req.query,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { anonId, email, skipPaywall } = req.query;
  
  console.warn('🔍 PAYWALL DEBUG - Credits lookup request:', { 
    anonId: typeof anonId === 'string' ? anonId.slice(-8) : anonId,
    email, 
    skipPaywall,
    timestamp: new Date().toISOString()
  });
  
  if (skipPaywall === 'yes') {
    console.warn('🔍 PAYWALL DEBUG - Paywall skipped, returning 999 credits');
    return res.status(200).json({ credits: 999, bypass: true });
  }

  if (!anonId || Array.isArray(anonId)) {
    console.warn('🔍 PAYWALL DEBUG - Invalid anonId:', anonId);
    return res.status(400).json({ error: 'anonId required' });
  }

  let credits = 0;

  const TABLE = process.env.CREDITS_TABLE || (process.env.VERCEL_ENV === 'production' ? 'credits' : 'credits_shadow');
  
  console.warn('🔍 PAYWALL DEBUG - Querying table:', {
    table: TABLE,
    environment: process.env.VERCEL_ENV,
    timestamp: new Date().toISOString()
  });

  // Helper to safely query a table that might not exist yet.
  const safeSelectCredits = async (table: string) => {
    let query = supabaseAdmin.from(table).select('credits, anon_id, email');
    
    // If email is provided, search by email OR anon_id
    if (email && typeof email === 'string') {
      console.warn('🔍 PAYWALL DEBUG - Searching by email OR anon_id:', { 
        email, 
        anonId: anonId.slice(-8),
        timestamp: new Date().toISOString()
      });
      query = query.or(`email.eq.${email},anon_id.eq.${anonId}`);
    } else {
      // Otherwise, search only by anon_id (existing behavior)
      console.warn('🔍 PAYWALL DEBUG - Searching by anon_id only:', { 
        anonId: anonId.slice(-8),
        timestamp: new Date().toISOString()
      });
      query = query.eq('anon_id', anonId);
    }
    
    const { data, error } = await query;
    
    if (error && (error as any).code === '42P01') {
      // Postgres error for undefined table – ignore during transition.
      console.warn(`🔍 PAYWALL DEBUG - Table ${table} not found, skipping`);
      return [] as any[];
    }
    if (error) {
      console.warn('🔍 PAYWALL DEBUG - Database error:', {
        error: error.message,
        code: (error as any).code,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
    console.warn(`🔍 PAYWALL DEBUG - Table ${table} returned ${data?.length || 0} rows:`, {
      rowCount: data?.length || 0,
      data: data?.map(row => ({
        credits: row.credits,
        anonId: row.anon_id?.slice(-8),
        email: row.email
      })),
      timestamp: new Date().toISOString()
    });
    return data as any[];
  };

  try {
    const rows = await safeSelectCredits(TABLE);
    
    // If we searched by email and found results, we might need to update the anon_id
    if (email && typeof email === 'string' && rows.length > 0) {
      // Check if any row matches the email but has a different anon_id
      const emailMatch = rows.find(row => row.email === email && row.anon_id !== anonId);
      if (emailMatch) {
        console.warn('🔍 PAYWALL DEBUG - Found credits by email, updating anon_id:', {
          oldAnonId: emailMatch.anon_id?.slice(-8),
          newAnonId: anonId.slice(-8),
          email: email,
          timestamp: new Date().toISOString()
        });
        
        // Update the record to use the current anon_id
        try {
          await supabaseAdmin
            .from(TABLE)
            .update({ anon_id: anonId })
            .eq('email', email)
            .eq('anon_id', emailMatch.anon_id);
          console.warn('🔍 PAYWALL DEBUG - Updated anon_id for email match successfully');
        } catch (updateError) {
          console.warn('🔍 PAYWALL DEBUG - Failed to update anon_id:', {
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          // Continue anyway, we can still return the credits
        }
      }
    }
    
    // Sum up all credits (in case there are multiple rows, though there shouldn't be after the update)
    credits = rows.reduce((sum, row: any) => sum + (row.credits || 0), 0);
    console.warn('🔍 PAYWALL DEBUG - DB credits total:', {
      credits,
      rowCount: rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.warn('🔍 PAYWALL DEBUG - Supabase credits query error:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ error: 'db_error' });
  }

  console.warn('🔍 PAYWALL DEBUG - Final credits response:', { 
    anonId: anonId.slice(-8), 
    credits,
    timestamp: new Date().toISOString()
  });
  return res.status(200).json({ credits });
} 
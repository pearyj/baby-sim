import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * POST /api/subscribe
 * Adds a new row to the `subscribers` table. This route uses the service-role
 * key so it bypasses RLS, keeping the DB private while still allowing writes
 * from the front-end via this function.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body ?? {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email_required' });
  }

  try {
    const { error } = await supabaseAdmin.from('subscribers').insert([{ email }]);
    if (error) {
      console.error('Failed to insert subscriber:', error);
      return res.status(500).json({ error: 'db_error' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Unexpected subscribe error:', e);
    return res.status(500).json({ error: 'unexpected_error' });
  }
} 
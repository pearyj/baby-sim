import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * POST /api/session-flag
 * Body: {
 *   anonId: string;
 *   kidId: string;
 *   flags: {
 *     checkoutInitiated?: boolean;
 *     checkoutCompleted?: boolean;
 *     imageGenerated?: boolean;
 *   }
 * }
 *
 * Sets boolean columns in `game_sessions`.  A value of `true` marks the flag; `false` is ignored.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { anonId, kidId, flags } = req.body ?? {};
  if (!anonId || typeof anonId !== 'string' || !kidId || typeof kidId !== 'string' || !flags || typeof flags !== 'object') {
    return res.status(400).json({ error: 'anonId, kidId and flags required' });
  }

  const env = process.env.VERCEL_ENV || 'development';
  const TABLE = process.env.SESSIONS_TABLE || (env === 'production' || env === 'preview' ? 'game_sessions' : 'game_sessions_shadow');

  const updatePayload: Record<string, boolean> = {};
  if (flags.checkoutInitiated) updatePayload.checkout_initiated = true;
  if (flags.checkoutCompleted) updatePayload.checkout_completed = true;
  if (flags.imageGenerated)   updatePayload.image_generated   = true;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(200).json({ success: true, noChange: true });
  }

  try {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update(updatePayload)
      .eq('anon_id', anonId)
      .eq('kid_id', kidId);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('❌ session-flag error:', e.message || e);
    return res.status(500).json({ error: 'db_error' });
  }
} 
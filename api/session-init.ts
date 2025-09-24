import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * POST /api/session-init
 *
 * Ensures a row exists in the `game_sessions` (or *_shadow) table for this anonId.
 * Safe to call multiple times – we upsert on anon_id.
 *
 * Body: {
 *   anonId: string;
 *   kidId: string;
 *   style: string;
 *   customInstruction?: any;  // JSON-serialisable object
 *   meta?: any;                 // optional extra metadata (device, locale, etc.)
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { anonId, kidId, style, customInstruction = null, meta = null } = req.body ?? {};

  if (!anonId || typeof anonId !== 'string' || !kidId || typeof kidId !== 'string') {
    return res.status(400).json({ error: 'anonId and kidId required' });
  }

  if (!style || typeof style !== 'string') {
    return res.status(400).json({ error: 'style required' });
  }

  // Decide table (shadow in dev/preview by default to avoid polluting prod data)
  const env = process.env.VERCEL_ENV || 'development';
  const TABLE = process.env.SESSIONS_TABLE || (env === 'production' || env === 'preview' ? 'game_sessions' : 'game_sessions_shadow');

  try {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert(
        {
          anon_id: anonId,
          kid_id: kidId,
          initial_style: style,
          initial_custom_instruction: customInstruction,
          meta,
          started_at: new Date(),
        },
        { onConflict: 'kid_id' }
      );

    // If the optional columns don't exist in the schema we retry without them so the request never blocks gameplay.
    if (error && (error as any).message?.includes('initial_custom_instruction')) {
      console.warn('session-init retrying without optional columns (schema mismatch)');
      const { error: retryErr } = await supabaseAdmin
        .from(TABLE)
        .upsert(
          {
            anon_id: anonId,
            kid_id: kidId,
            initial_style: style,
            started_at: new Date(),
          },
          { onConflict: 'kid_id' }
        );
      if (retryErr) throw retryErr;
    } else if (error) {
      throw error;
    }

    return res.status(200).json({ success: true });
  } catch (e: any) {
    // Log but swallow DB errors so gameplay is never blocked
    console.error('❌ session-init error:', e.message || e);
    return res.status(500).json({ error: 'db_error' });
  }
} 
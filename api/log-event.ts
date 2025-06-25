import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * POST /api/log-event
 * Logs a single user event to `game_events` (or *_shadow) table.
 *
 * Body: {
 *   anonId: string;
 *   kidId: string;
 *   type: string;           // e.g. 'choice', 'checkout_initiated', 'image_generated'
 *   payload?: any;          // optional extra info (JSON-serialisable)
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { anonId, kidId, type, payload = null } = req.body ?? {};
  if (!anonId || typeof anonId !== 'string' || !kidId || typeof kidId !== 'string' || !type || typeof type !== 'string') {
    return res.status(400).json({ error: 'anonId, kidId and type required' });
  }

  // Always write to the main tables unless explicitly overridden via env vars.
  const EVENTS_TABLE = process.env.EVENTS_TABLE || 'game_events';
  const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'game_sessions';

  try {
    // Look up session id (non-blocking if missing)
    let sessionId: string | null = null;
    const { data: sessions } = await supabaseAdmin
      .from(SESSIONS_TABLE)
      .select('id')
      .eq('anon_id', anonId)
      .eq('kid_id', kidId)
      .limit(1);
    if (sessions && sessions.length > 0) {
      sessionId = sessions[0].id as string;
    }

    let extraCols: Record<string, any> = {};
    if (type === 'choice' && payload && typeof payload === 'object') {
      const { age, optionId, customInstruction } = payload as any;
      if (typeof age === 'number') extraCols.age = age;
      if (typeof optionId === 'string') extraCols.option_id = optionId;
      if (typeof customInstruction === 'string') extraCols.custom_instruction = customInstruction;
    }

    let { error } = await supabaseAdmin.from(EVENTS_TABLE).insert({
      session_id: sessionId,
      anon_id: anonId,
      kid_id: kidId,
      type,
      payload,
      occurred_at: new Date(),
      ...extraCols,
    });

    // If the insert failed because some extra analytic columns are missing, retry without them
    if (error && (error as any).message?.includes('column')) {
      console.warn('log-event retrying without optional analytic columns (schema mismatch)');
      const { error: retryErr } = await supabaseAdmin.from(EVENTS_TABLE).insert({
        session_id: sessionId,
        anon_id: anonId,
        kid_id: kidId,
        type,
        payload,
        occurred_at: new Date(),
      });
      if (retryErr) throw retryErr;
    } else if (error) {
      throw error;
    }

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('❌ log-event error:', e.message || e);
    // Do not expose internals to client
    return res.status(500).json({ error: 'db_error' });
  }
} 
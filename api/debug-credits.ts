import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';
import { applyCors, handlePreflight } from './_utils.js';

/**
 * GET /api/debug-credits
 * 调试积分查询问题 - 显示详细的查询信息
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);

  const { anonId, email } = req.query;

  // 确定表名
  const env = process.env.VERCEL_ENV || 'development';
  const TABLE = process.env.CREDITS_TABLE || ((env === 'production' || env === 'preview') ? 'credits' : 'credits_shadow');

  const debug = {
    env,
    table: TABLE,
    anonId,
    email,
    queries: [] as any[]
  };

  try {
    // 1. 查询主表的所有记录（限制10条）
    const { data: allRecords, error: allError } = await supabaseAdmin
      .from('credits')
      .select('*')
      .limit(10);

    debug.queries.push({
      type: 'all_credits_table',
      data: allRecords,
      error: allError
    });

    // 2. 查询影子表的所有记录（如果存在）
    const { data: shadowRecords, error: shadowError } = await supabaseAdmin
      .from('credits_shadow')
      .select('*')
      .limit(10);

    debug.queries.push({
      type: 'all_credits_shadow_table',
      data: shadowRecords,
      error: shadowError
    });

    // 3. 按email查询主表
    if (email) {
      const { data: emailRecords, error: emailError } = await supabaseAdmin
        .from('credits')
        .select('*')
        .eq('email', email);

      debug.queries.push({
        type: 'email_query_credits',
        data: emailRecords,
        error: emailError
      });
    }

    // 4. 按anon_id查询主表
    if (anonId) {
      const { data: anonRecords, error: anonError } = await supabaseAdmin
        .from('credits')
        .select('*')
        .eq('anon_id', anonId);

      debug.queries.push({
        type: 'anon_id_query_credits',
        data: anonRecords,
        error: anonError
      });
    }

    // 5. 查询API实际使用的表
    const { data: apiTableRecords, error: apiTableError } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .limit(10);

    debug.queries.push({
      type: `api_table_${TABLE}`,
      data: apiTableRecords,
      error: apiTableError
    });

    return res.status(200).json(debug);

  } catch (error) {
    debug.queries.push({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json(debug);
  }
}
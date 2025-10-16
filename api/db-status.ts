import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';
import { applyCors, handlePreflight } from './_utils';

/**
 * GET /api/db-status
 * 检查数据库状态和邮箱验证相关表的存在性
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);

  const status = {
    timestamp: new Date().toISOString(),
    supabase_connected: false,
    subscribers_table: false,
    subscribers_has_verified_column: false,
    email_verifications_table: false,
    error: null as string | null
  };

  try {
    // 1. 检查 Supabase 连接
    const { data: testData, error: testError } = await supabaseAdmin
      .from('subscribers')
      .select('count', { count: 'exact', head: true });
    
    if (testError) {
      status.error = `Supabase connection failed: ${testError.message}`;
      return res.status(500).json(status);
    }
    
    status.supabase_connected = true;
    status.subscribers_table = true;

    // 2. 检查 subscribers 表是否有 verified 字段
    const { data: columns, error: schemaError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'subscribers')
      .eq('column_name', 'verified');

    if (!schemaError && columns && columns.length > 0) {
      status.subscribers_has_verified_column = true;
    }

    // 3. 检查 email_verifications 表是否存在
    const { data: verificationTest, error: verificationError } = await supabaseAdmin
      .from('email_verifications')
      .select('count', { count: 'exact', head: true });

    if (!verificationError) {
      status.email_verifications_table = true;
    }

    return res.status(200).json(status);

  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
    return res.status(500).json(status);
  }
}
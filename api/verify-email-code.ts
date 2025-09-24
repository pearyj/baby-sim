import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';
import { applyCors, handlePreflight, rateLimit } from './_utils.js';

/**
 * POST /api/verify-email-code
 * 验证邮箱验证码
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);
  
  // 限制每分钟最多10次请求
  if (!rateLimit(req, res, 'verify-email', 10)) return;

  const { email, code, anonId } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email_required' });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code_required' });
  }

  // 验证码必须是6位数字
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'code_invalid_format' });
  }

  try {
    // 查找验证码记录
    const { data: verification, error: selectError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('Failed to query verification:', selectError);
      return res.status(500).json({ error: 'db_error' });
    }

    if (!verification) {
      return res.status(400).json({ error: 'code_invalid_or_expired' });
    }

    // 标记验证码为已使用
    const { error: updateError } = await supabaseAdmin
      .from('email_verifications')
      .update({ verified: true, updated_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      console.error('Failed to update verification:', updateError);
      return res.status(500).json({ error: 'db_error' });
    }

    // 将验证状态存储到 subscribers 表，标记邮箱已验证
    const { error: subscribeError } = await supabaseAdmin
      .from('subscribers')
      .upsert([{ 
        email, 
        verified: true,
        verified_at: new Date().toISOString()
      }], { 
        onConflict: 'email',
        ignoreDuplicates: false 
      });

    if (subscribeError) {
      console.error('Failed to update subscriber verification:', subscribeError);
      // 这不是致命错误，继续返回成功
    }

    // 清理该邮箱的其他验证码
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', email)
      .neq('id', verification.id);

    return res.status(200).json({ 
      success: true, 
      message: 'email_verified',
      email: email
    });

  } catch (error) {
    console.error('Verify email code error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
}
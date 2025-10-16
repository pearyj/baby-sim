import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';
import { applyCors, handlePreflight, rateLimit } from './_utils';
import { ensureSubscriberVerified, isEmailVerificationWhitelisted } from './emailVerificationWhitelist';

/**
 * GET /api/check-email-verification
 * 检查邮箱验证状态
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);
  
  if (!rateLimit(req, res, 'check-email-verification', 30)) return;

  const { email } = req.query;

  if (!email || Array.isArray(email)) {
    return res.status(400).json({ error: 'email_required' });
  }

  if (isEmailVerificationWhitelisted(email)) {
    await ensureSubscriberVerified(email);
    return res.status(200).json({
      verified: true,
      verifiedAt: new Date().toISOString(),
      verificationBypassed: true,
    });
  }

  try {
    // 直接检查 subscribers 表中的验证状态
    const { data: subscriber, error: selectError } = await supabaseAdmin
      .from('subscribers')
      .select('verified, verified_at')
      .eq('email', email)
      .maybeSingle();

    if (selectError) {
      // 如果出现列不存在等模式相关错误，降级为未启用验证功能
      const msg = selectError.message?.toLowerCase() || '';
      if (msg.includes('does not exist') || msg.includes('column') && msg.includes('verified')) {
        console.warn('Verification column not available, treating as not enabled');
        return res.status(200).json({
          verified: false,
          verifiedAt: null,
          reason: 'verification_not_enabled'
        });
      }
      console.error('Failed to check email verification:', selectError);
      return res.status(500).json({ error: 'db_error', details: selectError.message });
    }

    const isVerified = subscriber?.verified === true;

    return res.status(200).json({ 
      verified: isVerified,
      verifiedAt: subscriber?.verified_at || null
    });

  } catch (error) {
    console.error('Check email verification error:', error);
    return res.status(500).json({ 
      error: 'internal_error', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

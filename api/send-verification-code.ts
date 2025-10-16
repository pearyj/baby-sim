import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';
import { applyCors, handlePreflight, rateLimit } from './_utils';
import { ensureSubscriberVerified, isEmailVerificationWhitelisted } from './emailVerificationWhitelist';

// 多语言邮件内容
const emailContent = {
  zh: {
    subject: "您的养娃模拟器验证码",
    greeting: "您好！",
    message: "您的验证码是：",
    expiry: "此验证码将在10分钟后过期。",
    security: "如果您没有请求此验证码，请忽略此邮件。",
    footer: "祝您游戏愉快！<br>养娃模拟器团队"
  },
  en: {
    subject: "Your BabySim Verification Code",
    greeting: "Hello!",
    message: "Your verification code is:",
    expiry: "This code will expire in 10 minutes.",
    security: "If you didn't request this code, please ignore this email.",
    footer: "Happy parenting!<br>The BabySim Team"
  },
  ja: {
    subject: "BabySimの認証コード",
    greeting: "こんにちは！",
    message: "認証コードは：",
    expiry: "このコードは10分後に期限切れになります。",
    security: "このコードをリクエストしていない場合は、このメールを無視してください。",
    footer: "楽しい子育てを！<br>BabySimチーム"
  },
  es: {
    subject: "Tu Código de Verificación de BabySim",
    greeting: "¡Hola!",
    message: "Tu código de verificación es:",
    expiry: "Este código expirará en 10 minutos.",
    security: "Si no solicitaste este código, por favor ignora este correo.",
    footer: "¡Feliz crianza!<br>El Equipo de BabySim"
  }
};

// 检测语言的函数
function detectLanguageFromRequest(req: VercelRequest): keyof typeof emailContent {
  // 1. 检查请求体中的语言参数
  const { language } = req.body || {};
  if (language && emailContent[language as keyof typeof emailContent]) {
    return language as keyof typeof emailContent;
  }

  // 2. 检查 Accept-Language 头
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage) {
    const languages = acceptLanguage.split(',').map(lang => lang.split(';')[0].trim().toLowerCase());
    
    for (const lang of languages) {
      if (lang.startsWith('zh')) return 'zh';
      if (lang.startsWith('ja')) return 'ja';
      if (lang.startsWith('es')) return 'es';
      if (lang.startsWith('en')) return 'en';
    }
  }

  // 3. 默认使用英文
  return 'en';
}

/**
 * POST /api/send-verification-code
 * 发送邮箱验证码
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);
  
  // 限制每分钟最多3次请求
  if (!rateLimit(req, res, 'send-verification', 3)) return;

  const { email, anonId } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email_required' });
  }

  // 基础邮箱格式验证
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'email_invalid' });
  }

  if (isEmailVerificationWhitelisted(email)) {
    await ensureSubscriberVerified(email.toLowerCase());
    return res.status(200).json({
      success: true,
      verificationBypassed: true,
      message: 'whitelisted_email',
    });
  }

  try {
    // 生成6位数验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 清理该邮箱的旧验证码
    const { error: deleteError } = await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', email);

    if (deleteError && deleteError.code === '42P01') {
      console.error('email_verifications table does not exist:', deleteError);
      return res.status(500).json({ 
        error: 'table_not_found', 
        message: 'email_verifications table does not exist. Please run database migration.' 
      });
    }

    // 插入新的验证码
    const { error: insertError } = await supabaseAdmin
      .from('email_verifications')
      .insert({
        email,
        code,
        anon_id: anonId || null,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to insert verification code:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      
      // 如果是表不存在的错误，返回更具体的错误信息
      if (insertError.code === '42P01') {
        return res.status(500).json({ 
          error: 'table_not_found', 
          message: 'email_verifications table does not exist. Please run database migration.' 
        });
      }
      
      return res.status(500).json({ 
        error: 'db_error',
        details: insertError.message
      });
    }

    // 检测用户语言
    const userLanguage = detectLanguageFromRequest(req);

    // 发送邮件
    const emailSent = await sendVerificationEmail(email, code, userLanguage);
    
    if (!emailSent) {
      // 如果邮件发送失败，删除验证码记录
      await supabaseAdmin
        .from('email_verifications')
        .delete()
        .eq('email', email)
        .eq('code', code);
      
      return res.status(500).json({ error: 'email_send_failed' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'verification_code_sent',
      expiresIn: 600 // 10分钟
    });

  } catch (error) {
    console.error('Send verification code error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * 发送验证邮件
 * 这里需要集成邮件服务，如 Resend、SendGrid 等
 */
async function sendVerificationEmail(email: string, code: string, language: keyof typeof emailContent = 'en'): Promise<boolean> {
  try {
    // 这里需要您选择并配置邮件服务
    // 示例使用 Resend (推荐)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return false;
    }

    // 获取对应语言的邮件内容
    const content = emailContent[language];

    const emailPayload = {
      from: 'BabySim <noreply@babysim.fun>',
      to: email,
      subject: content.subject,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2 style="color: #8D6E63;">${content.subject}</h2>
          <p>${content.greeting}</p>
          <p>${content.message}</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #8D6E63; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="color: #666;">${content.expiry}</p>
          <p style="color: #666;">${content.security}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${content.footer}<br>
            ${language === 'zh' ? '如有问题，请联系：dev@babysim.fun' : 
              language === 'ja' ? 'ご質問がございましたら、dev@babysim.funまでお問い合わせください。' :
              language === 'es' ? 'Si tienes preguntas, contacta: dev@babysim.fun' :
              'If you have questions, contact: dev@babysim.fun'}
          </p>
        </div>
      `,
      text: `${content.greeting} ${content.message} ${code}. ${content.expiry}`
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      console.log(`Verification email sent successfully in ${language}`);
      return true;
    } else {
      const error = await response.text();
      console.error('Failed to send email:', error);
      return false;
    }

  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { stripe, PAYWALL_VERSION, calculateAmountAndCredits } from './paymentShared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('💳 Create checkout session request:', req.body);
  }

  if (PAYWALL_VERSION === 'off') {
    return res.status(200).json({ success: true, sessionId: 'disabled', url: null, message: 'Paywall disabled' });
  }

  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const { anonId, email, lang, donatedUnits, embedded = false, isMobile = false, isAppleDevice = false } = req.body;
  if (!anonId || !email || !donatedUnits || donatedUnits < 1) {
    return res.status(400).json({ error: 'Missing required parameters: anonId, email, and donatedUnits are required.' });
  }

  // Internal currency tag for pricing logic
  const currency = (lang || '').toLowerCase().startsWith('zh') ? 'RMB' : 'USD';
  const { amount, credits } = calculateAmountAndCredits(donatedUnits, currency as any);

  const MAX_AMOUNT_USD_CENTS = 500 * 100;
  const MAX_AMOUNT_RMB_FEN = 3000 * 100;

  if (currency === 'USD' && amount > MAX_AMOUNT_USD_CENTS) {
    return res.status(400).json({ error: 'Amount exceeds the limit of $500.' });
  }
  if (currency === 'RMB' && amount > MAX_AMOUNT_RMB_FEN) {
    return res.status(400).json({ error: 'Amount exceeds the limit of 3000 RMB.' });
  }

  // Stripe requires ISO currency codes (cny/usd)
  const stripeCurrency = currency === 'RMB' ? 'cny' : 'usd';

  console.log('💰 Checkout calculation:', {
    anonId,
    email,
    lang,
    donatedUnits,
    currency,
    amount,
    credits,
    embedded,
    isMobile,
  });

  try {
    // Determine payment method types based on currency and device
    let paymentMethodTypes: string[];
    let paymentMethodOptions: any = undefined;
    
    if (currency === 'USD') {
      // For USD (English users)
      if (isMobile) {
        // Mobile English users: Apple Pay first, then card
        paymentMethodTypes = ['apple_pay', 'card'];
      } else {
        // Desktop English users: card only
        paymentMethodTypes = ['card'];
      }
    } else {
      // For RMB (Chinese users) — support Apple Pay (via card), WeChat Pay, and Alipay

      if (isAppleDevice) {
        // Apple device: Apple Pay (card) default, then WeChat Pay, then Alipay
        paymentMethodTypes = ['card', 'wechat_pay', 'alipay'];
      } else {
        // Non-Apple device: WeChat Pay default, then Apple Pay (card), then Alipay
        paymentMethodTypes = ['wechat_pay', 'card', 'alipay'];
      }

      // Configure payment method options – Stripe requires client to be 'web', 'ios', or 'android'
      // Stripe Checkout currently supports only 'web' for wechat_pay client.
      paymentMethodOptions = {
        wechat_pay: {
          client: 'web',
        },
        alipay: {},
      };
    }

    const sessionConfig: any = {
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: { name: 'Baby Simulator Credits' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        anonId,
        email: email || '',
        lang,
        donatedUnits: String(donatedUnits),
        totalCredits: String(credits),
        currency,
        isMobile: String(isMobile),
      },
      mode: 'payment',
      customer_email: email || undefined,
      payment_method_options: paymentMethodOptions,
    };

    if (embedded && currency === 'USD') {
      // Embedded checkout configuration
      sessionConfig.ui_mode = 'embedded';
      sessionConfig.redirect_on_completion = 'never';
      console.log('🔗 Creating embedded checkout session');
    } else {
      // Redirect checkout configuration
      sessionConfig.success_url = `${req.headers.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
      sessionConfig.cancel_url = `${req.headers.origin}/`;
      console.log('🔗 Creating redirect checkout session');
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('✅ Stripe session created:', {
      sessionId: session.id,
      url: session.url,
      hasClientSecret: !!session.client_secret,
    });

    return res.status(200).json({ 
      success: true, 
      sessionId: session.id, 
      url: session.url,
      clientSecret: embedded ? session.client_secret : undefined
    });
  } catch (err: any) {
    console.error('❌ Stripe session error:', err);
    const message = err?.message || 'Stripe error';
    return res.status(500).json({ error: message });
  }
} 
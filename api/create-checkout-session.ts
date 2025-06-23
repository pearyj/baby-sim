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
    console.log('🚫 Paywall disabled via PAYWALL_VERSION=off');
    return res.status(200).json({ success: true, sessionId: 'disabled', url: null, message: 'Paywall disabled' });
  }

  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const { anonId, email, lang, donatedUnits, embedded = false } = req.body;
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
  });

  try {
    const sessionConfig: any = {
      payment_method_types: currency === 'USD' ? ['card'] : ['wechat_pay'],
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
      },
      mode: 'payment',
      customer_email: email || undefined,
      payment_method_options: currency === 'USD' ? undefined : {
        wechat_pay: { client: 'web' },
      },
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
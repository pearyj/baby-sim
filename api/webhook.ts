import { VercelRequest, VercelResponse } from '@vercel/node';
import { stripe, STRIPE_WEBHOOK_SECRET, creditsStorage } from './paymentShared';
import { supabaseAdmin } from './supabaseAdmin';
import type Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false, // We need raw body for signature verification
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(500).json({ error: 'Stripe not configured' });

  const sig = req.headers['stripe-signature'] as string;
  const raw = await getRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { anonId, totalCredits, currency } = session.metadata as any;
    
    console.log('🎯 Webhook received checkout.session.completed:', {
      sessionId: session.id,
      anonId,
      totalCredits,
      currency,
      email: session.metadata?.email,
      amountTotal: session.amount_total,
    });
    
    if (!anonId) return res.status(200).json({ received: true });

    const prior = creditsStorage.get(anonId);
    const add = parseInt(totalCredits);
    
    console.log('💰 Processing credits:', {
      anonId,
      priorCredits: prior?.credits || 0,
      addingCredits: add,
      newTotal: (prior?.credits || 0) + add,
    });
    
    creditsStorage.set(anonId, {
      anonId,
      email: session.metadata?.email || undefined,
      credits: (prior?.credits || 0) + add,
      currency: currency as any,
      amount: session.amount_total || 0,
      stripeSession: session.id,
      createdAt: new Date(),
    });

    // Determine which table to write to. By default we keep using the shadow table until
    // PAYWALL_PERSISTENCE is explicitly switched to "db" (slice 3+). This makes it
    // impossible to accidentally corrupt prod data while still allowing reads to work.
    const CREDITS_TABLE = process.env.CREDITS_TABLE || (process.env.VERCEL_ENV === 'production' ? 'credits' : 'credits_shadow');

    console.log('🗄️ Writing to table:', CREDITS_TABLE);
    
    try {
      // Fetch current credits
      const { data: existingRows, error: selErr } = await supabaseAdmin
        .from(CREDITS_TABLE)
        .select('credits')
        .eq('anon_id', anonId)
        .limit(1);

      if (selErr) throw selErr;

      const current = existingRows && existingRows.length > 0 ? existingRows[0].credits || 0 : 0;

      if (existingRows && existingRows.length > 0) {
        // update
        await supabaseAdmin
          .from(CREDITS_TABLE)
          .update({ credits: current + add, email: session.metadata?.email || null })
          .eq('anon_id', anonId);
      } else {
        await supabaseAdmin.from(CREDITS_TABLE).insert({
          anon_id: anonId,
          email: session.metadata?.email || null,
          credits: add,
          currency,
          amount: session.amount_total || 0,
          stripe_session: session.id,
        });
      }

          // Always insert a purchase record for auditing
    const PURCHASES_TABLE = process.env.PURCHASES_TABLE || (process.env.VERCEL_ENV === 'production' ? 'purchases' : 'purchases_shadow');
    await supabaseAdmin.from(PURCHASES_TABLE).insert({
        anon_id: anonId,
        email: session.metadata?.email || null,
        credits: add,
        currency,
        amount: session.amount_total || 0,
        stripe_session: session.id,
      });
      console.log('✅ Supabase upsert successful');
    } catch (e: any) {
      console.error(`❌ Supabase insert error into ${CREDITS_TABLE}:`, e?.message || e);

      // Automatic fallback: if the error is due to unknown columns or type mismatch, retry with a minimal payload
      if (e?.message?.includes('column') || e?.code === '22P02') {
        console.log('🔄 Attempting fallback minimal insert...');
        try {
          await supabaseAdmin.from(CREDITS_TABLE).insert({
            anon_id: anonId,
            credits: add,
          });
          console.log('✅ Fallback minimal insert succeeded');
        } catch (err2) {
          console.error('❌ Fallback insert also failed:', err2);
        }
      }
    }
  }

  return res.status(200).json({ received: true });
}

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
} 
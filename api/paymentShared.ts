import Stripe from 'stripe';

// Shared RAM credits store (slice 1)
export interface CreditEntry {
  anonId: string;
  email?: string;
  credits: number;
  currency: 'USD' | 'RMB';
  amount: number;
  stripeSession: string;
  createdAt: Date;
}

export const creditsStorage: Map<string, CreditEntry> = globalThis.__CREDITS_STORE__ || new Map();
if (!globalThis.__CREDITS_STORE__) globalThis.__CREDITS_STORE__ = creditsStorage;

// Feature flag
export const PAYWALL_VERSION = process.env.PAYWALL_VERSION || 'test';

// Stripe setup (test mode only in slice 1)
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
}) : null;

export const PRICE_CONFIG = {
  USD: { basePrice: 299, baseCredits: 2, additionalCreditPrice: 150 },
  RMB: { basePrice: 990, baseCredits: 1, additionalCreditPrice: 990 },
} as const;

// Display text explaining premium Gemini usage for embedding in the paywall where needed
export const PREMIUM_NOTICE_EN =
  'Premium Gemini 3.0 Pro costs more and may have regional access limits. Your credits can also be used for image generation at the end of the game.';
export const PREMIUM_NOTICE_ZH =
  '高级 Gemini 3.0 Pro 成本更高，部分地区访问可能受限。同一套积分也可用于游戏结尾的图片生成。';

type Currency = keyof typeof PRICE_CONFIG;

export function calculateAmountAndCredits(units: number, currency: Currency) {
  const cfg = PRICE_CONFIG[currency];
  if (units <= 1) return { amount: cfg.basePrice, credits: cfg.baseCredits };
  return {
    amount: cfg.basePrice + (units - 1) * cfg.additionalCreditPrice,
    credits: cfg.baseCredits + (units - 1),
  };
}

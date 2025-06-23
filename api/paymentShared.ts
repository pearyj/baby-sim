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
// @ts-ignore
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
  USD: { basePrice: 199, baseCredits: 2, additionalCreditPrice: 100 },
  RMB: { basePrice: 600, baseCredits: 1, additionalCreditPrice: 600 },
} as const;

type Currency = keyof typeof PRICE_CONFIG;

export function calculateAmountAndCredits(units: number, currency: Currency) {
  const cfg = PRICE_CONFIG[currency];
  if (units <= 1) return { amount: cfg.basePrice, credits: cfg.baseCredits };
  return {
    amount: cfg.basePrice + (units - 1) * cfg.additionalCreditPrice,
    credits: cfg.baseCredits + (units - 1),
  };
} 
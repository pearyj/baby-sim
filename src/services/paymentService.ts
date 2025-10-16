import type { CreditInfo, CheckoutSessionRequest, CheckoutSessionResponse } from '../types/payment';
import { request, CreditInfoSchema, CheckoutSessionResponseSchema, ConsumeCreditSchema } from './apiClient';

const API_BASE = '/api';

export async function fetchCredits(anonId: string, email?: string): Promise<CreditInfo> {
  const params = new URLSearchParams();
  if (anonId) params.append('anonId', anonId);
  if (email) params.append('email', email);
  
  const url = `${API_BASE}/credits?${params}`;
  
  return request(url, CreditInfoSchema);
}

export async function createCheckoutSession(req: CheckoutSessionRequest & { embedded?: boolean }): Promise<CheckoutSessionResponse> {
  return request(`${API_BASE}/create-checkout-session`, CheckoutSessionResponseSchema, {
    method: 'POST',
    body: req,
  });
}

// Consume one credit via backend; returns remaining credits
export async function consumeCreditAPI(anonId: string, email?: string, amount?: number): Promise<{ remaining: number }> {
  const resp = await request(`${API_BASE}/consume-credit`, ConsumeCreditSchema, {
    method: 'POST',
    body: { anonId, email, amount },
  });
  if (resp.ok === false || typeof resp.remaining !== 'number') {
    throw new Error(resp.error || 'Failed to consume credit');
  }
  return { remaining: resp.remaining };
}

// Generate or retrieve anonymous ID from localStorage
export function getOrCreateAnonymousId(): string {
  const key = 'baby-simulator-anon-id';
  let anonId = localStorage.getItem(key);
  
  if (!anonId) {
    anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(key, anonId);
  }
  
  return anonId;
}

// Price configuration (should match backend)
export const PRICE_CONFIG = {
  USD: { basePrice: 299, baseCredits: 2, additionalCreditPrice: 150 },
  // RMB: { basePrice: 600, baseCredits: 1, additionalCreditPrice: 600 },
  RMB: { basePrice: 990, baseCredits: 1, additionalCreditPrice: 990 },
};

export function calculatePricing(donatedUnits: number, currency: 'USD' | 'RMB') {
  const config = PRICE_CONFIG[currency];
  
  let totalAmount: number;
  let totalCredits: number;
  
  if (donatedUnits === 1) {
    totalAmount = config.basePrice;
    totalCredits = config.baseCredits;
  } else {
    totalAmount = config.basePrice + (donatedUnits - 1) * config.additionalCreditPrice;
    totalCredits = config.baseCredits + (donatedUnits - 1);
  }
  
  return {
    totalAmount: totalAmount / 100, // Convert to dollars/yuan
    totalCredits,
    currency,
  };
}
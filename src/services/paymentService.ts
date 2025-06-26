import type { CreditInfo, CheckoutSessionRequest, CheckoutSessionResponse } from '../types/payment';

const API_BASE = '/api';

export async function fetchCredits(anonId: string, email?: string): Promise<CreditInfo> {
  const params = new URLSearchParams();
  if (anonId) params.append('anonId', anonId);
  if (email) params.append('email', email);
  
  const url = `${API_BASE}/credits?${params}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }
  
  const result = await response.json();
  return result;
}

export async function createCheckoutSession(request: CheckoutSessionRequest & { embedded?: boolean }): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${API_BASE}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }
  
  return response.json();
}

// Consume one credit via backend; returns remaining credits
export async function consumeCreditAPI(anonId: string, email?: string): Promise<{ remaining: number }> {
  const response = await fetch(`${API_BASE}/consume-credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonId, email }),
  });

  if (!response.ok) {
    throw new Error('Failed to consume credit');
  }

  return response.json();
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
  USD: { basePrice: 199, baseCredits: 2, additionalCreditPrice: 100 },
  RMB: { basePrice: 600, baseCredits: 1, additionalCreditPrice: 600 },
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
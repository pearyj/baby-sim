export interface CreditInfo {
  credits: number;
  bypass?: boolean;
}

export interface CheckoutSessionRequest {
  anonId: string;
  email?: string;
  lang: string;
  donatedUnits: number;
  isMobile?: boolean;
}

export interface CheckoutSessionResponse {
  success: boolean;
  sessionId?: string;
  url?: string;
  clientSecret?: string;
  error?: string;
  message?: string;
}

export interface PaymentConfig {
  basePrice: number;
  baseCredits: number;
  additionalCreditPrice: number;
}

export interface PaymentStore {
  anonId: string;
  credits: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializeAnonymousId: () => void;
  fetchCredits: (email?: string) => Promise<void>;
  createCheckoutSession: (request: CheckoutSessionRequest) => Promise<CheckoutSessionResponse>;
  consumeCredit: () => boolean;
} 
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as paymentService from '../services/paymentService';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '../types/payment';

interface PaymentState {
  anonId: string;
  email: string;
  credits: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializeAnonymousId: () => void;
  setEmail: (email: string) => void;
  fetchCredits: (email?: string) => Promise<void>;
  createCheckoutSession: (request: Omit<CheckoutSessionRequest, 'anonId'> & { embedded?: boolean }) => Promise<CheckoutSessionResponse>;
  consumeCredit: (email?: string) => Promise<boolean>;
  resetError: () => void;
}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set, get) => ({
      anonId: '',
      email: '',
      credits: 0,
      isLoading: false,
      error: null,

      initializeAnonymousId: () => {
        const anonId = paymentService.getOrCreateAnonymousId();
        console.warn('🔍 PAYWALL DEBUG - PaymentStore: initializeAnonymousId:', anonId?.slice(-8));
        set({ anonId });
      },

      setEmail: (email: string) => {
        console.warn('🔍 PAYWALL DEBUG - PaymentStore: setEmail:', email);
        set({ email });
      },

      fetchCredits: async (emailParam?: string) => {
        const { anonId, email } = get();
        if (!anonId) {
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: fetchCredits failed - no anonId');
          set({ error: 'Anonymous ID not initialized' });
          return;
        }

        const emailToUse = emailParam || email || undefined;
        console.warn('🔍 PAYWALL DEBUG - PaymentStore: fetchCredits called:', { 
          anonId: anonId?.slice(-8), 
          emailParam, 
          storeEmail: email, 
          emailToUse,
          timestamp: new Date().toISOString()
        });

        set({ isLoading: true, error: null });
        try {
          const result = await paymentService.fetchCredits(anonId, emailToUse);
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: fetchCredits result:', {
            credits: result.credits,
            bypass: result.bypass,
            timestamp: new Date().toISOString()
          });
          set({ credits: result.credits, isLoading: false });
        } catch (error) {
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: fetchCredits error:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch credits', 
            isLoading: false 
          });
        }
      },

      createCheckoutSession: async (request) => {
        const { anonId } = get();
        if (!anonId) {
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: createCheckoutSession failed - no anonId');
          throw new Error('Anonymous ID not initialized');
        }

        console.warn('🔍 PAYWALL DEBUG - PaymentStore: createCheckoutSession called:', {
          anonId: anonId?.slice(-8),
          email: request.email,
          donatedUnits: request.donatedUnits,
          timestamp: new Date().toISOString()
        });

        set({ isLoading: true, error: null });
        try {
          const result = await paymentService.createCheckoutSession({
            ...request,
            anonId,
          });
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: createCheckoutSession result:', {
            success: result.success,
            sessionId: result.sessionId,
            hasUrl: !!result.url,
            hasClientSecret: !!result.clientSecret,
            timestamp: new Date().toISOString()
          });
          set({ isLoading: false });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: createCheckoutSession error:', {
            error: errorMessage,
            timestamp: new Date().toISOString()
          });
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      consumeCredit: async (emailParam?: string) => {
        const { anonId, email, credits } = get();
        console.warn('🔍 PAYWALL DEBUG - PaymentStore: consumeCredit called:', {
          anonId: anonId?.slice(-8),
          currentCredits: credits,
          emailParam,
          timestamp: new Date().toISOString()
        });

        if (credits <= 0) {
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: consumeCredit failed - no credits');
          return false;
        }

        const emailToUse = emailParam || email || undefined;

        try {
          const result = await paymentService.consumeCreditAPI(anonId, emailToUse);
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: consumeCredit result:', {
            remaining: result.remaining,
            success: true,
            timestamp: new Date().toISOString()
          });
          set({ credits: result.remaining });
          return true;
        } catch (error) {
          console.warn('🔍 PAYWALL DEBUG - PaymentStore: consumeCredit error:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          return false;
        }
      },

      resetError: () => {
        console.warn('🔍 PAYWALL DEBUG - PaymentStore: resetError called');
        set({ error: null });
      },
    }),
    {
      name: 'payment-store',
      partialize: (state) => ({ 
        anonId: state.anonId,
        email: state.email,
      }),
    }
  )
); 
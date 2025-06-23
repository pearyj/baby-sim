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
        set({ anonId });
      },

      setEmail: (email: string) => set({ email }),

      fetchCredits: async (emailParam?: string) => {
        const { anonId, email } = get();
        if (!anonId) {
          set({ error: 'Anonymous ID not initialized' });
          return;
        }

        const emailToUse = emailParam || email || undefined;
        if (import.meta.env.DEV) {
      console.log('🔍 PaymentStore: fetchCredits called with:', { anonId, emailParam, storeEmail: email, emailToUse });
    }

        set({ isLoading: true, error: null });
        try {
          const result = await paymentService.fetchCredits(anonId, emailToUse);
          if (import.meta.env.DEV) {
        console.log('🔍 PaymentStore: fetchCredits result:', result);
      }
          set({ credits: result.credits, isLoading: false });
        } catch (error) {
          if (import.meta.env.DEV) {
        console.error('🔍 PaymentStore: fetchCredits error:', error);
      } else {
        // In production, still log errors but without debug prefix
        console.error('PaymentStore: fetchCredits error:', error);
      }
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch credits', 
            isLoading: false 
          });
        }
      },

      createCheckoutSession: async (request) => {
        const { anonId } = get();
        if (!anonId) {
          throw new Error('Anonymous ID not initialized');
        }

        set({ isLoading: true, error: null });
        try {
          const result = await paymentService.createCheckoutSession({
            ...request,
            anonId,
          });
          set({ isLoading: false });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      consumeCredit: async (emailParam?: string) => {
        const { anonId, email, credits } = get();
        if (credits <= 0) return false;

        const emailToUse = emailParam || email || undefined;

        try {
          const result = await paymentService.consumeCreditAPI(anonId, emailToUse);
          set({ credits: result.remaining });
          return true;
        } catch (error) {
          if (import.meta.env.DEV) {
        console.error('consumeCredit API failed', error);
      } else {
        console.error('Credit consumption failed');
      }
          return false;
        }
      },

      resetError: () => {
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
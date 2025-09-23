import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as paymentService from '../services/paymentService';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '../types/payment';
import { updateSessionFlags, logEvent } from '../services/eventLogger';

interface PaymentState {
  anonId: string;
  kidId: string;
  email: string;
  credits: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializeAnonymousId: () => void;
  setEmail: (email: string) => void;
  fetchCredits: (email?: string) => Promise<void>;
  createCheckoutSession: (request: Omit<CheckoutSessionRequest, 'anonId'> & { embedded?: boolean }) => Promise<CheckoutSessionResponse>;
  consumeCredit: (email?: string, amount?: number) => Promise<boolean>;
  resetError: () => void;
  setKidId: (kidId: string) => void;

}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set, get) => ({
      anonId: '',
      kidId: '',
      email: '',
      credits: 0,
      isLoading: false,
      error: null,

      initializeAnonymousId: () => {
        const anonId = paymentService.getOrCreateAnonymousId();
        set({ anonId });
      },

      setEmail: (email: string) => {
        set({ email });
      },

      fetchCredits: async (emailParam?: string) => {
        const { anonId, email } = get();
        if (!anonId) {
          set({ error: 'Anonymous ID not initialized' });
          return;
        }

        const emailToUse = emailParam || email || undefined;

        set({ isLoading: true, error: null });
        try {
          const result = await paymentService.fetchCredits(anonId, emailToUse);
          set({ credits: result.credits, isLoading: false });
        } catch (error) {
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
          const { kidId } = get();
          if (kidId) {
            updateSessionFlags(anonId, kidId, { checkoutInitiated: true });
            logEvent(anonId, kidId, 'checkout_initiated', {
              donatedUnits: request.donatedUnits,
              embedded: request.embedded,
            });
          }
          set({ isLoading: false });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      consumeCredit: async (emailParam?: string, amount?: number) => {
        const { anonId, email, credits } = get();

        if (credits <= 0) {
          return false;
        }

        const emailToUse = emailParam || email || undefined;

        try {
          const result = await paymentService.consumeCreditAPI(anonId, emailToUse, amount);
          set({ credits: result.remaining });
          return true;
        } catch (error) {
          return false;
        }
      },

      resetError: () => {
        set({ error: null });
      },

      setKidId: (kidId: string) => set({ kidId }),
    }),
    {
      name: 'payment-store',
      partialize: (state) => ({ 
        anonId: state.anonId,
        kidId: state.kidId,
        email: state.email,
      }),
    }
  )
);
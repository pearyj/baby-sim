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
  creditsLastFetched: number; // 积分最后获取时间戳
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializeAnonymousId: () => void;
  setEmail: (email: string) => void;
  fetchCredits: (email?: string, forceRefresh?: boolean) => Promise<void>;
  createCheckoutSession: (request: Omit<CheckoutSessionRequest, 'anonId'> & { embedded?: boolean }) => Promise<CheckoutSessionResponse>;
  consumeCredit: (email?: string, amount?: number) => Promise<boolean>;
  resetError: () => void;
  setKidId: (kidId: string) => void;
  isCreditsCacheValid: () => boolean;

}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set, get) => ({
      anonId: '',
      kidId: '',
      email: '',
      credits: 0,
      creditsLastFetched: 0,
      isLoading: false,
      error: null,

      initializeAnonymousId: () => {
        const anonId = paymentService.getOrCreateAnonymousId();
        set({ anonId });
      },

      setEmail: (email: string) => {
        set({ email });
      },

      isCreditsCacheValid: () => {
        const { creditsLastFetched } = get();
        const now = Date.now();
        const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
        return now - creditsLastFetched < CACHE_DURATION;
      },

      fetchCredits: async (emailParam?: string, forceRefresh?: boolean) => {
        const { anonId, email, isCreditsCacheValid } = get();
        if (!anonId) {
          set({ error: 'Anonymous ID not initialized' });
          return;
        }

        // 如果缓存有效且不强制刷新，直接返回
        if (!forceRefresh && isCreditsCacheValid()) {
          return;
        }

        const emailToUse = emailParam || email || undefined;

        set({ isLoading: true, error: null });
        try {
          const result = await paymentService.fetchCredits(anonId, emailToUse);
          set({ 
            credits: result.credits, 
            creditsLastFetched: Date.now(),
            isLoading: false 
          });
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
          set({ 
            credits: result.remaining,
            creditsLastFetched: Date.now() // 更新缓存时间戳
          });
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
        credits: state.credits,
        creditsLastFetched: state.creditsLastFetched,
      }),
    }
  )
);
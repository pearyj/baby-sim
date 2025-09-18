import { useState, useEffect } from 'react';
import { usePaymentStore } from '../stores/usePaymentStore';

/**
 * Hook to check if user has paid (has credits)
 * Returns true if user has any credits, false otherwise
 */
export const usePaymentStatus = () => {
  const { credits, email, fetchCredits } = usePaymentStore();
  const [hasPaid, setHasPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      setIsLoading(true);
      try {
        // Fetch latest credits if we have an email
        if (email) {
          await fetchCredits(email);
        } else {
          await fetchCredits();
        }
        
        // User has paid if they have any credits
        setHasPaid(credits > 0);
      } catch (error) {
        console.error('Error checking payment status:', error);
        setHasPaid(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPaymentStatus();
  }, [email, fetchCredits]);

  // Update hasPaid when credits change
  useEffect(() => {
    setHasPaid(credits > 0);
  }, [credits]);

  return {
    hasPaid,
    isLoading,
    credits
  };
};
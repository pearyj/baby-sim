import { useState, useEffect } from 'react';
import { usePaymentStore } from '../stores/usePaymentStore';

/**
 * Hook to check if user can generate images based on credits
 * New logic: 
 * - Can generate if credits >= 0.3
 * - If credits between 0.15-0.3, need age check
 * - Each image costs 0.15 credits
 */
export const usePaymentStatus = () => {
  const { credits, email, fetchCredits } = usePaymentStore();
  const [hasPaid, setHasPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsAgeCheck, setNeedsAgeCheck] = useState(false);

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
        
        // New payment logic
        if (credits >= 0.3) {
          setHasPaid(true);
          setNeedsAgeCheck(false);
        } else if (credits >= 0.15 && credits < 0.3) {
          setHasPaid(false); // Will be determined by age check
          setNeedsAgeCheck(true);
        } else {
          setHasPaid(false);
          setNeedsAgeCheck(false);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        setHasPaid(false);
        setNeedsAgeCheck(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPaymentStatus();
  }, [email, fetchCredits]);

  // Update payment status when credits change
  useEffect(() => {
    if (credits >= 0.3) {
      setHasPaid(true);
      setNeedsAgeCheck(false);
    } else if (credits >= 0.15 && credits < 0.3) {
      setHasPaid(false);
      setNeedsAgeCheck(true);
    } else {
      setHasPaid(false);
      setNeedsAgeCheck(false);
    }
  }, [credits]);

  return {
    hasPaid,
    isLoading,
    credits,
    needsAgeCheck
  };
};
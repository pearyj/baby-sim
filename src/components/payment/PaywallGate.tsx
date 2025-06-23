import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePaymentStore } from '../../stores/usePaymentStore';
import { PaywallUI } from './PaywallUI';

interface PaywallGateProps {
  children: React.ReactNode;
  childName: string;
  requiresCredits?: boolean;
  onCreditConsumed?: () => void;
}

// Feature flag check (in real app, this would come from env or config)
const PAYWALL_VERSION = import.meta.env.VITE_PAYWALL_VERSION || 'test';

export const PaywallGate: React.FC<PaywallGateProps> = ({ 
  children, 
  childName, 
  requiresCredits = true,
  onCreditConsumed 
}) => {
  const { i18n } = useTranslation();
  const { 
    anonId, 
    credits, 
    isLoading, 
    error, 
    initializeAnonymousId, 
    fetchCredits,
    consumeCredit,
    resetError,
    email
  } = usePaymentStore();
  
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [waitingForCredit, setWaitingForCredit] = useState(false);

  // Feature flag check - if paywall is off, always render children
  if (PAYWALL_VERSION === 'off') {
    return <>{children}</>;
  }

  // Fallback bypass check
  const skipPaywall = new URLSearchParams(window.location.search).get('skipPaywall') === 'yes';
  if (skipPaywall) {
    return <>{children}</>;
  }

  useEffect(() => {
    if (!hasInitialized) {
      initializeAnonymousId();
      setHasInitialized(true);
    }
  }, [hasInitialized, initializeAnonymousId]);

  useEffect(() => {
    if (anonId && hasInitialized) {
      fetchCredits();
    }
  }, [anonId, hasInitialized, fetchCredits]);

  // Allow generation if credits available, but don't deduct yet.
  const handleGenerateImage = () => {
    // Require email first
    if (!email) {
      setShowPaywall(true);
      return false;
    }

    // If credits already known and >0 allow, else open paywall / checker
    if (!requiresCredits) return true;

    if (credits > 0) return true;

    // Credits 0 → open paywall to let user check / donate
    setShowPaywall(true);
    return false;
  };

  // Wrap onImageGenerated to deduct credit after success
  const createEnhancedProps = (childProps: any) => {
    const originalOnImageGenerated = childProps.onImageGenerated;
    return {
      onBeforeGenerate: handleGenerateImage,
      hasCredits: credits > 0,
      creditsCount: credits,
      onImageGenerated: async (result: any) => {
        if (result?.success && requiresCredits) {
          const succeeded = await consumeCredit();
          if (succeeded) onCreditConsumed?.();
        }
        originalOnImageGenerated?.(result);
      },
    };
  };

  const handlePaywallClose = () => {
    setShowPaywall(false);
    resetError();
    // Refresh credits after potential payment
    if (anonId) {
      const prev = credits;
      setWaitingForCredit(true);

      let canceled = false;

      const poll = async (attempt = 0) => {
        if (canceled) return;
        await fetchCredits();
        const newCredits = usePaymentStore.getState().credits;
        if (newCredits > prev || attempt >= 4) { // stop after ~4s
          setWaitingForCredit(false);
          return;
        }
        setTimeout(() => poll(attempt + 1), 1000);
      };

      poll();

      return () => {
        canceled = true;
      };
    }
  };

  // Ensure any pending poll is cleared if component unmounts
  useEffect(() => {
    return () => {
      setWaitingForCredit(false);
    };
  }, []);

  // Loading state
  if (isLoading && !hasInitialized) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={40} sx={{ color: '#8D6E63', mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          {i18n.language === 'zh' ? '初始化中...' : 'Initializing...'}
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error && !showPaywall) {
    return (
      <Box sx={{ py: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        {children}
      </Box>
    );
  }

  // Clone children and inject the handleGenerateImage function if it's the AIImageGenerator
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type && 
        (child.type as any).name === 'AIImageGenerator') {
      return React.cloneElement(child as React.ReactElement<any>, {
        ...createEnhancedProps(child.props),
        isCheckingCredits: waitingForCredit && credits === 0,
      });
    }
    return child;
  });

  return (
    <>
      <Box>
        {/* Show credit info in test mode */}
        {PAYWALL_VERSION === 'test' && (
          <Box sx={{ 
            p: 1, 
            mb: 2, 
            bgcolor: 'rgba(139, 69, 19, 0.1)', 
            borderRadius: 1,
            fontSize: '0.8rem',
            color: 'text.secondary'
          }}>
            {i18n.language === 'zh' 
              ? `测试模式 | 积分: ${credits} | ID: ${anonId?.slice(-8)}` 
              : `Test Mode | Credits: ${credits} | ID: ${anonId?.slice(-8)}`
            }
          </Box>
        )}
        
        {enhancedChildren}
      </Box>

      <PaywallUI
        open={showPaywall}
        onClose={handlePaywallClose}
        childName={childName}
      />
    </>
  );
}; 
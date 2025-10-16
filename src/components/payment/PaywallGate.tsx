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
const IS_DEV = import.meta.env.DEV;
// Enforce paywall in development as well as in production mode
const ENFORCE_PAYWALL = IS_DEV || PAYWALL_VERSION === 'prod';

export const PaywallGate: React.FC<PaywallGateProps> = ({ 
  children, 
  childName, 
  requiresCredits = true,
  onCreditConsumed 
}) => {
  console.log('[PaywallGate] 组件被渲染, childName:', childName, 'requiresCredits:', requiresCredits);
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

  // Feature flag check - if paywall is off AND not in dev, allow bypass
  if (PAYWALL_VERSION === 'off' && !IS_DEV) {
    return <>{children}</>;
  }

  // Fallback bypass check
  const skipPaywall = new URLSearchParams(window.location.search).get('skipPaywall') === 'yes';
  // Only honor skipPaywall when not enforcing (i.e., not dev and not prod mode)
  if (skipPaywall && !ENFORCE_PAYWALL) {
    return <>{children}</>;
  }

  useEffect(() => {
    // Initialize payment store when PaywallGate is used
    if (!hasInitialized) {
      initializeAnonymousId();
      setHasInitialized(true);
    }
  }, [hasInitialized, initializeAnonymousId]);

  useEffect(() => {
    // Fetch credits when initialized
    if (anonId && hasInitialized) {
      fetchCredits(); // 使用缓存机制，不强制刷新
    }
  }, [anonId, hasInitialized, fetchCredits]);

  // Allow generation if credits available, but don't deduct yet.
  const handleGenerateImage = () => {
    // Enforce paywall logic in development and production mode
    if (ENFORCE_PAYWALL) {
      // Require email first
      if (!email) {
        setShowPaywall(true);
        return false;
      }

      // If credits required and none available, show paywall
      if (requiresCredits && credits <= 0) {
        setShowPaywall(true);
        return false;
      }
    }

    // If credits already known and >0 allow, else open paywall / checker
    if (!requiresCredits) {
      return true;
    }

    if (credits > 0) {
      return true;
    }

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
    if (React.isValidElement(child) && child.type) {
      const componentName = (child.type as any).name || (child.type as any).displayName || 'Unknown';
      const hasGameState = (child.props as any)?.gameState;
      const hasEndingSummary = (child.props as any)?.endingSummary;
      
      // Check for AIImageGenerator by component name OR by having both gameState and endingSummary props
      if (componentName === 'AIImageGenerator' || (hasGameState && hasEndingSummary)) {
        return React.cloneElement(child as React.ReactElement<any>, {
          ...createEnhancedProps(child.props),
          isCheckingCredits: waitingForCredit && credits === 0,
        });
      }
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
        mode={'image'}
      />
      {console.log('[PaywallGate] PaywallUI渲染状态 - open:', showPaywall, 'credits:', credits, 'anonId:', anonId)}
    </>
  );
};
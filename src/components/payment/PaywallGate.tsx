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

  // Production debugging: Log PaywallGate initialization - only during ending phase
  const isEndingPhase = React.Children.toArray(children).some(child => {
    if (React.isValidElement(child) && child.type) {
      const hasGameState = (child.props as any)?.gameState;
      const hasEndingSummary = (child.props as any)?.endingSummary;
      const componentName = (child.type as any).name || (child.type as any).displayName || 'Unknown';
      return componentName === 'AIImageGenerator' || (hasGameState && hasEndingSummary);
    }
    return false;
  });

  useEffect(() => {
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - PaywallGate initialized:', {
        PAYWALL_VERSION,
        childName,
        requiresCredits,
        timestamp: new Date().toISOString()
      });
    }
  }, [childName, requiresCredits, isEndingPhase]);

  // Feature flag check - if paywall is off, always render children
  if (PAYWALL_VERSION === 'off') {
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Paywall disabled, rendering children directly');
    }
    return <>{children}</>;
  }

  // Fallback bypass check
  const skipPaywall = new URLSearchParams(window.location.search).get('skipPaywall') === 'yes';
  if (skipPaywall) {
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Paywall bypassed via URL parameter');
    }
    return <>{children}</>;
  }

  useEffect(() => {
    // Only initialize payment store when we're actually in the ending phase
    if (!hasInitialized && isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Initializing anonymous ID');
      initializeAnonymousId();
      setHasInitialized(true);
    }
  }, [hasInitialized, initializeAnonymousId, isEndingPhase]);

  useEffect(() => {
    // Only fetch credits when we're in the ending phase
    if (anonId && hasInitialized && isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Fetching credits for anonId:', anonId?.slice(-8));
      fetchCredits();
    }
  }, [anonId, hasInitialized, fetchCredits, isEndingPhase]);

  // Production debugging: Log payment store state changes - only when ending card is displayed

  useEffect(() => {
    // Only log debug info when we're actually at the ending card (where AIImageGenerator is shown)
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Payment store state (ending phase):', {
        anonId: anonId?.slice(-8),
        credits,
        isLoading,
        hasEmail: !!email,
        error: error || 'none',
        showPaywall,
        hasInitialized,
        waitingForCredit,
        timestamp: new Date().toISOString()
      });
    }
  }, [isEndingPhase, anonId, credits, isLoading, email, error, showPaywall, hasInitialized, waitingForCredit]);

  // Allow generation if credits available, but don't deduct yet.
  const handleGenerateImage = () => {
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - PaywallGate handleGenerateImage called:', {
        hasEmail: !!email,
        credits,
        requiresCredits,
        PAYWALL_VERSION,
        timestamp: new Date().toISOString()
      });
    }

    // In production mode, enforce paywall logic
    if (PAYWALL_VERSION === 'prod') {
      // Require email first
      if (!email) {
        if (isEndingPhase) {
          console.warn('🔍 PAYWALL DEBUG - PROD: No email, showing paywall');
        }
        setShowPaywall(true);
        return false;
      }

      // If credits required and none available, show paywall
      if (requiresCredits && credits <= 0) {
        if (isEndingPhase) {
          console.warn('🔍 PAYWALL DEBUG - PROD: No credits, showing paywall');
        }
        setShowPaywall(true);
        return false;
      }
    }

    // If credits already known and >0 allow, else open paywall / checker
    if (!requiresCredits) {
      if (isEndingPhase) {
        console.warn('🔍 PAYWALL DEBUG - Credits not required, allowing generation');
      }
      return true;
    }

    if (credits > 0) {
      if (isEndingPhase) {
        console.warn('🔍 PAYWALL DEBUG - Credits available, allowing generation');
      }
      return true;
    }

    // Credits 0 → open paywall to let user check / donate
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - No credits, showing paywall');
    }
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
        if (isEndingPhase) {
          console.warn('🔍 PAYWALL DEBUG - Image generation result:', {
            success: result?.success,
            requiresCredits,
            timestamp: new Date().toISOString()
          });
        }
        
        if (result?.success && requiresCredits) {
          if (isEndingPhase) {
            console.warn('🔍 PAYWALL DEBUG - Consuming credit');
          }
          const succeeded = await consumeCredit();
          if (isEndingPhase) {
            console.warn('🔍 PAYWALL DEBUG - Credit consumption result:', succeeded);
          }
          if (succeeded) onCreditConsumed?.();
        }
        originalOnImageGenerated?.(result);
      },
    };
  };

  const handlePaywallClose = () => {
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Paywall closed, refreshing credits');
    }
    setShowPaywall(false);
    resetError();
    // Refresh credits after potential payment
    if (anonId) {
      const prev = credits;
      setWaitingForCredit(true);

      let canceled = false;

      const poll = async (attempt = 0) => {
        if (canceled) return;
        if (isEndingPhase) {
          console.warn('🔍 PAYWALL DEBUG - Polling for credit update, attempt:', attempt);
        }
        await fetchCredits();
        const newCredits = usePaymentStore.getState().credits;
        if (isEndingPhase) {
          console.warn('🔍 PAYWALL DEBUG - Poll result:', { prev, newCredits, attempt });
        }
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
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Showing loading state');
    }
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
    if (isEndingPhase) {
      console.warn('🔍 PAYWALL DEBUG - Showing error state:', error);
    }
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
      
      if (isEndingPhase) {
        console.warn('🔍 PAYWALL DEBUG - Checking child component:', {
          componentName,
          hasGameState: !!hasGameState,
          hasEndingSummary: !!hasEndingSummary
        });
      }
      
      // Check for AIImageGenerator by component name OR by having both gameState and endingSummary props
      if (componentName === 'AIImageGenerator' || (hasGameState && hasEndingSummary)) {
        if (isEndingPhase) {
          console.warn('🔍 PAYWALL DEBUG - Enhancing AIImageGenerator with paywall props');
        }
        return React.cloneElement(child as React.ReactElement<any>, {
          ...createEnhancedProps(child.props),
          isCheckingCredits: waitingForCredit && credits === 0,
        });
      }
    }
    return child;
  });

  if (isEndingPhase) {
    console.warn('🔍 PAYWALL DEBUG - Rendering PaywallGate with:', {
      showPaywall,
      showTestMode: PAYWALL_VERSION === 'test',
      credits,
      timestamp: new Date().toISOString()
    });
  }

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
import React, { useEffect, useState, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckCircle, ArrowBack } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePaymentStore } from '../../stores/usePaymentStore';

interface EmbeddedCheckoutProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  childName: string;
}

const CheckoutContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 500,
  margin: '0 auto',
  padding: theme.spacing(2),
}));

const SuccessContainer = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4),
  backgroundColor: 'rgba(76, 175, 80, 0.1)',
  borderRadius: theme.spacing(2),
  border: '2px solid rgba(76, 175, 80, 0.3)',
}));

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Stripe allows only ONE Embedded Checkout per page. React StrictMode double-invokes effects in dev,
// which can accidentally create two instances and trigger the "multiple Embedded Checkout objects" error.
// We store the singleton in a module-level variable so subsequent mounts reuse the instance instead of
// creating a new one.
// eslint-disable-next-line @typescript-eslint/naming-convention
let _embeddedInstance: any | null = null;
let _embeddedClientSecret: string | null = null;
let _embeddedInitPromise: Promise<any> | null = null;

export const EmbeddedCheckout: React.FC<EmbeddedCheckoutProps> = ({
  clientSecret,
  onSuccess,
  onCancel,
  childName
}) => {
  const { i18n } = useTranslation();
  const { fetchCredits } = usePaymentStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [checkoutElement, setCheckoutElement] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const checkoutId = useRef(`embedded-checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initializeCheckout = async () => {
      try {
        const stripe = await stripePromise;
        if (!stripe) throw new Error('Stripe failed to load');

        // CASE 1: already initialised and for same session → reuse
        if (_embeddedInstance && _embeddedClientSecret === clientSecret) {
          // Reuse existing instance for same session. Mount will happen in later effect.
          setCheckoutElement(_embeddedInstance);
          setIsLoading(false);
          return;
        }

        // CASE 2: initialisation for DIFFERENT session is in progress → wait, then unmount and recreate
        if (_embeddedInitPromise) {
          try {
            await _embeddedInitPromise; // wait until done
          } catch (_) {/* ignore */}

          // After waiting, if instance now exists and matches secret, reuse it
          if (_embeddedInstance && _embeddedClientSecret === clientSecret) {
            setCheckoutElement(_embeddedInstance);
            setIsLoading(false);
            return;
          }

          // If instance exists for DIFFERENT session, unmount it
          if (_embeddedInstance) {
            try { _embeddedInstance.unmount(); } catch (_) {/* ignore */}
            _embeddedInstance = null;
            _embeddedClientSecret = null;
          }
        }

        // Start a new initialisation and store the promise before awaiting (prevents duplicate calls)
        _embeddedClientSecret = clientSecret;
        _embeddedInitPromise = stripe.initEmbeddedCheckout({ 
          clientSecret,
          onComplete: async () => {
            await fetchCredits();
            setIsComplete(true);
            // destroy instance after complete so new checkout can be created next time
            try { _embeddedInstance?.destroy?.(); } catch (_) {/* ignore */}
            _embeddedInstance = null;
            _embeddedClientSecret = null;
            _embeddedInitPromise = null;
            // wait a bit then close dialog
            setTimeout(onSuccess, 1500);
          }
        });
        _embeddedInstance = await _embeddedInitPromise;
        _embeddedInitPromise = null;

        // Defer mounting until container is in DOM
        setCheckoutElement(_embeddedInstance);
        setIsLoading(false);

        cleanup = () => {
          try {
            _embeddedInstance?.destroy?.();
          } catch (_) {/* ignore */}
          _embeddedInstance = null;
          _embeddedClientSecret = null;
          _embeddedInitPromise = null;
        };
      } catch (err) {
        console.error('Checkout initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize checkout');
        setIsLoading(false);
      }
    };

    if (clientSecret) {
      initializeCheckout();
    }

    // Cleanup function
    return () => {
      if (cleanup) cleanup();
    };
  }, [clientSecret]);

  // Mount the checkout once the container div exists in the DOM
  useEffect(() => {
    if (!isLoading && checkoutElement && containerRef.current) {
      try {
        // Ensure not already mounted somewhere else
        checkoutElement.unmount?.();
      } catch (_) {}

      try {
        checkoutElement.mount(containerRef.current);
      } catch (err) {
        console.error('Stripe mount error:', err);
      }
    }
  }, [isLoading, checkoutElement, containerRef]);

  const handleBack = () => {
    if (checkoutElement) {
      try { checkoutElement.destroy?.(); } catch (_) {}
    }
    _embeddedInstance = null;
    _embeddedClientSecret = null;
    _embeddedInitPromise = null;
    onCancel();
  };

  // Listen for Stripe postMessage signalling completion
  useEffect(() => {
    const listener = (ev: MessageEvent) => {
      if (typeof ev.data !== 'object' || !ev.data) return;
      if (ev.origin.startsWith('https://checkout.stripe.com') && ev.data.type === 'stripe-session' && ev.data.state === 'complete') {
        setIsComplete(true);
        // Wait a moment for webhook to land, then refresh credits and show complete
        setTimeout(async () => {
          await fetchCredits();
          setIsComplete(true);
          setTimeout(onSuccess, 1500);
        }, 1500);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [fetchCredits, onSuccess]);

  if (isComplete) {
    return (
      <CheckoutContainer>
        <SuccessContainer>
          <CheckCircle 
            sx={{ 
              fontSize: 60, 
              color: '#4CAF50', 
              mb: 2 
            }} 
          />
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            {i18n.language === 'zh' ? '支付成功！' : 'Payment Successful!'}
          </Typography>
          


          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            {i18n.language === 'zh'
              ? `您现在可以为 ${childName} 生成AI照片了！`
              : `You can now generate AI photos of ${childName}!`
            }
          </Typography>

          <Button
            variant="contained"
            onClick={onSuccess}
            sx={{
              background: 'linear-gradient(45deg, #4CAF50 30%, #388E3C 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #388E3C 30%, #2E7D32 90%)',
              },
              borderRadius: 3,
              px: 4,
              py: 1.5,
            }}
          >
            {i18n.language === 'zh' ? '生成照片' : 'Generate Photo'}
          </Button>
        </SuccessContainer>
      </CheckoutContainer>
    );
  }

  if (error) {
    return (
      <CheckoutContainer>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={handleBack} startIcon={<ArrowBack />}>
          {i18n.language === 'zh' ? '返回' : 'Go Back'}
        </Button>
      </CheckoutContainer>
    );
  }

  if (isLoading) {
    return (
      <CheckoutContainer>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={40} sx={{ color: '#8D6E63', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            {i18n.language === 'zh' ? '加载支付表单...' : 'Loading payment form...'}
          </Typography>
        </Box>
      </CheckoutContainer>
    );
  }

  return (
    <CheckoutContainer>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Button 
          onClick={handleBack} 
          startIcon={<ArrowBack />}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          {i18n.language === 'zh' ? '返回' : 'Back'}
        </Button>
      </Box>
      
      <Typography variant="h6" sx={{ mb: 3, textAlign: 'center' }}>
        {i18n.language === 'zh' 
          ? `支持宝宝模拟器，为 ${childName} 生成照片` 
          : `Support the Baby Simulator and see ${childName} in a photo`
        }
      </Typography>
      <div ref={containerRef} id={checkoutId.current} style={{ width: '100%' }}></div>
    </CheckoutContainer>
  );
};
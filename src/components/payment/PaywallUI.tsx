import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Slider,
  Box,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Favorite, CreditCard } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePaymentStore } from '../../stores/usePaymentStore';
import { calculatePricing } from '../../services/paymentService';
import { EmbeddedCheckout } from './EmbeddedCheckout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface PaywallUIProps {
  open: boolean;
  onClose: () => void;
  childName: string;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.spacing(2),
    maxWidth: 500,
    width: '90%',
  },
}));

const PriceDisplay = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(2),
  backgroundColor: 'rgba(139, 69, 19, 0.1)',
  borderRadius: theme.spacing(1),
  margin: theme.spacing(2, 0),
}));

const DonationSlider = styled(Slider)(() => ({
  color: '#8D6E63',
  '& .MuiSlider-thumb': {
    backgroundColor: '#5D4037',
  },
  '& .MuiSlider-track': {
    backgroundColor: '#8D6E63',
  },
  '& .MuiSlider-rail': {
    backgroundColor: 'rgba(139, 69, 19, 0.3)',
  },
}));

export const PaywallUI: React.FC<PaywallUIProps> = ({ open, onClose, childName }) => {
  const { t, i18n } = useTranslation();
  const { createCheckoutSession, isLoading, error, resetError, setEmail, fetchCredits } = usePaymentStore();
  const [donatedUnits, setDonatedUnits] = useState(1);
  const [email, setEmailState] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // References for popup handling
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | null>(null);

  const currency = i18n.language === 'zh' ? 'RMB' : 'USD';
  const pricing = calculatePricing(donatedUnits, currency);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowEmbeddedCheckout(false);
      setClientSecret(null);
      setDonatedUnits(1);
      setEmailState('');
      setEmailError('');
      resetError();
    }
  }, [open, resetError]);

  const validateEmail = (input: string) => {
    if (!input) {
      setEmailError(t('paywall.emailRequired'));
      return false;
    }
    // Basic email format check
    if (!/^\S+@\S+\.\S+$/.test(input)) {
      setEmailError(t('paywall.emailInvalid'));
      return false;
    }
    setEmailError('');
    return true;
  };

  const handlePayment = async () => {
    if (!validateEmail(email)) return;
    resetError();
    
    try {
      const useEmbedded = currency === 'USD';

      const result = await createCheckoutSession({
        email: email.trim() || undefined,
        lang: i18n.language,
        donatedUnits,
        embedded: useEmbedded,
      });

      if (result.success) {
        if (useEmbedded && result.clientSecret) {
          // USD flow – open embedded Checkout
          setEmail(email.trim());
          setClientSecret(result.clientSecret);
          setShowEmbeddedCheckout(true);
        } else if (!useEmbedded && result.url) {
          // Redirect flow (e.g., WeChat Pay) – open in popup to preserve SPA state
          const width = 500;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;

          popupRef.current = window.open(
            result.url,
            'stripeCheckout',
            `popup=yes,width=${width},height=${height},left=${left},top=${top}`
          );

          if (popupRef.current) {
            // Poll for closure
            intervalRef.current = window.setInterval(async () => {
              if (popupRef.current && popupRef.current.closed) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.current = null;
                popupRef.current = null;
                // Refresh credits and close dialog
                await fetchCredits(email.trim());
                onClose();
              }
            }, 1000);
          } else {
            // Popup blocked – fallback to full redirect
            window.location.href = result.url;
          }
        } else {
          throw new Error(result.error || 'Failed to create checkout session');
        }
      } else {
        throw new Error(result.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Payment error:', err);
    }
  };

  const handleCheckoutSuccess = () => {
    setShowEmbeddedCheckout(false);
    setClientSecret(null);
    onClose();
  };

  const handleCheckoutCancel = () => {
    setShowEmbeddedCheckout(false);
    setClientSecret(null);
    // Reset form state
    setDonatedUnits(1);
    setEmailState('');
    setEmailError('');
    resetError();
  };

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    setDonatedUnits(Array.isArray(newValue) ? newValue[0] : newValue);
  };

  const formatPrice = (amount: number) => {
    if (currency === 'USD') {
      return `$${amount.toFixed(2)}`;
    } else {
      return `¥${amount.toFixed(0)}`;
    }
  };

  const handleCheckCredits = async () => {
    if (!validateEmail(email)) return;
    const trimmedEmail = email.trim();
            if (import.meta.env.DEV) {
          console.log('🔍 PaywallUI: Checking credits for email:', trimmedEmail);
        }
    setEmail(trimmedEmail);
    setCheckingCredits(true);
    setCheckMessage(null);
    try {
      // Pass the email directly to ensure it's used for the lookup
                if (import.meta.env.DEV) {
            console.log('🔍 PaywallUI: Calling fetchCredits with email:', trimmedEmail);
          }
      await fetchCredits(trimmedEmail);
      const c = usePaymentStore.getState().credits;
                if (import.meta.env.DEV) {
            console.log('🔍 PaywallUI: Credits result:', c);
          }
      if (c > 0) {
        setCheckMessage(t('paywall.creditsFound', { count: c }));
        // auto-close after brief delay
        setTimeout(() => {
          setCheckingCredits(false);
          onClose();
        }, 1500);
      } else {
        setCheckMessage(t('paywall.noCreditsFound'));
      }
    } catch (err) {
              if (import.meta.env.DEV) {
          console.error('🔍 PaywallUI: Credit check failed:', err);
        } else {
          console.error('Credit check failed:', err);
        }
      setCheckMessage(t('paywall.checkCreditsFailed'));
    } finally {
      setCheckingCredits(false);
    }
  };

  // Cleanup interval on unmount/dialog close
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth={showEmbeddedCheckout ? "md" : "sm"}>
      {showEmbeddedCheckout && clientSecret ? (
        <EmbeddedCheckout
          clientSecret={clientSecret}
          onSuccess={handleCheckoutSuccess}
          onCancel={handleCheckoutCancel}
          childName={childName}
        />
      ) : (
        <>
          <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
            <Favorite sx={{ color: '#8D6E63', mr: 1, verticalAlign: 'middle' }} />
            {t('paywall.title', { childName })}
          </DialogTitle>
          
          <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          {t('paywall.subtitle')}
        </Typography>

        {/* Email Input */}
        <TextField
          fullWidth
          required
          label={t('paywall.email')}
          placeholder={t('paywall.emailReceiptCopy')}
          type="email"
          value={email}
          onChange={(e) => setEmailState(e.target.value)}
          onBlur={(e) => validateEmail(e.target.value)}
          error={!!emailError}
          helperText={emailError}
          sx={{ mb: 2 }}
        />

        {/* Check Credits Button */}
        <Button variant="outlined" fullWidth onClick={handleCheckCredits} disabled={checkingCredits || !!emailError || !email} sx={{ mb: 2 }}>
          {t('paywall.checkCredits')}
        </Button>

        {checkMessage && (
          <Alert severity="info" sx={{ mb:2 }} icon={<CheckCircleIcon />}>
            {checkMessage}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            {t('paywall.donationAmount')}
          </Typography>
          
          <DonationSlider
            value={donatedUnits}
            onChange={handleSliderChange}
            min={1}
            max={10}
            step={1}
            marks={[
              { value: 1, label: '1x' },
              { value: 5, label: '5x' },
              { value: 10, label: '10x' },
            ]}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />
        </Box>

        {/* Donation UI */}

        <PriceDisplay>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
            {formatPrice(pricing.totalAmount)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('paywall.getCredits', { count: pricing.totalCredits })}
          </Typography>
        </PriceDisplay>

        <Divider sx={{ my: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          {t('paywall.paymentSecure')}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('paywall.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handlePayment}
          disabled={isLoading || !!emailError || !email}
          startIcon={isLoading ? <CircularProgress size={20} /> : <CreditCard />}
          sx={{
            background: 'linear-gradient(45deg, #8D6E63 30%, #5D4037 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5D4037 30%, #3E2723 90%)',
            },
          }}
        >
          {isLoading 
            ? t('paywall.processing')
            : t('paywall.continueAndPay')
          }
        </Button>
          </DialogActions>
        </>
      )}
    </StyledDialog>
  );
}; 
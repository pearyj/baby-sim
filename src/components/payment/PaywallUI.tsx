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
import { isMobileDevice } from '../../utils/deviceDetection';
import { isApplePaySupported } from '../../utils/deviceDetection';

interface PaywallUIProps {
  open: boolean;
  onClose: () => void;
  childName: string;
  mode?: 'llm' | 'image' | 'support';
  onCreditsGained?: (newCredits: number, prevCredits?: number) => void;
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

const PAYWALL_VERSION = import.meta.env.VITE_PAYWALL_VERSION || 'test';

export const PaywallUI: React.FC<PaywallUIProps> = ({ open, onClose, childName, mode = 'image', onCreditsGained }) => {
  const { t, i18n } = useTranslation();
  const { createCheckoutSession, isLoading, error, resetError, setEmail, fetchCredits } = usePaymentStore();
  const [donatedUnits, setDonatedUnits] = useState(i18n.language === 'zh' ? 3 : 1);
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
      setDonatedUnits(i18n.language === 'zh' ? 3 : 1);
      setEmailState('');
      setEmailError('');
      resetError();
    }
  }, [open, resetError, i18n.language]);

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
    
    const trimmedEmail = email.trim();

    // Ensure email is recorded in subscribers table before payment flow starts
    if (!hasSubscribed) {
      await subscribeEmail(trimmedEmail);
      setHasSubscribed(true);
    }

    try {
      const useEmbedded = currency === 'USD';
      const isMobile = isMobileDevice();

      const result = await createCheckoutSession({
        email: trimmedEmail || undefined,
        lang: i18n.language,
        donatedUnits,
        embedded: useEmbedded,
        isMobile,
        isAppleDevice: isApplePaySupported(),
      });

      if (result.success) {
        if (useEmbedded && result.clientSecret) {
          // USD flow – open embedded Checkout
          setEmail(trimmedEmail);
          setClientSecret(result.clientSecret);
          setShowEmbeddedCheckout(true);
        } else if (!useEmbedded && result.url) {
          // Redirect flow (e.g., Alipay, Apple Pay) – open in popup to preserve SPA state
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
                const prevCredits = usePaymentStore.getState().credits ?? 0;
                await fetchCredits(trimmedEmail);
                const newCredits = usePaymentStore.getState().credits ?? 0;
                if (typeof onCreditsGained === 'function' && newCredits > prevCredits) {
                  onCreditsGained(newCredits, prevCredits);
                }
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

  const handleCheckoutSuccess = async () => {
    // After embedded checkout completes, refresh credits first
    try {
      const trimmedEmail = email.trim();
      const prevCredits = usePaymentStore.getState().credits ?? 0;
      if (trimmedEmail) {
        await fetchCredits(trimmedEmail);
      } else {
        await fetchCredits();
      }
      const newCredits = usePaymentStore.getState().credits ?? 0;
      if (typeof onCreditsGained === 'function' && newCredits > prevCredits) {
        onCreditsGained(newCredits, prevCredits);
      }
    } catch (err) {
      // Non-fatal – if it fails, the PaywallGate will attempt its own refresh logic
      if (import.meta.env.DEV) {
        console.warn('fetchCredits after embedded checkout failed:', err);
      }
    }

    setShowEmbeddedCheckout(false);
    setClientSecret(null);
    onClose();
  };

  const handleCheckoutCancel = () => {
    setShowEmbeddedCheckout(false);
    setClientSecret(null);
    // Reset form state
    setDonatedUnits(i18n.language === 'zh' ? 3 : 1);
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

  /**
   * Simple helper to send the email to the `/api/subscribe` endpoint so that it
   * is inserted into the `subscribers` table. We ignore any errors (e.g.
   * duplicates) because the user experience should not be affected if the email
   * already exists.
   */
  const subscribeEmail = async (emailToSubscribe: string) => {
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSubscribe }),
      });
    } catch (e) {
      // Silently fail – subscribing is a best-effort side effect
      if (import.meta.env.DEV) {
        console.warn('Subscribe email failed (ignored):', e);
      }
    }
  };

  // Track if we've already attempted to subscribe during this dialog session
  const [hasSubscribed, setHasSubscribed] = useState(false);

  const handleCheckCredits = async () => {
    if (!validateEmail(email)) return;
    const trimmedEmail = email.trim();

    // Try to add the email to the subscribers table (one-time per dialog open)
    if (!hasSubscribed) {
      await subscribeEmail(trimmedEmail);
      setHasSubscribed(true);
    }

    setEmail(trimmedEmail);
    setCheckingCredits(true);
    setCheckMessage(null);
    try {
      // Pass the email directly to ensure it's used for the lookup
      const prevCredits = usePaymentStore.getState().credits ?? 0;
      await fetchCredits(trimmedEmail);
      const c = usePaymentStore.getState().credits;
      if (c > 0) {
        if (typeof onCreditsGained === 'function' && c > prevCredits) {
          onCreditsGained(c, prevCredits);
        }
        setCheckMessage(t(mode === 'llm' ? 'paywall.creditsFound_llm' : 'paywall.creditsFound', { count: c }));
        // auto-close after brief delay
        setTimeout(() => {
          setCheckingCredits(false);
          onClose();
        }, 1500);
      } else {
        setCheckMessage(t('paywall.noCreditsFound'));
      }
    } catch (err) {
      console.error('Credit check failed:', err);
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
            {t(
              mode === 'llm'
                ? 'paywall.title_llm'
                : mode === 'support'
                  ? 'paywall.title_support'
                  : 'paywall.title',
              { childName }
            )}
          </DialogTitle>
          
          <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          {t(mode === 'llm' ? 'paywall.subtitle_llm' : 'paywall.subtitle')}
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

        {/* Agreement line */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 2, display: 'block' }}
        >
          {t('paywall.emailAgreement')}
        </Typography>

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
            max={20}
            step={1}
            marks={[
              { value: 1, label: '1x' },
              { value: 5, label: '5x' },
              { value: 10, label: '10x' },
              { value: 15, label: '15x' },
              { value: 20, label: '20x' },
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            {i18n.language === 'zh'
              ? '高级 GPT‑5 模型有更高的 Token 成本，可能需要 VPN；同一套积分也可用于游戏结尾的图片生成。'
              : 'Premium GPT‑5 model has higher token cost and may require VPN; the same token credits can be used for the end-of-game image generation.'}
          </Typography>

        {/* Reminder for post-payment refresh issues */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          {t('paywall.postPaymentReminder')}
        </Typography>

        {/* GPT-5 access region reminder (LLM only) */}
        {mode === 'llm' && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {t('paywall.gpt5AccessWarning')}
            </Typography>
          </Alert>
        )}

        {/* Payment Test Notice – only show in test mode */}
        {PAYWALL_VERSION === 'test' && (
          <>
            {i18n.language === 'en' && (
              <Alert severity="warning" sx={{ mt: 2, mb: 0 }}>
                <Typography variant="body2" sx={{ color: 'red', fontWeight: 'bold' }}>
                  {t('paywall.paymenttestnotice')}
                </Typography>
              </Alert>
            )}
            {i18n.language === 'zh' && (
              <Alert severity="warning" sx={{ mt: 2, mb: 0 }}>
                <Typography variant="body2" sx={{ color: 'red', fontWeight: 'bold' }}>
                  {t('paywall.paymenttestnotice')}
                </Typography>
              </Alert>
            )}
          </>
        )}
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
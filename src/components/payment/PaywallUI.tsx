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
  IconButton,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Favorite, CreditCard, Shield } from '@mui/icons-material';
import Close from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { usePaymentStore } from '../../stores/usePaymentStore';
import { calculatePricing } from '../../services/paymentService';
import { EmbeddedCheckout } from './EmbeddedCheckout';
import { EmailVerificationDialog } from '../EmailVerificationDialog';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { isMobileDevice } from '../../utils/deviceDetection';
import { isApplePaySupported } from '../../utils/deviceDetection';
import { isEmailWhitelisted } from '../../constants/emailWhitelist';

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
  const [donatedUnits, setDonatedUnits] = useState(i18n.language === 'zh' ? 1 : 1);
  const [email, setEmailState] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verificationEnabled, setVerificationEnabled] = useState(true); // 邮箱验证功能是否启用
  const [bypassVerification, setBypassVerification] = useState(false);

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
      setDonatedUnits(i18n.language === 'zh' ? 1 : 1);
      setEmailState('');
      setEmailError('');
      setShowVerificationDialog(false);
      setEmailVerified(false);
      setVerifiedEmail('');
      setVerificationEnabled(true);
      resetError();
    }
  }, [open, resetError, i18n.language]);

  // Check email verification status when email changes
  useEffect(() => {
    const checkEmailVerification = async () => {
      if (email && /^\S+@\S+\.\S+$/.test(email)) {
        // 本地白名单：在白名单内直接视为已验证并关闭弹窗
        const whitelisted = isEmailWhitelisted(email);
        if (whitelisted) {
          setVerificationEnabled(true);
          setBypassVerification(true);
          setEmailVerified(true);
          setVerifiedEmail(email);
          setShowVerificationDialog(false);
          return;
        }
        try {
          const response = await fetch(`/api/check-email-verification?email=${encodeURIComponent(email)}`);
          const data = await response.json();
          const verificationNotEnabled = data.reason === 'verification_not_enabled';
          const verificationBypassed = data.verificationBypassed === true;
          const verified = data.verified === true || verificationBypassed;
          setVerificationEnabled(!verificationNotEnabled);
          setBypassVerification(verificationBypassed);
          setEmailVerified(verified);
          setVerifiedEmail(verified ? email : '');
          if (verified) {
            setShowVerificationDialog(false);
          }
        } catch (error) {
          console.error('Failed to check email verification:', error);
          setVerificationEnabled(true);
          setBypassVerification(false);
          setEmailVerified(false);
          setVerifiedEmail('');
        }
      } else {
        setVerificationEnabled(true);
        setBypassVerification(false);
        setEmailVerified(false);
        setVerifiedEmail('');
      }
    };

    checkEmailVerification();
  }, [email]);

  // 当邮箱验证状态变为已验证且与当前输入邮箱匹配时，自动关闭验证码弹窗
  useEffect(() => {
    const normalizedInput = email.trim().toLowerCase();
    const normalizedVerified = verifiedEmail.trim().toLowerCase();
    if (emailVerified && normalizedVerified && normalizedVerified === normalizedInput) {
      
      setShowVerificationDialog(false);
    }
  }, [emailVerified, email, verifiedEmail]);

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

  // 当验证码刚刚通过时，使用一次性绕过标记以避免同一渲染周期内的竞态导致再次弹窗
  const justVerifiedEmailRef = useRef<string | null>(null);

  const handleEmailVerified = async (verifiedEmailAddress: string) => {
    // 标记本次已通过验证的邮箱，避免同一tick内重复打开验证弹窗
    justVerifiedEmailRef.current = verifiedEmailAddress;
    setEmailState(verifiedEmailAddress);
    setShowVerificationDialog(false);
    // 在查询积分前增加loading与短暂延时，确保状态同步
    setCheckingCredits(true);
    try {
      const response = await fetch(`/api/check-email-verification?email=${encodeURIComponent(verifiedEmailAddress)}`);
      const data = await response.json();
      const verificationNotEnabled = data.reason === 'verification_not_enabled';
      const verificationBypassed = data.verificationBypassed === true;
      const verified = data.verified === true || verificationBypassed;
      setVerificationEnabled(!verificationNotEnabled);
      setBypassVerification(verificationBypassed);
      setEmailVerified(verified);
      setVerifiedEmail(verified ? verifiedEmailAddress : '');
    } catch (error) {
      console.error('Failed to re-check email verification after verification:', error);
      setEmailVerified(false);
      setVerifiedEmail('');
      setBypassVerification(false);
    }
    // 等待几秒以避免 requireEmailVerification 读取旧状态
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await handleCheckCredits(verifiedEmailAddress);
  };

  const requireEmailVerification = (inputEmail?: string) => {
    const candidate = (inputEmail ?? email).trim();
    if (!validateEmail(candidate)) return false;

    // 刚刚完成验证的邮箱，在当前渲染周期内允许直接通过，避免竞态条件
    const normalizedCandidate = candidate.toLowerCase();
    const normalizedJustVerified = (justVerifiedEmailRef.current ?? '').trim().toLowerCase();
    if (normalizedJustVerified && normalizedJustVerified === normalizedCandidate) {
      return true;
    }

    // 本地白名单直接通过
    if (isEmailWhitelisted(candidate)) {
      return true;
    }

    const candidateNormalized = candidate.toLowerCase();
    const verifiedMatches = emailVerified && verifiedEmail.trim().toLowerCase() === candidateNormalized;

    // 统一依据后端状态：验证未启用、已验证、或被绕过，均无需弹窗
    if (!verificationEnabled || verifiedMatches || bypassVerification) {
      return true;
    }

    // 需要进行邮箱验证时，打开弹窗
    setShowVerificationDialog(true);
    return false;
  };

  const handlePayment = async () => {
    if (!requireEmailVerification()) return;
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
                await fetchCredits(trimmedEmail, true); // 强制刷新积分
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
        await fetchCredits(trimmedEmail, true); // 强制刷新积分
      } else {
        await fetchCredits(undefined, true); // 强制刷新积分
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
    setDonatedUnits(i18n.language === 'zh' ? 1 : 1);
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
      // 保留一位小数以正确显示9.9元等价格
      return `¥${amount.toFixed(1)}`;
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

  const handleCheckCredits = async (emailOverride?: string) => {
    // Guard against accidental event objects from onClick; only accept string overrides
    const raw = typeof emailOverride === 'string' ? emailOverride : email;
    const effectiveEmail = (raw ?? '').toString().trim();
    if (!requireEmailVerification(effectiveEmail)) return;
    const trimmedEmail = effectiveEmail;

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
      await fetchCredits(trimmedEmail, true); // 强制刷新积分
      const c = usePaymentStore.getState().credits;
      if (c > 0) {
        if (typeof onCreditsGained === 'function' && c > prevCredits) {
          onCreditsGained(c, prevCredits);
        }
        setCheckMessage(t(mode === 'llm' ? 'paywall.creditsFound_llm' : 'paywall.creditsFound', { count: c }));
        // auto-close after brief delay - 可以注释掉以禁用自动关闭
        // setTimeout(() => {
        //   setCheckingCredits(false);
        //   onClose();
        // }, 1500);
      } else {
        setCheckMessage(t('paywall.noCreditsFound'));
      }
    } catch (err) {
      console.error('Credit check failed:', err);
      setCheckMessage(t('paywall.checkCreditsFailed'));
    } finally {
      setCheckingCredits(false);
      // 清除一次性绕过标记
      justVerifiedEmailRef.current = null;
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
      {/* Top-right close button */}
      <IconButton
        aria-label={i18n.language === 'zh' ? '关闭' : 'Close'}
        onClick={onClose}
        disabled={isLoading}
        sx={{ position: 'absolute', right: 8, top: 8 }}
      >
        <Close />
      </IconButton>
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
          InputProps={{
            endAdornment: (verificationEnabled && emailVerified) ? (
              <Shield sx={{ color: 'green', fontSize: 20 }} titleAccess={t('emailVerification.verified')} />
            ) : null
          }}
          sx={{
            mb: 2,
            // 保持所有状态下白色背景与黑色文字（含输入后、聚焦、悬停、自动填充）
            '& .MuiInputBase-root': {
              backgroundColor: 'white',
            },
            '& .MuiInputBase-root.Mui-focused': {
              backgroundColor: 'white',
            },
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'white',
            },
            '& .MuiInputBase-input': {
              color: 'black',
            },
            '& .MuiOutlinedInput-input': {
              color: 'black',
            },
            '& input:-webkit-autofill': {
              WebkitBoxShadow: '0 0 0 1000px white inset',
              WebkitTextFillColor: '#000',
            },
          }}
        />

        {(verificationEnabled && emailVerified) && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ✓ {t('emailVerification.emailVerifiedMessage', { email: verifiedEmail })}
            </Typography>
          </Alert>
        )}

        {/* Agreement line */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 2, display: 'block' }}
        >
          {t('paywall.emailAgreement')}
        </Typography>

        {/* Check Credits Button */}
        <Button variant="outlined" fullWidth onClick={() => handleCheckCredits()} disabled={checkingCredits || !!emailError || !email} sx={{ mb: 2 }}>
          {t('paywall.checkCredits')}
        </Button>

        {checkingCredits && (
          <Alert severity="info" sx={{ mb:2 }} icon={<CircularProgress size={20} />}>
            <Typography variant="body2">
              {t('paywall.checkingCreditsProgress')}
            </Typography>
          </Alert>
        )}

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
            {t('paywall.getCredits', { count: pricing.totalCredits })}｜ {t('paywall.imageCreditUnitHint')}
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
          disabled={isLoading || !!emailError || !email || (verificationEnabled && !emailVerified && !bypassVerification && !isEmailWhitelisted(email))}
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

      {/* Email Verification Dialog */}
      <EmailVerificationDialog
        open={showVerificationDialog}
        onClose={() => setShowVerificationDialog(false)}
        onVerified={handleEmailVerified}
        initialEmail={email}
        bypassed={bypassVerification}
      />
    </StyledDialog>
  );
};

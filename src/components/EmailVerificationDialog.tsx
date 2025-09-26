import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { Email as EmailIcon, Verified as VerifiedIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface EmailVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: (email: string) => void;
  initialEmail?: string;
}

export const EmailVerificationDialog: React.FC<EmailVerificationDialogProps> = ({
  open,
  onClose,
  onVerified,
  initialEmail = ''
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setStep('email');
      setEmail(initialEmail);
      setCode('');
      setEmailError('');
      setCodeError('');
      setMessage('');
      setResendCooldown(0);
    }
  }, [open, initialEmail]);

  // 倒计时
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const validateEmail = (input: string) => {
    if (!input) {
      setEmailError(t('paywall.emailRequired'));
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(input)) {
      setEmailError(t('paywall.emailInvalid'));
      return false;
    }
    setEmailError('');
    return true;
  };

  const validateCode = (input: string) => {
    if (!input) {
      setCodeError(t('emailVerification.codeRequired'));
      return false;
    }
    if (!/^\d{6}$/.test(input)) {
      setCodeError(t('emailVerification.codeInvalid'));
      return false;
    }
    setCodeError('');
    return true;
  };

  const sendVerificationCode = async () => {
    if (!validateEmail(email)) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStep('code');
        setMessage(t('emailVerification.codeSent'));
        setResendCooldown(60); // 60秒倒计时
      } else {
        setMessage(getErrorMessage(data.error) || t('emailVerification.sendFailed'));
      }
    } catch (error) {
      console.error('Send verification code failed:', error);
      setMessage(t('emailVerification.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!validateCode(code)) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/verify-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(t('emailVerification.verifySuccess'));
        setTimeout(() => {
          onVerified(email);
          onClose();
        }, 1000);
      } else {
        setCodeError(getErrorMessage(data.error) || t('emailVerification.verifyFailed'));
      }
    } catch (error) {
      console.error('Verify code failed:', error);
      setCodeError(t('emailVerification.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string) => {
    const errorMap: Record<string, string> = {
      'email_required': t('paywall.emailRequired'),
      'email_invalid': t('paywall.emailInvalid'),
      'code_required': t('emailVerification.codeRequired'),
      'code_invalid_format': t('emailVerification.codeInvalid'),
      'code_invalid_or_expired': t('emailVerification.codeExpired'),
      'email_send_failed': t('emailVerification.sendFailed'),
      'rate_limited': t('emailVerification.rateLimited'),
    };
    return errorMap[errorCode] || errorCode;
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    setCodeError('');
    setMessage('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <EmailIcon sx={{ color: '#8D6E63', mr: 1, verticalAlign: 'middle' }} />
        {t('emailVerification.title')}
      </DialogTitle>

      <DialogContent>
        {step === 'email' && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              {t('emailVerification.subtitle')}
            </Typography>

            <TextField
              fullWidth
              required
              label={t('paywall.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => validateEmail(e.target.value)}
              error={!!emailError}
              helperText={emailError}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  backgroundColor: 'white'
                }
              }}
            />
          </>
        )}

        {step === 'code' && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              {t('emailVerification.codeSubtitle', { email })}
            </Typography>

            <TextField
              fullWidth
              required
              label={t('emailVerification.verificationCode')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onBlur={(e) => validateCode(e.target.value)}
              error={!!codeError}
              helperText={codeError}
              inputProps={{
                maxLength: 6,
                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }
              }}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  backgroundColor: 'white'
                }
              }}
            />

            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Button
                variant="text"
                onClick={sendVerificationCode}
                disabled={resendCooldown > 0 || loading}
                size="small"
              >
                {resendCooldown > 0
                  ? t('emailVerification.resendIn', { seconds: resendCooldown })
                  : t('emailVerification.resendCode')
                }
              </Button>
            </Box>
          </>
        )}

        {message && (
          <Alert 
            severity={
              // 成功状态：验证码发送成功或验证成功
              message === t('emailVerification.codeSent') || 
              message === t('emailVerification.verifySuccess')
                ? 'success'
                // 错误状态：包含失败、错误等关键词
                : message === t('emailVerification.sendFailed') ||
                  message.includes('失败') || 
                  message.includes('错误') ||
                  message.includes('过期') ||
                  message.includes('无效')
                  ? 'error'
                  // 默认信息状态
                  : 'info'
            } 
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          {t('emailVerification.securityNotice')}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {step === 'code' && (
          <Button onClick={handleBack} disabled={loading}>
            {t('common.back')}
          </Button>
        )}
        <Button onClick={onClose} disabled={loading}>
          {t('paywall.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={step === 'email' ? sendVerificationCode : verifyCode}
          disabled={loading || (step === 'email' && (!email || !!emailError)) || (step === 'code' && (!code || !!codeError))}
          startIcon={loading ? <CircularProgress size={20} /> : <VerifiedIcon />}
          sx={{
            background: 'linear-gradient(45deg, #8D6E63 30%, #5D4037 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5D4037 30%, #3E2723 90%)',
            },
          }}
        >
          {loading
            ? t('common.processing')
            : step === 'email'
              ? t('emailVerification.sendCode')
              : t('emailVerification.verify')
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};
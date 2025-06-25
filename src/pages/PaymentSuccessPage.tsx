import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckCircle, Home } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePaymentStore } from '../stores/usePaymentStore';
import { updateSessionFlags, logEvent } from '../services/eventLogger';

const SuccessContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)',
  padding: theme.spacing(2),
}));

const SuccessCard = styled(Card)(({ theme }) => ({
  maxWidth: 500,
  width: '100%',
  textAlign: 'center',
  borderRadius: theme.spacing(3),
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}));

export const PaymentSuccessPage: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { anonId, kidId, fetchCredits, credits, isLoading, error } = usePaymentStore();
  const [hasVerified, setHasVerified] = useState(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId && !hasVerified) {
      // Wait a moment for webhook to process, then fetch updated credits
      setTimeout(() => {
        fetchCredits();
        setHasVerified(true);
      }, 2000);
    }
  }, [sessionId, hasVerified, fetchCredits]);

  // After verification and displaying success, auto-close popup if this window was opened by the main app
  useEffect(() => {
    if (hasVerified && !isLoading) {
      const timer = setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [hasVerified, isLoading]);

  // Once verified and not loading, mark checkout completed (idempotent)
  useEffect(() => {
    if (hasVerified && !isLoading && anonId && kidId) {
      updateSessionFlags(anonId, kidId, { checkoutCompleted: true });
      logEvent(anonId, kidId, 'checkout_completed', { sessionId });
    }
  }, [hasVerified, isLoading, anonId, kidId, sessionId]);

  const handleGoHome = () => {
    navigate('/');
  };

  if (!sessionId) {
    return (
      <SuccessContainer>
        <SuccessCard>
          <CardContent sx={{ p: 4 }}>
            <Alert severity="error">
              {i18n.language === 'zh' 
                ? '无效的支付会话'
                : 'Invalid payment session'
              }
            </Alert>
            <Button 
              onClick={handleGoHome} 
              sx={{ mt: 2 }}
              startIcon={<Home />}
            >
              {i18n.language === 'zh' ? '返回首页' : 'Go Home'}
            </Button>
          </CardContent>
        </SuccessCard>
      </SuccessContainer>
    );
  }

  return (
    <SuccessContainer>
      <SuccessCard>
        <CardContent sx={{ p: 4 }}>
          {isLoading && !hasVerified ? (
            <>
              <CircularProgress 
                size={60} 
                sx={{ color: '#8D6E63', mb: 3 }} 
              />
              <Typography variant="h6" sx={{ mb: 2 }}>
                {i18n.language === 'zh' 
                  ? '正在确认您的支付...'
                  : 'Confirming your payment...'
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {i18n.language === 'zh'
                  ? '请稍候，我们正在处理您的积分'
                  : 'Please wait while we process your credits'
                }
              </Typography>
            </>
          ) : (
            <>
              <CheckCircle 
                sx={{ 
                  fontSize: 80, 
                  color: '#4CAF50', 
                  mb: 2 
                }} 
              />
              <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                {i18n.language === 'zh' ? '感谢您的支持！' : 'Thank you for your support!'}
              </Typography>
              
              <Typography variant="h6" sx={{ mb: 3, color: '#8D6E63' }}>
                {i18n.language === 'zh' 
                  ? `您现在拥有 ${credits} 个积分`
                  : `You now have ${credits} credit${credits !== 1 ? 's' : ''}`
                }
              </Typography>

              <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                {i18n.language === 'zh'
                  ? '您可以使用积分来生成AI照片，记录您的育儿之旅。'
                  : 'You can use your credits to generate AI photos and capture your parenting journey.'
                }
              </Typography>

              {error && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  {i18n.language === 'zh'
                    ? '积分更新可能需要几分钟时间'
                    : 'Credit updates may take a few minutes'
                  }
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                onClick={handleGoHome}
                startIcon={<Home />}
                sx={{
                  background: 'linear-gradient(45deg, #8D6E63 30%, #5D4037 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #5D4037 30%, #3E2723 90%)',
                  },
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                }}
              >
                {i18n.language === 'zh' ? '继续我的育儿之旅' : 'Continue My Parenting Journey'}
              </Button>
            </>
          )}
        </CardContent>
      </SuccessCard>
    </SuccessContainer>
  );
}; 
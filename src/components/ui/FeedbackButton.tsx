import React, { useCallback, useState } from 'react';
import InfoIcon from '@mui/icons-material/Info';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePaymentStore } from '../../stores/usePaymentStore';
import { PaywallUI } from '../../components/payment/PaywallUI';
import { useTranslation } from 'react-i18next';
import useGameStore from '../../stores/useGameStore';

export const FeedbackButton: React.FC = () => {
  const isDevelopment = import.meta.env.DEV;
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { email, credits, isLoading, fetchCredits, initializeAnonymousId, anonId } = usePaymentStore((state) => ({
    email: state.email,
    credits: state.credits,
    isLoading: state.isLoading,
    fetchCredits: state.fetchCredits,
    initializeAnonymousId: state.initializeAnonymousId,
    anonId: state.anonId,
  }));

  const childName = useGameStore((state) => state.child?.name || t('game.childName'));

  const [showPaywall, setShowPaywall] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [checkingCredits, setCheckingCredits] = useState(false);

  const ensureSetup = useCallback(() => {
    try {
      if (!anonId && typeof initializeAnonymousId === 'function') {
        initializeAnonymousId();
      }
    } catch (_) {}
  }, [anonId, initializeAnonymousId]);

  const handlePaywallClick = useCallback(async () => {
    ensureSetup();
    if (!email || (typeof credits === 'number' && credits <= 0)) {
      setShowPaywall(true);
      return;
    }
    // Do NOT auto-refresh here; only open dialog. User can press Refresh.
    setShowCreditsDialog(true);
  }, [email, credits, ensureSetup, fetchCredits]);

  return (
    <div className={`floating-container ${isDevelopment ? 'dev-mode' : ''}`}>
      {/* Pay / Credits Button */}
      <button
        onClick={handlePaywallClick}
        className="floating-btn pay-btn"
        title={email ? (t('paywall.checkCredits') || 'Credits & Support') : (t('paywall.continueAndPay') || 'Donate / Add Credits')}
        aria-label="Open Paywall or Show Credits"
      >
        <AttachMoneyIcon sx={{ color: 'white', width: 24, height: 24 }} />
      </button>

      {/* Info Button */}
      <button
        onClick={() => navigate('/info')}
        className="floating-btn info-btn"
        title="Information Center"
        aria-label="Open Information Center"
      >
        <InfoIcon sx={{ color: 'white', width: 24, height: 24 }} />
      </button>

      {/* Email Button */}
      <a
        href="mailto:dev@babysim.fun"
        className="floating-btn feedback-btn"
        title="Send Feedback"
        aria-label="Send Feedback via Email"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
        >
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v 2z"/>
        </svg>
      </a>

      {/* Credits Info Dialog */}
      <Dialog open={showCreditsDialog} onClose={() => setShowCreditsDialog(false)}>
        <DialogTitle>{credits > 0 ? (t('messages.thankYouSupport') || 'Thank you for your support!') : (t('paywall.checkCredits') || 'Credits & Support')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 280 }}>
            {checkingCredits || isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">{t('actions.loading') || 'Loading...'}</Typography>
              </Box>
            ) : (
              <>
                {email && (
                  <Typography variant="body2" color="text.secondary">{`${t('paywall.email')}: ${email}`}</Typography>
                )}
                <Box sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'rgba(139, 69, 19, 0.08)'
                }}>
                  <Typography variant="overline" color="text.secondary">
                    {t('paywall.creditsLabel') || 'Credits'}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {credits ?? 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('messages.creditsUsageShort') || 'Use credits for premium GPT‑5 and image generation.'}
                  </Typography>
                </Box>
                {childName && (
                  <Typography variant="caption" color="text.secondary">
                    {t('messages.useCreditsHint', { childName }) || `Tip: You can use credits to generate the ending image for ${childName}.`}
                  </Typography>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { setCheckingCredits(true); try { await fetchCredits(); } catch (_) {} finally { setCheckingCredits(false); } }}>
            {t('actions.refresh') || 'Refresh'}
          </Button>
          <Button onClick={() => setShowCreditsDialog(false)}>{t('paywall.cancel') || 'Close'}</Button>
          <Button variant="contained" onClick={() => { setShowCreditsDialog(false); setShowPaywall(true); }}>
            {(credits && credits > 0) ? (t('paywall.supportMore') || 'Support More') : (t('paywall.continueAndPay') || 'Add Credits')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Paywall Modal */}
      {showPaywall && (
        <PaywallUI
          open={showPaywall}
          onClose={() => setShowPaywall(false)}
          childName={childName}
          mode={'support'}
        />
      )}
    </div>
  );
};
import React, { useState } from 'react';
import {
  Typography,
  Box,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Container,
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import GavelIcon from '@mui/icons-material/Gavel';
import WarningIcon from '@mui/icons-material/Warning';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useNavigate } from 'react-router-dom';

const SectionIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: 0,
}));

const PlaceholderContent = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1),
  backgroundColor: theme.palette.grey[50],
  border: `1px dashed ${theme.palette.grey[300]}`,
  textAlign: 'center',
  margin: theme.spacing(0.5, 0),
}));

export const InfoPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async () => {
    setError('');
    if (!email) {
      setError(t('info.subscribeEmailRequired'));
      return;
    }
    // Add email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('info.subscribeInvalidEmail'));
      return;
    }
    if (!agreed) {
      setError(t('info.subscribeMustAgree'));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const { error: serverError } = await response.json();
        throw new Error(serverError || 'unknown');
      }
      
      // Handle both new subscription and already subscribed cases silently
      setSuccess(true);
      setEmail('');
    } catch (e: any) {
      console.error('Subscription error:', e);
      setError(t('info.subscribeError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ 
          fontWeight: 600,
          mb: 3,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {t('info.title')}
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        {/* Subscribe Section */}
        <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: 'white' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', width: '100%', maxWidth: 420, mb: 1 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('info.subscribePlaceholder')}
                style={{ 
                  flex: 1, 
                  padding: '10px 14px', 
                  borderRadius: 8, 
                  border: '1px solid #ccc', 
                  fontSize: 16,
                  backgroundColor: '#fff8e1',
                  color: '#000',
                }}
                disabled={submitting || success}
              />
              <Button
                variant="contained"
                color="primary"
                sx={{ ml: 1, minWidth: 120, fontWeight: 600 }}
                onClick={handleSubscribe}
                disabled={submitting || success}
              >
                {success ? t('info.subscribeSuccess') : t('info.subscribeButton')}
              </Button>
            </Box>
            <Box sx={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                id="subscribe-agree"
                disabled={submitting || success}
                style={{ 
                  marginRight: 8,
                  backgroundColor: '#fff8e1',
                  accentColor: '#1976d2',
                }}
              />
              <label htmlFor="subscribe-agree" style={{ fontSize: 13, color: '#666', cursor: 'pointer' }}>
                {t('info.subscribeAgreement', {
                  privacy: `<a href='#privacy-header' style='color:#1976d2;text-decoration:underline;'>${t('info.privacyPolicy')}</a>`,
                  terms: `<a href='#terms-header' style='color:#1976d2;text-decoration:underline;'>${t('info.termsOfService')}</a>`
                })}
              </label>
            </Box>
            {error && <Typography color="error" variant="caption" sx={{ mt: 0.5 }}>{error}</Typography>}
            {success && <Typography color="success.main" variant="caption" sx={{ mt: 0.5 }}>{t('info.subscribeThanks')}</Typography>}
          </Box>
        </Paper>

        {/* Words from developers Section */}
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="developers-content"
            id="developers-header"
            sx={{ py: 0.5 }}
          >
            <SectionIcon>
              <FavoriteIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('info.wordsFromDevelopers')}
              </Typography>
            </SectionIcon>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1 }}>
            <Box sx={{ pt: 0, px: 2, pb: 1 }}>
              <Typography 
                variant="body2" 
                color="text.primary"
                sx={{ whiteSpace: 'pre-line', textAlign: 'left', lineHeight: 1.6 }}
              >
                {t('info.wordsFromDevelopersContent')}
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 1 }} />

        {/* Privacy Policy Section */}
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="privacy-content"
            id="privacy-header"
            sx={{ py: 0.5 }}
          >
            <SectionIcon>
              <PrivacyTipIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('info.privacyPolicy')}
              </Typography>
            </SectionIcon>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1 }}>
            <PlaceholderContent>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}
              >
                {t('info.privacyContent')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('info.privacyDescription')}
              </Typography>
            </PlaceholderContent>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 1 }} />

        {/* Terms of Service Section */}
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="terms-content"
            id="terms-header"
            sx={{ py: 0.5 }}
          >
            <SectionIcon>
              <GavelIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('info.termsOfService')}
              </Typography>
            </SectionIcon>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1 }}>
            <PlaceholderContent>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}
              >
                {t('info.termsContent')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('info.termsDescription')}
              </Typography>
            </PlaceholderContent>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 1 }} />

        {/* Disclaimer Section */}
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="disclaimer-content"
            id="disclaimer-header"
            sx={{ py: 0.5 }}
          >
            <SectionIcon>
              <WarningIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('info.disclaimer')}
              </Typography>
            </SectionIcon>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1 }}>
            <PlaceholderContent>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}
              >
                {t('info.disclaimerContent')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('info.disclaimerDescription')}
              </Typography>
            </PlaceholderContent>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          onClick={() => navigate('/')}
          variant="contained"
          color="primary"
          sx={{ minWidth: 100 }}
        >
          {t('info.close')}
        </Button>
      </Box>
    </Container>
  );
}; 
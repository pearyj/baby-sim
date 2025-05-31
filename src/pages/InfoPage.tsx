import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  IconButton,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import GavelIcon from '@mui/icons-material/Gavel';
import WarningIcon from '@mui/icons-material/Warning';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { supabase } from '../lib/supabase';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    maxWidth: '800px',
    width: '90%',
    maxHeight: '90vh',
    borderRadius: theme.spacing(2),
    boxShadow: theme.shadows[3],
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(2, 3),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}));

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

interface InfoPageProps {
  open: boolean;
  onClose: () => void;
}

export const InfoPage: React.FC<InfoPageProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Add effect to handle focus management
  useEffect(() => {
    if (open) {
      // Store the last focused element
      const lastActiveElement = document.activeElement;
      
      // Return cleanup function
      return () => {
        // Restore focus when dialog closes
        if (lastActiveElement instanceof HTMLElement) {
          lastActiveElement.focus();
        }
      };
    }
  }, [open]);

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
      const { error: supabaseError } = await supabase.from('subscribers').insert([{ email }]);
      if (supabaseError) throw supabaseError;
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
    <StyledDialog
      open={open}
      onClose={onClose}
      scroll="paper"
      aria-labelledby="info-dialog-title"
      PaperProps={{
        elevation: 3,
        sx: {
          boxShadow: (theme) => theme.shadows[3],
        },
      }}
    >
      <StyledDialogTitle id="info-dialog-title">
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          {t('info.title')}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: 'inherit',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent sx={{ padding: 0 }}>
        <Box sx={{ p: 2 }}>
          {/* Subscribe Section */}
          <Paper elevation={1} sx={{ p: 2, mb: 2, borderRadius: 2, backgroundColor: 'white' }}>
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
                    backgroundColor: '#fff8e1', // Light yellow background
                    color: '#000', // Ensure text is black for readability
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
                    backgroundColor: '#fff8e1', // Light yellow background
                    accentColor: '#1976d2', // Use primary color for the checkbox when checked
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
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="primary"
          sx={{ minWidth: 100 }}
        >
          {t('info.close')}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
}; 
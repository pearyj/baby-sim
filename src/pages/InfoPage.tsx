import React from 'react';
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

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    maxWidth: '800px',
    width: '90%',
    maxHeight: '90vh',
    borderRadius: theme.spacing(2),
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
  marginBottom: theme.spacing(1),
}));

const PlaceholderContent = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.grey[50],
  border: `1px dashed ${theme.palette.grey[300]}`,
  textAlign: 'center',
  margin: theme.spacing(1, 0),
}));

interface InfoPageProps {
  open: boolean;
  onClose: () => void;
}

export const InfoPage: React.FC<InfoPageProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  
  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      scroll="paper"
      aria-labelledby="info-dialog-title"
    >
      <StyledDialogTitle id="info-dialog-title">
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
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
          {/* Privacy Policy Section */}
          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="privacy-content"
              id="privacy-header"
            >
              <SectionIcon>
                <PrivacyTipIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('info.privacyPolicy')}
                </Typography>
              </SectionIcon>
            </AccordionSummary>
            <AccordionDetails>
              <PlaceholderContent>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}
                >
                  {t('info.privacyContent')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {t('info.privacyDescription')}
                </Typography>
              </PlaceholderContent>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          {/* Terms of Service Section */}
          <Accordion>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="terms-content"
              id="terms-header"
            >
              <SectionIcon>
                <GavelIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('info.termsOfService')}
                </Typography>
              </SectionIcon>
            </AccordionSummary>
            <AccordionDetails>
              <PlaceholderContent>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}
                >
                  {t('info.termsContent')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {t('info.termsDescription')}
                </Typography>
              </PlaceholderContent>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          {/* Disclaimer Section */}
          <Accordion>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="disclaimer-content"
              id="disclaimer-header"
            >
              <SectionIcon>
                <WarningIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('info.disclaimer')}
                </Typography>
              </SectionIcon>
            </AccordionSummary>
            <AccordionDetails>
              <PlaceholderContent>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}
                >
                  {t('info.disclaimerContent')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
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
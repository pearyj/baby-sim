import React, { useRef, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Download, Share } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

interface ShareableEndingCardProps {
  childName: string;
  endingSummaryText: string;
  playerDescription?: string;
  childDescription?: string;
}

const ShareableCard = styled(Card)(({ theme }) => ({
  background: `url('${window.location.origin}/endingbkgd.png')`,
  backgroundSize: 'cover',
  backgroundPosition: 'bottom center',
  backgroundRepeat: 'no-repeat',
  position: 'relative',
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  color: '#5D4037',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '600px',
  },
  '& .MuiTypography-root:not(.MuiChip-label)': {
    color: '#5D4037',
  },
  '& .MuiChip-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
}));

const ActionButtonsContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  right: theme.spacing(2),
  display: 'flex',
  gap: theme.spacing(1),
  zIndex: 10,
}));

const ActionButton = styled(IconButton)(() => ({
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    transform: 'scale(1.1)',
  },
  transition: 'all 0.2s ease-in-out',
}));

const PromotionText = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  marginTop: theme.spacing(3),
  padding: theme.spacing(2),
  backgroundColor: 'rgba(255, 255, 255, 0.5)',
  borderRadius: theme.spacing(1),
  fontWeight: 600,
  fontSize: '1.1rem',
  color: '#5D4037',
  border: `2px solid rgba(139, 69, 19, 0.6)`,
  backdropFilter: 'blur(10px)',
}));

export const ShareableEndingCard: React.FC<ShareableEndingCardProps> = ({
  childName,
  endingSummaryText,
  playerDescription,
  childDescription,
}) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      setSnackbar({
        open: true,
        message: t('messages.downloadingImage'),
        severity: 'success',
      });

      // Hide the action buttons and chip temporarily for the screenshot
      const actionButtons = cardRef.current.querySelector('[data-action-buttons]') as HTMLElement;
      const hideInExportElements = cardRef.current.querySelectorAll('.hide-in-export') as NodeListOf<HTMLElement>;
      const showInExportElements = cardRef.current.querySelectorAll('.show-in-export-only') as NodeListOf<HTMLElement>;
      
      if (actionButtons) {
        actionButtons.style.display = 'none';
      }
      hideInExportElements.forEach(element => {
        element.style.display = 'none';
      });
      showInExportElements.forEach(element => {
        element.style.display = 'block';
      });

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
        onclone: (clonedDoc) => {
          // Ensure background image loads in cloned document
          const clonedCard = clonedDoc.querySelector('[data-card-ref]') as HTMLElement;
          if (clonedCard) {
            clonedCard.style.backgroundImage = `url('${window.location.origin}/endingbkgd.png')`;
          }
        },
      });

      // Show the action buttons and chip again
      if (actionButtons) {
        actionButtons.style.display = 'flex';
      }
      hideInExportElements.forEach(element => {
        element.style.display = 'block';
      });
      showInExportElements.forEach(element => {
        element.style.display = 'none';
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = `${childName}-parenting-journey-${new Date().getTime()}.png`;
          saveAs(blob, fileName);
          setSnackbar({
            open: true,
            message: t('messages.downloadComplete'),
            severity: 'success',
          });
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error downloading image:', error);
      setSnackbar({
        open: true,
        message: t('messages.downloadError'),
        severity: 'error',
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('messages.journeyComplete'),
          text: t('messages.childGrownUp', { childName }),
          url: 'https://babysim.fun',
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText('https://babysim.fun');
        setSnackbar({
          open: true,
          message: 'Link copied to clipboard!',
          severity: 'success',
        });
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <ShareableCard ref={cardRef} elevation={3} data-card-ref="true">
        <ActionButtonsContainer data-action-buttons>
          <Tooltip title="Download as Image">
            <ActionButton onClick={handleDownload} size="small">
              <Download />
            </ActionButton>
          </Tooltip>
          <Tooltip title="Share">
            <ActionButton onClick={handleShare} size="small">
              <Share />
            </ActionButton>
          </Tooltip>
        </ActionButtonsContainer>

        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ 
            textAlign: 'center', 
            mb: 3, 
            fontWeight: 600,
            color: '#5D4037',
            textShadow: '0px 2px 4px rgba(255, 255, 255, 0.8)',
          }}>
            {t('messages.journeyComplete')}
          </Typography>
          
          <Box sx={{ textAlign: 'center', mb: 3 }} className="hide-in-export">
            <Chip 
              label={t('messages.childGrownUp', { childName })}
              color="primary"
              variant="outlined"
              sx={{ fontSize: '1rem', py: 1 }}
            />
          </Box>
          
          {/* Background Information */}
          {(playerDescription || childDescription) && (
            <Box sx={{ mb: 4, p: 3, backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: 2, backdropFilter: 'blur(10px)' }}>
              {playerDescription && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1" sx={{ 
                    lineHeight: 1.7,
                    color: '#5D4037',
                    textAlign: 'left'
                  }}>
                    {playerDescription}
                  </Typography>
                </Box>
              )}
              
              {childDescription && (
                <Box>
                  <Typography variant="body1" sx={{ 
                    lineHeight: 1.7,
                    color: '#5D4037',
                    textAlign: 'left'
                  }}>
                    {childDescription}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
          <Box sx={{ 
            mb: 4, 
            p: 3, 
            backgroundColor: 'rgba(255, 255, 255, 0.5)', 
            borderRadius: 2, 
            backdropFilter: 'blur(10px)',
            '& *': {
              color: '#5D4037 !important',
              textAlign: 'left !important',
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              color: '#5D4037 !important',
              marginTop: '1rem',
              marginBottom: '0.5rem',
              textAlign: 'left !important',
            },
            '& p': {
              color: '#5D4037 !important',
              marginBottom: '1rem',
              textAlign: 'left !important',
            },
            '& strong': {
              color: '#3E2723 !important',
              fontWeight: 'bold',
            },
            '& em': {
              color: '#5D4037 !important',
              fontStyle: 'italic',
            },
          }}>
            <Typography variant="body1" component="div" sx={{ lineHeight: 1.7, color: '#5D4037', textAlign: 'left' }}>
              <ReactMarkdown>{endingSummaryText || t('messages.endingComplete')}</ReactMarkdown>
            </Typography>
          </Box>

          <PromotionText className="show-in-export-only" sx={{ display: 'none' }}>
            {t('messages.sharePromotionText')}
          </PromotionText>
        </CardContent>
      </ShareableCard>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}; 
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
import { track } from '@vercel/analytics';
import { AIImageGenerator } from './AIImageGenerator';
import { PaywallGate } from './payment/PaywallGate';
import type { GameState } from '../types/game';
import type { ImageGenerationResult } from '../services/imageGenerationService';
import { saveEndingCard } from '../services/endingCardStorage';

interface ShareableEndingCardProps {
  childName: string;
  endingSummaryText: string;
  playerDescription?: string;
  childDescription?: string;
  gameState?: GameState; // Optional: for AI image generation
}

// Utility function to remove story_style comments from display text
const cleanEndingSummaryForDisplay = (text: string): string => {
  return text.replace(/<!--\s*story_style:\s*[^>]+?-->/gi, '').trim();
};

const ShareableCard = styled(Card)(({ theme }) => ({
  background: `url('${window.location.origin}/endingbkgd.png')`,
  backgroundSize: 'cover',
  backgroundPosition: 'bottom center',
  backgroundRepeat: 'no-repeat',
  position: 'relative',
  maxWidth: '2000px', // Base width for mobile
  width: '100%',
  margin: '0 auto',
  color: '#5D4037',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '600px', // Original width on larger screens
  },
  '& .MuiTypography-root:not(.MuiChip-label)': {
    color: '#5D4037',
  },
  '& .MuiChip-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  // Adjust text container width based on language
  '& .MuiCardContent-root': {
    '& > div': {
      maxWidth: '100%',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
    },
    '& p': {
      maxWidth: '100%',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
    }
  }
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
  gameState,
}) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [generatedImageResult, setGeneratedImageResult] = useState<ImageGenerationResult | null>(null);
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

      // === NEW: Temporarily enlarge the card so the exported image is wider ===
      const ORIGINAL_STYLES = {
        width: cardRef.current.style.width,
        maxWidth: cardRef.current.style.maxWidth,
      } as const;

      // We aim for ~3× the typical mobile width (≈360px → 1080px)
      const EXPORT_WIDTH_PX = 1080;
      cardRef.current.style.width = `${EXPORT_WIDTH_PX}px`;
      cardRef.current.style.maxWidth = `${EXPORT_WIDTH_PX}px`;

      // Force a reflow so the browser recognises the new size before snapshot
      await new Promise((r) => requestAnimationFrame(r));
      // === END NEW ===

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

      // === NEW: Restore original card sizing after snapshot ===
      cardRef.current.style.width = ORIGINAL_STYLES.width;
      cardRef.current.style.maxWidth = ORIGINAL_STYLES.maxWidth;
      // === END NEW ===

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
          track('Ending Image Saved')
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
          title: t('share.title', { childName }),
          text: t('share.text', { childName }),
          url: 'https://babysim.fun', // Provide explicit URL to enable rich preview
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        const shareText = t('share.text', { childName });
        await navigator.clipboard.writeText(shareText);
        setSnackbar({
          open: true,
          message: t('share.linkCopied'),
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

  const handleImageGenerated = (imageResult: ImageGenerationResult) => {
    if (imageResult.success) {
      setGeneratedImageResult(imageResult);
      setSnackbar({
        open: true,
        message: t('messages.imageGenerated'),
        severity: 'success',
      });

      // Fire-and-forget upload to Supabase – do not block UI.
      (async () => {
        try {
          await saveEndingCard({
            endingSummaryMarkdown: endingSummaryText,
            imageBase64: imageResult.imageBase64,
            imageUrl: imageResult.imageUrl,
            shareOk: false,
          });
        } catch (err) {
          console.error('Failed to save ending card to Supabase', err);
        }
      })();
    }
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
              <ReactMarkdown>{cleanEndingSummaryForDisplay(endingSummaryText || t('messages.endingComplete'))}</ReactMarkdown>
            </Typography>
          </Box>

          {/* Generated AI Image - Show in both view and export if available */}
          {generatedImageResult && generatedImageResult.success && (
            <Box sx={{ 
              mb: 4, 
              textAlign: 'center',
              p: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.3)', 
              borderRadius: 2, 
              backdropFilter: 'blur(10px)',
            }}>
              <Box sx={{
                display: 'inline-block',
                maxWidth: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              }}>
                <img 
                  src={generatedImageResult.imageUrl || (generatedImageResult.imageBase64 ? `data:image/png;base64,${generatedImageResult.imageBase64}` : '')}
                  alt={`AI generated image for ${childName}'s parenting journey`}
                  style={{
                    display: 'block',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '400px',
                  }}
                />
              </Box>
              
              {/* Helper text for downloading - only show on website, not in export */}
              <Typography 
                variant="caption" 
                className="hide-in-export"
                sx={{ 
                  display: 'block',
                  mt: 1,
                  color: '#8D6E63',
                  fontSize: '0.75rem',
                  fontStyle: 'italic',
                  opacity: 0.8
                }}
              >
                {t('messages.imageDownloadHelper')}
              </Typography>
            </Box>
          )}

          {/* AI Image Generator with Paywall wrapper */}
          {gameState && (
            <PaywallGate childName={childName} onCreditConsumed={() => { /* optional: could show message */ }}>
              <AIImageGenerator
                gameState={gameState}
                endingSummary={endingSummaryText}
                onImageGenerated={handleImageGenerated}
                className="hide-in-export"
              />
            </PaywallGate>
          )}

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
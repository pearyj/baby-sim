import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CameraAlt, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { generateEndingImage } from '../services/imageGenerationService';
import type { GameState } from '../types/game';
import type { ImageGenerationResult } from '../services/imageGenerationService';
import useGameStore from '../stores/useGameStore';
import { PaywallGate } from './payment/PaywallGate';
import { usePaymentStatus } from '../hooks/usePaymentStatus';

interface AgeImagePromptProps {
  gameState: GameState;
  currentAge: number;
  onImageGenerated?: (imageResult: ImageGenerationResult) => void;
  onDismiss?: () => void;
}

const PromptCard = styled(Card)(({ theme }) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1300,
  maxWidth: '400px',
  width: '90%',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  boxShadow: theme.shadows[10],
  borderRadius: theme.spacing(2),
}));

const Overlay = styled(Box)(() => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 1299,
}));

const GeneratedImage = styled('img')(({ theme }) => ({
  width: '100%',
  maxWidth: '300px',
  height: 'auto',
  borderRadius: theme.spacing(1),
  marginTop: theme.spacing(2),
}));

export const AgeImagePrompt: React.FC<AgeImagePromptProps> = ({
  gameState,
  currentAge,
  onImageGenerated,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<ImageGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const setShouldGenerateImage = useGameStore(state => state.shouldGenerateImage);
  const { hasPaid, isLoading } = usePaymentStatus();

  const handleGenerateImage = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Create a prompt for the specific age
      const agePrompt = `${gameState.childDescription} at age ${currentAge}. ${gameState.endingSummaryText || ''}`;
      
      // Get outcome from history for current age as aiGeneratedText
      const currentAgeOutcome = gameState.history.find(entry => entry.age === currentAge)?.outcome;
      
      const result = await generateEndingImage(
        gameState,
        agePrompt,
        {
          customArtStyle: `Age ${currentAge} milestone portrait`,
          size: '768x768',
          quality: 'hd'
        },
        currentAgeOutcome // Use current age outcome as AI generated text
      );

      if (result.success) {
        setGeneratedImage(result);
        onImageGenerated?.(result);
      } else {
        setError(result.error || t('messages.imageGenerationFailed', {
          defaultValue: 'Failed to generate image'
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(t('messages.imageGenerationError', {
        error: errorMessage,
        defaultValue: `Error generating image: ${errorMessage}`
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDismiss = () => {
    // Reset the shouldGenerateImage flag in the store
    useGameStore.setState({ shouldGenerateImage: false });
    onDismiss?.();
  };

  const handleContinue = () => {
    handleDismiss();
  };

  const handleUnblurClick = () => {
    setShowPaywall(true);
  };

  const handlePaywallClose = () => {
    setShowPaywall(false);
  };

  return (
    <>
      <Overlay onClick={handleDismiss} />
      <PromptCard>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#5D4037' }}>
              {t('ui.ageImagePromptTitle', {
                age: currentAge -1,
                defaultValue: `${currentAge -1} Years Old!`
              })}
            </Typography>
            <Button
              size="small"
              onClick={handleDismiss}
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              <Close />
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
            {t('ui.ageImagePromptDescription', {
              age: currentAge - 1,
            })}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {generatedImage && generatedImage.success && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <GeneratedImage
                  src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                  alt={t('ui.generatedImageAlt', {
                    age: currentAge,
                    gender: gameState.child.gender,
                  })}
                  style={{ filter: hasPaid ? 'none' : 'blur(6px)' }}
                />
                {/* 模糊覆盖层 - 只在未付费时显示 */}
                {!hasPaid && !isLoading && (
                 <Box sx={{
                   position: 'absolute',
                   top: 0,
                   left: 0,
                   right: 0,
                   bottom: 0,
                   backgroundColor: 'rgba(0, 0, 0, 0.3)',
                   display: 'flex',
                   flexDirection: 'column',
                   alignItems: 'center',
                   justifyContent: 'center',
                   borderRadius: 1,
                   cursor: 'pointer',
                 }} onClick={handleUnblurClick}>
                   <Typography 
                     variant="caption" 
                     sx={{ 
                       color: 'white',
                       fontWeight: 600,
                       textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
                       textAlign: 'center',
                       px: 1,
                       mb: 1
                     }}
                   >
                     {t('messages.imageBlurredHint', { defaultValue: '图片已生成，付费后可查看清晰版本' })}
                   </Typography>
                   <Button 
                     variant="contained"
                     size="small"
                     sx={{
                       backgroundColor: 'rgba(255, 255, 255, 0.9)',
                       color: '#8D6E63',
                       '&:hover': {
                         backgroundColor: 'rgba(255, 255, 255, 1)',
                       },
                       fontSize: '0.75rem',
                       py: 0.5,
                       px: 1.5,
                     }}
                   >
                     {t('actions.unlock', { defaultValue: '解锁' })}
                   </Button>
                 </Box>
                )}
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
                {t('ui.imageGenerated', {
                  defaultValue: 'Image generated successfully!'
                })}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            {!generatedImage && (
              <Button
                variant="contained"
                onClick={handleGenerateImage}
                disabled={isGenerating}
                startIcon={isGenerating ? <CircularProgress size={20} /> : <CameraAlt />}
                sx={{
                  backgroundColor: '#8D6E63',
                  '&:hover': {
                    backgroundColor: '#6D4C41',
                  },
                }}
              >
                {isGenerating
                  ? t('actions.generating', { defaultValue: 'Generating...' })
                  : t('actions.generateImage', { defaultValue: 'Generate Image' })
                }
              </Button>
            )}
            
            <Button
              variant="outlined"
              onClick={generatedImage ? handleContinue : handleDismiss}
              sx={{
                borderColor: '#8D6E63',
                color: '#8D6E63',
                '&:hover': {
                  borderColor: '#6D4C41',
                  backgroundColor: 'rgba(141, 110, 99, 0.04)',
                },
              }}
            >
              {generatedImage
                ? t('actions.continue', { defaultValue: 'Continue' })
                : t('actions.skip', { defaultValue: 'Skip' })
              }
            </Button>
          </Box>
        </CardContent>
      </PromptCard>
      
      {showPaywall && (
        <PaywallGate 
          childName={gameState.child?.name || 'Child'}
          onCreditConsumed={() => {
            // 这里可以添加解锁成功后的逻辑
            setShowPaywall(false);
          }}
        >
          <div />
        </PaywallGate>
      )}
    </>
  );
};
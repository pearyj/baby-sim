import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CameraAlt, Close, LockOpen } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { generateEndingImage } from '../services/imageGenerationService';
import type { GameState } from '../types/game';
import type { ImageGenerationResult } from '../services/imageGenerationService';
import useGameStore from '../stores/useGameStore';
import { PaywallUI } from './payment/PaywallUI';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { RACE_GENDER_IMAGE_MAP } from '../constants/contants';
import { logEvent } from '../services/eventLogger';
import { usePaymentStore } from '../stores/usePaymentStore';

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

const BlurredImageContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  display: 'inline-block',
  borderRadius: theme.spacing(1),
  overflow: 'hidden',
}));

const BlurOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: theme.spacing(1),
  zIndex: 10,
}));

const UnlockButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#8D6E63',
  '&:hover': {
    backgroundColor: '#6D4C41',
  },
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
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showLastPhotoWarning, setShowLastPhotoWarning] = useState(false);
  const { hasPaid, isLoading, needsAgeCheck } = usePaymentStatus();
  const { anonId, kidId } = usePaymentStore(state => ({ anonId: state.anonId, kidId: state.kidId }));
  
  // Get the correct age from history instead of using currentAge which is already incremented
  const { history } = useGameStore();
  const history_curage = history && history.length ? history[history.length - 1].age : 0;
  console.log('AgeImagePrompt - currentAge:', currentAge, 'history_curage:', history_curage);
  console.log('AgeImagePrompt - hasPaid:', hasPaid, 'isLoading:', isLoading);

  // Generate default blurred image for all users based on child's race and gender
  const getDefaultImage = () => {
    const { race, gender } = gameState.child;
    console.log('getDefaultImage - race:', race, 'gender:', gender);
    console.log('RACE_GENDER_IMAGE_MAP:', RACE_GENDER_IMAGE_MAP);
    const raceMap = RACE_GENDER_IMAGE_MAP[race as keyof typeof RACE_GENDER_IMAGE_MAP];
    console.log('Race map for', race, ':', raceMap);
    const imageUrl = raceMap?.[gender as 'male' | 'female'];
    console.log('Image URL for', race, gender, ':', imageUrl);
    if (imageUrl) {
      return {
        success: true,
        imageUrl,
        isDefault: true
      } as ImageGenerationResult & { isDefault: boolean };
    }
    return null;
  };

  // Remove auto-generation - users must click to generate images

  const handleGenerateImage = async () => {
    console.log('handleGenerateImage called, history_curage:', history_curage);
    setIsGenerating(true);
    setError(null);

    try {
      if (history_curage === 3) {
        // For 3-year-olds, use default image based on race and gender (no credit consumption)
        console.log('Getting default image for race:', gameState.child.race, 'gender:', gameState.child.gender);
        const defaultImage = getDefaultImage();
        console.log('Default image result:', defaultImage);
        if (defaultImage) {
          console.log('Setting generated image:', defaultImage);
          setGeneratedImage(defaultImage);
          onImageGenerated?.(defaultImage);
          
          // Save the image to history for timeline display
          useGameStore.getState().addGeneratedImage(history_curage, defaultImage);
        } else {
          console.log('No default image found, setting error');
          setError(t('messages.imageGenerationFailed', {
            defaultValue: 'Failed to generate image'
          }));
        }
      } else {
        // For ages > 3, show paywall to handle credit consumption
        // This should not directly call the API, but go through PaywallGate
        setShowPaywall(true);
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
    // Show confirmation dialog when user tries to skip
    setShowSkipConfirm(true);
  };

  const handleConfirmSkip = async () => {
    // Log skip event for analytics
    if (anonId && kidId) {
      await logEvent(anonId, kidId, 'image_generation_skipped', {
        age: currentAge,
        childName: gameState.child.name,
        hasPaid
      });
    }
    
    // Call skipImageGeneration method
    const { skipImageGeneration } = useGameStore.getState();
    skipImageGeneration();
    
    // Reset the shouldGenerateImage flag in the store
    useGameStore.setState({ shouldGenerateImage: false });
    setShowSkipConfirm(false);
    onDismiss?.();
  };

  const handleCancelSkip = () => {
    setShowSkipConfirm(false);
  };

  const handleContinue = () => {
    // Reset the shouldGenerateImage flag in the store
    useGameStore.setState({ shouldGenerateImage: false });
    onDismiss?.();
  };



  return (
    <div className='age-image-prompt'>
      <Overlay onClick={handleDismiss} />
      <PromptCard>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#5D4037' }}>
              {t('ui.ageImagePromptTitle', {
                age: history_curage,
                defaultValue: `${history_curage} Years Old!`
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
              age: history_curage,
            })}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {generatedImage && generatedImage.success && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              {/* For 3-year-olds or paid users, show image without blur */}
              {(() => {
                // 只有付费用户才能看到清晰图片，所有未付费用户都显示蒙层
                const shouldShowClear = hasPaid;
                console.log('图片显示逻辑 - history_curage:', history_curage, 'hasPaid:', hasPaid, 'shouldShowClear:', shouldShowClear);
                return shouldShowClear;
              })() ? (
                <GeneratedImage
                  src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                  alt={t('ui.generatedImageAlt', {
                    age: history_curage,
                    gender: gameState.child.gender,
                  })}
                />
              ) : (
                /* For unpaid users over 3, show blurred image with unlock button */
                <BlurredImageContainer>
                  <GeneratedImage
                    src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                    alt={t('ui.generatedImageAlt', {
                      age: history_curage,
                      gender: gameState.child.gender,
                    })}
                    sx={{ filter: 'blur(8px)' }}
                  />
                  <BlurOverlay>
                    <UnlockButton
                      variant="contained"
                      startIcon={<LockOpen />}
                      onClick={() => {
                        console.log('解锁按钮被点击，显示付费弹窗');
                        setShowPaywall(true);
                      }}
                      size="small"
                    >
                      {t('actions.unlock', { defaultValue: 'Unlock' })}
                    </UnlockButton>
                  </BlurOverlay>
                </BlurredImageContainer>
              )}
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
                {t('ui.imageGenerated', {
                  defaultValue: 'Image generated successfully!'
                })}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              onClick={() => {
                 console.log('Generate button clicked, history_curage:', history_curage);
                 if (history_curage === 3) {
                   // For 3-year-olds, directly generate default image
                   console.log('Age is 3, calling handleGenerateImage');
                   handleGenerateImage();
                 } else {
                   // For ages > 3, check payment status before generating
                   console.log('Age > 3, hasPaid:', hasPaid, 'needsAgeCheck:', needsAgeCheck);
                   if (hasPaid) {
                     handleGenerateImage();
                   } else if (needsAgeCheck) {
                     // Check if current age is 18
                     if (history_curage === 18) {
                       // 18岁可以生成最后一张照片
                       handleGenerateImage();
                     } else {
                       // 不是18岁，显示警告弹窗
                       setShowLastPhotoWarning(true);
                     }
                   } else {
                     console.log('Setting showPaywall to true');
                     setShowPaywall(true);
                   }
                 }
               }}
              disabled={isGenerating || generatedImage !== null}
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
      
      {(() => {
         console.log('PaywallUI render check - showPaywall:', showPaywall);
         return (
           <PaywallUI 
             open={showPaywall}
             onClose={() => setShowPaywall(false)}
             childName={gameState.child?.name || 'Child'}
             mode="image"
             onCreditsGained={async () => {
               // 付费成功后自动生成图片
               console.log('PaywallUI onCreditsGained called');
               setShowPaywall(false);
               setIsGenerating(true);
               setError(null);
               
               try {
                 // For ages > 3, call the actual image generation API after payment
                 const result = await generateEndingImage(gameState, history_curage.toString());
                 if (result.success && result.imageUrl) {
                   setGeneratedImage(result);
                   onImageGenerated?.(result);
                 } else {
                   setError(t('messages.imageGenerationFailed', {
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
             }}
           />
         );
       })()}
      
      {/* Skip Confirmation Dialog */}
      <Dialog open={showSkipConfirm} onClose={handleCancelSkip}>
        <DialogTitle>
          {t('ui.skipConfirmTitle', {
            childName: gameState.child.name,
            defaultValue: `确定不想要见到${gameState.child.name}吗？`
          })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('ui.skipConfirmMessage', {
              childName: gameState.child.name,
              age: currentAge - 1,
              defaultValue: `跳过后将无法看到${gameState.child.name}在${currentAge - 1}岁时的照片。`
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSkip} color="primary">
            {t('actions.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleConfirmSkip} color="primary" variant="contained">
            {t('actions.confirmSkip', { defaultValue: '确定跳过' })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Last Photo Warning Dialog */}
      <Dialog open={showLastPhotoWarning} onClose={() => setShowLastPhotoWarning(false)}>
        <DialogTitle>
          最后一张照片提醒
        </DialogTitle>
        <DialogContent>
          <Typography>
            只剩一张照片了，建议留到18毕业的时候再拍！
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLastPhotoWarning(false)} color="primary">
            我知道了
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
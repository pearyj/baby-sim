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
  const [generatedImage, setGeneratedImage] = useState<(ImageGenerationResult & { isDefault?: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showLastPhotoWarning, setShowLastPhotoWarning] = useState(false);
  const { hasPaid, isLoading, needsAgeCheck } = usePaymentStatus();
  const { anonId, kidId } = usePaymentStore(state => ({ anonId: state.anonId, kidId: state.kidId }));
  const { credits, consumeCredit } = usePaymentStore(state => ({ credits: state.credits, consumeCredit: state.consumeCredit }));
  
  // Get the correct age from history instead of using currentAge which is already incremented
  const { history } = useGameStore();
  const history_curage = history && history.length ? history[history.length - 1].age : 0;
  console.log('AgeImagePrompt - currentAge:', currentAge, 'history_curage:', history_curage);
  console.log('AgeImagePrompt - hasPaid:', hasPaid, 'isLoading:', isLoading);

  // Get random default image from available images
  const getRandomDefaultImage = () => {
    const { race, gender } = gameState.child;
    console.log('getRandomDefaultImage - race:', race, 'gender:', gender);
    const raceMap = RACE_GENDER_IMAGE_MAP[race as keyof typeof RACE_GENDER_IMAGE_MAP];
    const imageUrls = raceMap?.[gender as 'male' | 'female'];
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      // Randomly select one image from the 8 available images
      const randomIndex = Math.floor(Math.random() * imageUrls.length);
      const selectedImageUrl = imageUrls[randomIndex];
      console.log('Randomly selected image:', selectedImageUrl, 'from index:', randomIndex);
      return {
        success: true,
        imageUrl: selectedImageUrl,
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
      // Check if this is the first time clicking
      if (!generatedImage) {
        // First time clicking - always show default image for ages <= 3
        if (history_curage <= 3) {
          // For ages 3 and under, show random default image with blur
          console.log('First time generation for age <= 3, randomly selecting image');
          const randomImage = getRandomDefaultImage();
          if (randomImage) {
            console.log('Setting generated blurred image:', randomImage);
            setGeneratedImage(randomImage);
            // DON'T call onImageGenerated here as it will close the component
            
            // Save the image to history for timeline display
            useGameStore.getState().addGeneratedImage(history_curage, randomImage);
          } else {
            console.log('No default images found, setting error');
            setError(t('messages.imageGenerationFailed', {
              defaultValue: 'Failed to generate image'
            }));
          }
        } else {
          // For ages > 3, need to check credits and potentially generate real image
          console.log('First time generation for age > 3, checking credits for real generation');
          setShowPaywall(true);
        }
      } else {
        // Not first time - user wants to generate a real image, need to check credits
        console.log('Subsequent generation, user wants real image - checking credits');
        // Always show paywall to check credits for real image generation
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
    // Log skip event for analytics to supabase
    if (anonId && kidId) {
      await logEvent(anonId, kidId, 'image_generation_skipped', {
        age: history_curage,
        childName: gameState.child.name,
        childGender: gameState.child.gender,
        childRace: gameState.child.race,
        hasPaid,
        skipReason: 'user_manual_skip',
        timestamp: new Date().toISOString()
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
    // Call onImageGenerated with the current image before dismissing
    if (generatedImage) {
      onImageGenerated?.(generatedImage);
    }
    // Reset the shouldGenerateImage flag in the store
    useGameStore.setState({ shouldGenerateImage: false });
    onDismiss?.();
  };

  const handleUnlockImage = async () => {
    console.log('解锁按钮被点击，检查余额和扣费');
    const UNLOCK_COST = 0.15;
    
    // Check if user has enough credits
    if (credits < UNLOCK_COST) {
      console.log('余额不足，显示充值弹窗', { credits, required: UNLOCK_COST });
      setShowPaywall(true);
      return;
    }
    
    try {
      // Consume 0.15 credits
      const success = await consumeCredit(undefined, UNLOCK_COST);
      if (success) {
        console.log('扣费成功，解锁图片');
        // Update the image to mark it as unlocked (remove isDefault flag)
        if (generatedImage) {
          setGeneratedImage({
            ...generatedImage,
            isDefault: false
          });
        }
      } else {
        console.log('扣费失败');
        setError(t('messages.unlockFailed', {
          defaultValue: '解锁失败，请重试'
        }));
      }
    } catch (err) {
      console.error('扣费过程中出错:', err);
      setError(t('messages.unlockError', {
        defaultValue: '解锁过程中出现错误'
      }));
    }
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
              {/* Check if this is a default image and if user has paid to unlock it */}
              {(() => {
                // For default images, show blurred version until user pays to unlock
                if (generatedImage.isDefault) {
                  // Check if user has enough credits to unlock (needs 0.15)
                  const hasEnoughCredits = credits >= 0.15;
                  console.log('图片显示逻辑 - credits:', credits, 'hasEnoughCredits:', hasEnoughCredits);
                  
                  // Always show blurred image for default images initially
                  return (
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
                          onClick={handleUnlockImage}
                          size="small"
                        >
                          {t('actions.unlock', { defaultValue: 'Unlock' })}
                        </UnlockButton>
                      </BlurOverlay>
                    </BlurredImageContainer>
                  );
                } else {
                  // For generated images (non-default), show clear image
                  return (
                    <GeneratedImage
                      src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                      alt={t('ui.generatedImageAlt', {
                        age: history_curage,
                        gender: gameState.child.gender,
                      })}
                    />
                  );
                }
              })()
              }
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
                 // Always call handleGenerateImage for first-time generation
                 handleGenerateImage();
               }}
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
                : gameState.child.gender === 'male' 
                  ? t('actions.wantToSeeHim', { defaultValue: '我想见他' })
                  : t('actions.wantToSeeHer', { defaultValue: '我想见她' })
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
                 // Call the actual image generation API after payment
                 const result = await generateEndingImage(gameState, history_curage.toString());
                 if (result.success && result.imageUrl) {
                   setGeneratedImage(result);
                   // DON'T call onImageGenerated here - let user click continue to dismiss
                   // onImageGenerated?.(result);
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
          {t('actions.skipConfirmTitle', {
            defaultValue: 'Skip Image Generation?'
          })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('actions.skipConfirmMessage', {
              defaultValue: "Are you sure you want to skip generating an image for this milestone? You won't be prompted again for future milestones."
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSkip} color="primary">
            {t('actions.skipConfirmCancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={handleConfirmSkip} color="primary" variant="contained">
            {t('actions.skipConfirmConfirm', { defaultValue: 'Skip All Future Images' })}
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
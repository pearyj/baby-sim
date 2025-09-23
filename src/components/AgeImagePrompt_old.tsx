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
  const [hasClickedGenerate, setHasClickedGenerate] = useState(false); // 记录是否点击过生成按钮
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
      } as ImageGenerationResult;
    }
    return null;
  };

  const handleGenerateImage = async () => {
    console.log('=== handleGenerateImage DEBUG ===');
    console.log('handleGenerateImage called, history_curage:', history_curage);
    console.log('hasClickedGenerate:', hasClickedGenerate);
    console.log('current credits:', credits);
    console.log('=====================================');
    
    setIsGenerating(true);
    setError(null);

    try {
      if (!hasClickedGenerate) {
        // 第一次点击 - 显示默认模糊图片
        console.log('第一次点击 - 显示默认模糊图片');
        setHasClickedGenerate(true);
        
        if (history_curage <= 3) {
          // For ages 3 and under, show random default image with blur
          console.log('年龄 <= 3, 随机选择默认图片');
          const randomImage = getRandomDefaultImage();
          if (randomImage) {
            console.log('设置默认模糊图片:', randomImage);
            setGeneratedImage(randomImage);
            // Save the image to history for timeline display
            useGameStore.getState().addGeneratedImage(history_curage, randomImage);
          } else {
            console.log('没有找到默认图片，设置错误');
            setError(t('messages.imageGenerationFailed', {
              defaultValue: 'Failed to generate image'
            }));
          }
        } else {
          // For ages > 3, need to check credits and potentially generate real image
          console.log('年龄 > 3, 检查余额生成真实图片');
          setShowPaywall(true);
        }
      } else {
        // 第二次或更多次点击 - 生成真实图片
        console.log('第二次点击 - 用户想要生成真实图片');
        const GENERATION_COST = 0.15;
        
        console.log('检查余额: credits =', credits, ', required =', GENERATION_COST);
        // Check if user has enough credits
        if (credits < GENERATION_COST) {
          console.log('余额不足，显示充值弹窗', { credits, required: GENERATION_COST });
          setShowPaywall(true);
          return;
        }
        
        console.log('余额充足，开始生成真实图片流程');
        // User has enough credits, consume and generate real image
        try {
          console.log('用户余额充足，开始扣费并生成真实图片');
          const success = await consumeCredit(undefined, GENERATION_COST);
          console.log('扣费结果:', success);
          if (success) {
            console.log('扣费成功，调用真实图片生成API');
            // Get the current age outcome for better image generation context
            const currentOutcome = gameState.history.find(entry => entry.age === history_curage)?.outcome || '';
            const endingSummary = currentOutcome || `${gameState.child.name} at age ${history_curage}`;
            
            console.log('=== 开始调用 generateEndingImage API ===');
            // Call the actual image generation API
            const result = await generateEndingImage(gameState, endingSummary, { size: '768x768', quality: 'standard' });
            console.log('=== generateEndingImage API 返回结果 ===', result);
            
            if (result.success && (result.imageUrl || result.imageBase64)) {
              console.log('真实图片生成成功');
              // 直接设置真实图片，不需要isDefault标记
              setGeneratedImage(result);
              // Save the real image to history
              useGameStore.getState().addGeneratedImage(history_curage, result);
            } else {
              console.log('真实图片生成失败');
              setError(t('messages.imageGenerationFailed', {
                defaultValue: 'Failed to generate image'
              }));
            }
          } else {
            console.log('扣费失败');
            setError(t('messages.consumeCreditFailed', {
              defaultValue: '扣费失败，请重试'
            }));
          }
        } catch (err) {
          console.error('生成真实图片过程中出错:', err);
          setError(t('messages.imageGenerationError', {
            error: err instanceof Error ? err.message : 'Unknown error',
            defaultValue: `Error generating image: ${err instanceof Error ? err.message : 'Unknown error'}`
          }));
        }
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
        // Update the image to mark it as unlocked
        if (generatedImage) {
          // 直接显示清晰图片，通过重新设置来触发重新渲染
          setGeneratedImage({...generatedImage});
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
              {/* 简化的显示逻辑：第一次点击显示模糊，第二次点击后显示清晰 */}
              {hasClickedGenerate && !error ? (
                <GeneratedImage
                  src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                  alt={t('ui.generatedImageAlt', {
                    age: history_curage,
                    gender: gameState.child.gender,
                  })}
                  sx={hasClickedGenerate && generatedImage.imageUrl === getRandomDefaultImage()?.imageUrl ? { filter: 'blur(8px)' } : {}}
                />
              ) : (
                <BlurredImageContainer>
                  <GeneratedImage
                    src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                    alt={t('ui.generatedImageAlt', {
                      age: history_curage,
                      gender: gameState.child.gender,
                    })}
                    sx={{ filter: 'blur(8px)' }}
                  />
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
                 console.log('=== 生成按钮点击调试 ===');
                 console.log('Generate button clicked, history_curage:', history_curage);
                 console.log('hasClickedGenerate:', hasClickedGenerate);
                 console.log('credits:', credits);
                 console.log('=======================');
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
               console.log('PaywallUI onCreditsGained called - user topped up credits');
               setShowPaywall(false);
               
               // 如果当前有默认图片，则用户是想生成真实图片
               if (generatedImage && generatedImage.isDefault) {
                 setIsGenerating(true);
                 setError(null);
                 
                 try {
                   const GENERATION_COST = 0.15;
                   const success = await consumeCredit(undefined, GENERATION_COST);
                   if (success) {
                     console.log('充值后生成真实图片 - 扣费成功');
                     // Get the current age outcome for better image generation context
                     const currentOutcome = gameState.history.find(entry => entry.age === history_curage)?.outcome || '';
                     const endingSummary = currentOutcome || `${gameState.child.name} at age ${history_curage}`;
                     
                     const result = await generateEndingImage(gameState, endingSummary, { size: '1920x640', quality: 'standard' });
                     if (result.success && (result.imageUrl || result.imageBase64)) {
                       setGeneratedImage({
                         ...result,
                       });
                       useGameStore.getState().addGeneratedImage(history_curage, result);
                     } else {
                       setError(t('messages.imageGenerationFailed', {
                         defaultValue: 'Failed to generate image'
                       }));
                     }
                   } else {
                     setError(t('messages.consumeCreditFailed', {
                       defaultValue: '扣费失败，请重试'
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
               } else {
                 // 如果是第一次生成，在PaywallUI关闭后让用户点击按钮
                 console.log('充值完成，等待用户再次点击生成按钮');
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
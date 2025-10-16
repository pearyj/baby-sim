import React, { useState, useRef } from 'react';
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

const UnlockButton = styled(Button)(() => ({
  backgroundColor: '#8D6E63',
  '&:hover': {
    backgroundColor: '#6D4C41',
  },
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
  onImageGenerated,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<ImageGenerationResult | null>(null);
  const [hasClickedGenerate, setHasClickedGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [isImageUnlocked, setIsImageUnlocked] = useState(false); // 跟踪图片是否已解锁
  const { hasPaid } = usePaymentStatus();
  const { anonId, kidId } = usePaymentStore(state => ({ anonId: state.anonId, kidId: state.kidId }));
  const { credits, consumeCredit } = usePaymentStore(state => ({ credits: state.credits, consumeCredit: state.consumeCredit }));
  
  // 创建按钮引用，用于自动点击
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  
  // Get the correct age from history
  const { history } = useGameStore();
  const history_curage = history && history.length ? history[history.length - 1].age : 0;
  
  // 检查整个游戏中是否已经点击过"我想见他"按钮（查看是否有任何年龄有图片）
  const hasEverClickedGenerate = history.some(entry => entry.imageUrl);
    
  // 检查当前年龄是否已经生成过图片
  const currentAgeHasImage = history.some(entry => entry.age === history_curage && entry.imageUrl);

  // Get random default image from available images
  const getRandomDefaultImage = () => {
    const { race, gender } = gameState.child;
    const raceMap = RACE_GENDER_IMAGE_MAP[race as keyof typeof RACE_GENDER_IMAGE_MAP];
    const imageUrls = raceMap?.[gender as 'male' | 'female'];
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      const randomIndex = Math.floor(Math.random() * imageUrls.length);
      const selectedImageUrl = imageUrls[randomIndex];
      return {
        success: true,
        imageUrl: selectedImageUrl,
      } as ImageGenerationResult;
    }
    return null;
  };

  const handleGenerateImage = async () => {
    console.log('=== 按钮点击调试 ===');
    console.log('hasClickedGenerate:', hasClickedGenerate);
    console.log('credits:', credits);
    console.log('==================');
    
    setIsGenerating(true);
    setError(null);

    try {
      if (!hasEverClickedGenerate) {
        // 整个游戏中第一次点击“我想见他”
        console.log('整个游戏中第一次点击“我想见他”，当前年龄:', history_curage);
        setHasClickedGenerate(true);
        
        if (history_curage <= 3) {
          // 年龄≤3岁，显示模糊图片
          const randomImage = getRandomDefaultImage();
          if (randomImage) {
            setGeneratedImage(randomImage);
            useGameStore.getState().addGeneratedImage(history_curage, randomImage);
          } else {
            setError('error');
          }
        } else {
          // 年龄>3岁，显示PaywallUI
          setShowPaywall(true);
        }
      } else {
        // 整个游戏中第二次或更多次点击“我想见他”
        console.log('整个游戏中第二次点击“我想见他”，当前年龄:', history_curage);
        const GENERATION_COST = 0.15;
        
        if (credits < GENERATION_COST) {
          console.log('余额不足，显示充值弹窗');
          setShowPaywall(true);
          return;
        }
        
        console.log('余额充足，开始扣费并生成真实图片');
        const success = await consumeCredit(undefined, GENERATION_COST);
        if (success) {
          console.log('扣费成功，调用API生成真实图片');
          const currentOutcome = gameState.history.find(entry => entry.age === history_curage)?.outcome || '';
          const endingSummary = currentOutcome || `${gameState.child.name} at age ${history_curage}`;
          
          const result = await generateEndingImage(gameState, endingSummary, { size: '1920x640', quality: 'standard' });
          console.log('API返回结果:', result);
          
          if (result.success && (result.imageUrl || result.imageBase64)) {
            console.log('真实图片生成成功');
            setGeneratedImage(result);
            useGameStore.getState().addGeneratedImage(history_curage, result);
          } else {
            setError('图片生成失败');
          }
        } else {
          setError('扣费失败');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDismiss = () => {
    setShowSkipConfirm(true);
  };

  const handleConfirmSkip = async () => {
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
    
    const { skipImageGeneration } = useGameStore.getState();
    skipImageGeneration();
    useGameStore.setState({ shouldGenerateImage: false });
    setShowSkipConfirm(false);
    onDismiss?.();
  };

  const handleCancelSkip = () => {
    setShowSkipConfirm(false);
  };

  const handleContinue = () => {
    if (generatedImage) {
      onImageGenerated?.(generatedImage);
    }
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
        console.log('扣费成功，解锁图片（去掉模糊效果）');
        // 扣费成功后设置解锁状态，并同步到全局状态
        setIsImageUnlocked(true);
        useGameStore.getState().unlockImage(history_curage);
      } else {
        setError('扣费失败');
      }
    } catch (err) {
      console.error('扣费过程中出错:', err);
      setError('解锁过程中出现错误');
    }
  };

  // 判断是否应该显示模糊效果


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
            <Button size="small" onClick={handleDismiss} sx={{ minWidth: 'auto', p: 0.5 }}>
              <Close />
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
            {t('ui.ageImagePromptDescription', { age: history_curage })}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {generatedImage && generatedImage.success && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              {/* 第一次点击且年龄≤3岁且未解锁时显示模糊图片，其他情况显示清晰图片 */}
              {(generatedImage.imageUrl && !generatedImage.imageBase64 && history_curage <= 3 && !isImageUnlocked) ? (
                <BlurredImageContainer>
                  <GeneratedImage
                    src={generatedImage.imageUrl}
                    alt={t('ui.generatedImageAlt', {
                      age: history_curage,
                      gender: gameState.child.gender,
                    })}
                    style={{ filter: 'blur(8px)' }}
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
              ) : (
                <GeneratedImage
                  src={generatedImage.imageUrl || `data:image/png;base64,${generatedImage.imageBase64}`}
                  alt={t('ui.generatedImageAlt', {
                    age: history_curage,
                    gender: gameState.child.gender,
                  })}
                />
              )}
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
                {(generatedImage.imageUrl && !generatedImage.imageBase64 && history_curage <= 3 && !isImageUnlocked) ? '点击解锁按钮查看清晰图片' : '图片生成成功!'}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              ref={generateButtonRef}
              onClick={handleGenerateImage}
              disabled={isGenerating || currentAgeHasImage}
              startIcon={isGenerating ? <CircularProgress size={20} /> : <CameraAlt />}
              sx={{
                backgroundColor: '#8D6E63',
                '&:hover': { backgroundColor: '#6D4C41' },
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
      
      <PaywallUI 
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        childName={gameState.child?.name || 'Child'}
        mode="image"
        onCreditsGained={async () => {
          console.log('充值成功，自动解锁图片');
          
          // 充值成功后自动执行解锁逻辑（只需要去掉模糊效果）
          if (generatedImage) {
            try {
              const UNLOCK_COST = 0.15;
              const success = await consumeCredit(undefined, UNLOCK_COST);
              if (success) {
                console.log('充值后自动扣费成功，解锁图片');
                setIsImageUnlocked(true);
                useGameStore.getState().unlockImage(history_curage);
              } else {
                setError('扣费失败');
              }
            } catch (err) {
              console.error('充值后扣费过程中出错:', err);
              setError('解锁过程中出现错误');
            }
          } else {
            // 如果没有生成的图片，自动点击"我想见他/她"按钮
            console.log('充值成功，自动点击"我想见他/她"按钮');
            setTimeout(() => {
              if (generateButtonRef.current && !generateButtonRef.current.disabled) {
                generateButtonRef.current.click();
              }
            }, 100); // 延迟100ms确保状态更新完成
          }
        }}
      />
      
      <Dialog open={showSkipConfirm} onClose={handleCancelSkip}>
        <DialogTitle>跳过图片生成?</DialogTitle>
        <DialogContent>
          <Typography>确定要跳过生成图片吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSkip}>取消</Button>
          <Button onClick={handleConfirmSkip} variant="contained">确定跳过</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
import React, { useState } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import useGameStore from '../../stores/useGameStore';
import { PaywallUI } from '../payment/PaywallUI';
import { usePaymentStore } from '../../stores/usePaymentStore';
import { generateEndingImage } from '../../services/imageGenerationService';

interface ImageDisplayProps {
  currentAge: number;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ currentAge }) => {
  const { t } = useTranslation();
  const { history } = useGameStore();



  // Get the most recent generated image
  const currentImage = history.length > 0 ? history.find(i => (i.age) === currentAge) : null;
  // Only show when age is over 7
  if (!currentImage || (currentImage && !currentImage.imageUrl)) {
    return null;
  }

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2, 
        mt: 2,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      <Box className="image-display" sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {t('welcome.currentAge', {age: currentAge})}
        </Typography>
        <Box
          sx={{
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'action.hover',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {currentImage && currentImage.imageUrl ? (
            <BlurredImageContainer currentImage={currentImage} />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {t('messages.noImageGenerated') || 'No generated image available'}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

// 模糊图片容器组件
const BlurredImageContainer: React.FC<{ currentImage: any }> = ({ currentImage }) => {
  const { t } = useTranslation();
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false); // 追踪图片是否已被解锁
  const { child, history } = useGameStore();
  const { credits, consumeCredit } = usePaymentStore(state => ({ credits: state.credits, consumeCredit: state.consumeCredit }));

  // 检查整个游戏中点击"我想见他"的次数
  const clickedGenerateCount = history.filter(entry => entry.imageUrl).length;
  // 判断是否应该显示模糊：第一次点击且年龄≤3岁且未解锁
  const shouldShowBlurred = clickedGenerateCount === 1 && currentImage.age <= 3 && !isUnlocked;

  const handleUnblurClick = async () => {
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
        console.log('扣费成功，生成真实图片并更新游戏数据');
        
        // 生成真实图片并更新游戏数据
        const gameState = {
          child: { name: child?.name || 'Child', age: currentImage.age },
          history: history.filter(entry => entry.age === currentImage.age)
        };
        const currentOutcome = history.find(entry => entry.age === currentImage.age)?.outcome || '';
        const endingSummary = currentOutcome || `${child?.name || 'Child'} at age ${currentImage.age}`;
        
        const result = await generateEndingImage(gameState as any, endingSummary, { size: '1920x640', quality: 'standard' });
        if (result.success && (result.imageUrl || result.imageBase64)) {
          // 更新游戏数据中的图片
          const { addGeneratedImage } = useGameStore.getState();
          addGeneratedImage(currentImage.age, result);
          setIsUnlocked(true); // 设置为已解锁
        } else {
          console.error('图片生成失败');
          setShowPaywall(true);
        }
      } else {
        console.log('扣费失败');
        setShowPaywall(true);
      }
    } catch (err) {
      console.error('扣费过程中出错:', err);
      setShowPaywall(true);
    }
  };

  return (
    <>
      <Box sx={{
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        position: 'relative',
      }}>
        <img 
          src={currentImage.imageUrl || `data:image/png;base64,${currentImage.imageBase64}`}
          alt="Generated AI image"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: '200px',
            objectFit: 'cover',
            filter: shouldShowBlurred ? 'blur(8px)' : 'none', // 根据游戏状态决定是否模糊
          }}
        />
        {/* 付费提示覆盖层 - 只在应该显示模糊时显示 */}
        {shouldShowBlurred && (
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
            cursor: 'pointer',
          }} onClick={handleUnblurClick}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'white',
              textAlign: 'center',
              mb: 1,
              fontWeight: 500,
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
            }}
          >
            {t('messages.blurredImageHint', { defaultValue: '解锁查看清晰图片' })}
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
      
      <PaywallUI
        open={showPaywall}
        onClose={() => {
          setShowPaywall(false);
        }}
        childName={child?.name || 'Child'}
        mode="image"
        onCreditsGained={() => {
          // 充值成功后关闭弹窗
          setShowPaywall(false);
        }}
      />
    </>
  );
};
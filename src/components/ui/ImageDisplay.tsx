import React, { useState } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import useGameStore from '../../stores/useGameStore';
import { PaywallUI } from '../payment/PaywallUI';
import { usePaymentStatus } from '../../hooks/usePaymentStatus';

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
      <Box sx={{ textAlign: 'center' }}>
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
  const { child } = useGameStore();
  const { hasPaid, isLoading } = usePaymentStatus();

  const handleUnblurClick = () => {
    setShowPaywall(true);
  };

  const handlePaywallClose = () => {
    setShowPaywall(false);
  };

  return (
    <>
      <Box sx={{
        width: '100%',
        maxWidth: '300px',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        position: 'relative',
      }}>
        <img 
          src={currentImage.imageUrl}
          alt="Generated AI image"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: '200px',
            objectFit: 'cover',
            filter: hasPaid ? 'none' : 'blur(8px)',
          }}
        />
        {/* 付费提示覆盖层 - 只在未付费时显示 */}
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
        onCreditsGained={(newCredits) => {
          // 这里可以添加解锁成功后的逻辑
          setShowPaywall(false);
        }}
      />
    </>
  );
};
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Alert,
  Card,
  CardContent,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Image, AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { track } from '@vercel/analytics';
import { generateEndingImage, type ImageGenerationOptions, type ImageGenerationResult } from '../services/imageGenerationService';
import type { GameState } from '../types/game';
import { usePaymentStore } from '../stores/usePaymentStore';
import { logEvent, updateSessionFlags } from '../services/eventLogger';
// useGameStore import removed - image storage now handled in imageGenerationService

// Security: Maximum length for art style input to prevent jailbreaking (language-specific)
const getMaxArtStyleLength = (language: string): number => {
  return language === 'zh' ? 30 : 60; // 30 for Chinese, 60 for English
};

interface AIImageGeneratorProps {
  gameState: GameState;
  endingSummary: string;
  onImageGenerated?: (imageResult: ImageGenerationResult) => void;
  className?: string;
  // Paywall integration props
  onBeforeGenerate?: () => boolean;
  hasCredits?: boolean;
  creditsCount?: number;
  isCheckingCredits?: boolean;
}

const GenerateImageContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
  padding: theme.spacing(3),
  backgroundColor: 'rgba(255, 255, 255, 0.6)',
  borderRadius: theme.spacing(2),
  backdropFilter: 'blur(10px)',
  border: `2px dashed rgba(139, 69, 19, 0.3)`,
  textAlign: 'center',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: 'rgba(139, 69, 19, 0.5)',
  },
}));

const GenerateButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1.5, 3),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  minHeight: 48,
  background: 'linear-gradient(45deg, #FF8A5B 30%, #FF6B35 90%)',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.4)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: 'linear-gradient(45deg, #FF6B35 30%, #E55A2B 90%)',
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 24px rgba(229, 90, 43, 0.5)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  '&:disabled': {
    background: 'rgba(255, 107, 53, 0.3)',
    color: 'rgba(255, 255, 255, 0.7)',
  },
}));

const GeneratedImageContainer = styled(Card)(({ theme }) => ({
  marginTop: theme.spacing(2),
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
}));

const GeneratedImage = styled('img')({
  width: '100%',
  height: 'auto',
  maxHeight: '400px',
  objectFit: 'contain',
  display: 'block',
});

export const AIImageGenerator: React.FC<AIImageGeneratorProps> = ({
  gameState,
  endingSummary,
  onImageGenerated,
  className,
  onBeforeGenerate,
  hasCredits = true,
  creditsCount: _creditsCount = 0,
  isCheckingCredits = false,
}) => {
  const { t, i18n } = useTranslation();
  const { anonId, kidId } = usePaymentStore(state => ({ anonId: state.anonId, kidId: state.kidId }));
  // addGeneratedImage removed - image storage now handled in imageGenerationService
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<ImageGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artStyleInput, setArtStyleInput] = useState<string>('');

  // Get current language from i18n
  const currentLanguage = i18n.language;

  // On mount or when endingSummary changes, pre-fill art style if hidden comment present
  useEffect(() => {
    if (!artStyleInput) {
      const match = endingSummary.match(/<!--\s*story_style:\s*([^>]+?)\s*-->/i);
      if (match && match[1]) {
        // Security: Limit length even from extracted style
        const extractedStyle = match[1].trim();
        setArtStyleInput(extractedStyle.length > getMaxArtStyleLength(currentLanguage) 
          ? extractedStyle.substring(0, getMaxArtStyleLength(currentLanguage)) 
          : extractedStyle);
      }
    }
  }, [endingSummary, currentLanguage, artStyleInput]);

  // Security: Validate and sanitize art style input
  const handleArtStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Limit length to prevent jailbreaking
    if (input.length > getMaxArtStyleLength(currentLanguage)) {
      return; // Don't update if exceeds limit
    }
    
    // Basic sanitization - remove potentially dangerous characters but keep spaces
    const sanitized = input.replace(/[<>{}]/g, '');
    setArtStyleInput(sanitized);
  };

  const handleGenerateImage = async () => {
    if (onBeforeGenerate) {
      const gateResult = onBeforeGenerate();
      
      if (gateResult && typeof (gateResult as any).then === 'function') {
        const allowed = await (gateResult as unknown as Promise<boolean>);
        if (!allowed) return;
      } else if (!gateResult) {
        return;
      }
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      track('AI Image Generation Started');
      
      // Final validation before sending
      const sanitizedArtStyle = artStyleInput.trim().substring(0, getMaxArtStyleLength(currentLanguage));
      
      const options: ImageGenerationOptions = {
        size: '768x768',
        quality: 'standard',
        ...(sanitizedArtStyle !== '' ? { customArtStyle: sanitizedArtStyle } : {})
      };

      // Get outcome from history for current age as aiGeneratedText
      const currentAgeOutcome = gameState.history.find(entry => entry.age === gameState.child.age)?.outcome;
      
      const result = await generateEndingImage(
        gameState,
        endingSummary,
        options,
        currentAgeOutcome // Use current age outcome as AI generated text
      );
      
      console.log('🎨 AIImageGenerator result:', result);
      console.log('📸 AIImageGenerator has imageBase64?', !!result.imageBase64);
      console.log('🔗 AIImageGenerator has imageUrl?', !!result.imageUrl);
      
      if (result.success) {
        setGeneratedImage(result);
        onImageGenerated?.(result);
        
        // Image storage is now handled directly in imageGenerationService
        console.log('ℹ️ AIImageGenerator: Image storage handled by imageGenerationService');
        
        track('Image Generated');
        if (anonId && kidId) {
          updateSessionFlags(anonId, kidId, { imageGenerated: true });
          // still keep granular event for debugging
          logEvent(anonId, kidId, 'image_generated', { size: options.size, artStyle: options.customArtStyle ?? null });
        }
      } else {
        setError(result.error || t('messages.imageGenerationFailed'));
        track('AI Image Generation Failed', { error: result.error ?? 'unknown-error' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('messages.imageGenerationFailed');
      setError(errorMessage);
      track('AI Image Generation Error', { error: errorMessage || 'unknown-error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setGeneratedImage(null);
    handleGenerateImage();
  };

  return (
    <Box className={className}>
      {!generatedImage && !isGenerating && (
        <GenerateImageContainer>
          <Box sx={{ mb: 2 }}>
            <AutoAwesome sx={{ fontSize: 40, color: '#8D6E63', mb: 1 }} />
            <Typography variant="h6" sx={{ 
              color: '#5D4037', 
              fontWeight: 600,
              mb: 2 
            }}>
              {t('messages.imageGenerationOptional')}
            </Typography>
          </Box>
          
          <TextField
            fullWidth
            variant="outlined"
            placeholder={t('messages.artStylePlaceholder', { defaultValue: 'Watercolor' }) as string}
            value={artStyleInput}
            onChange={handleArtStyleChange}
            inputProps={{ 
              maxLength: getMaxArtStyleLength(currentLanguage),
              'aria-label': 'Art style input'
            }}
            helperText={`${artStyleInput.length}/${getMaxArtStyleLength(currentLanguage)} characters`}
            sx={{ marginBottom: 2 }}
          />

          {isCheckingCredits ? (
            <GenerateButton disabled startIcon={<CircularProgress size={20} />}>
              {t('messages.checkingCredits', { defaultValue: 'Checking credits…' })}
            </GenerateButton>
          ) : (
            <GenerateButton
              onClick={handleGenerateImage}
              startIcon={<Image />}
              disabled={isGenerating}
            >
              {hasCredits 
                ? t('messages.generateImage', { childName: gameState.child.name })
                : (t('messages.supportSimulator', { childName: gameState.child.name }) || 
                   `Support the Baby Simulator and see ${gameState.child.name} in a photo`)
              }
            </GenerateButton>
          )}
        </GenerateImageContainer>
      )}

      {isGenerating && (
        <GenerateImageContainer>
          <Box sx={{ mb: 2 }}>
            <CircularProgress size={40} sx={{ color: '#8D6E63', mb: 2 }} />
            <Typography variant="h6" sx={{ 
              color: '#5D4037', 
              fontWeight: 600,
              mb: 1 
            }}>
              {t('messages.generatingImage', { childName: gameState.child.name })}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: '#8D6E63',
              fontSize: '0.9rem'
            }}>
              AI is creating a personalized image for your parenting journey...
            </Typography>
          </Box>
        </GenerateImageContainer>
      )}

      {error && (
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleRetry}
              disabled={isGenerating}
            >
              Retry
            </Button>
          }
          sx={{ mt: 2 }}
        >
          {error}
        </Alert>
      )}

      {generatedImage && generatedImage.success && (
        <GeneratedImageContainer className="hide-in-export" sx={{ display: 'none' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ 
                color: '#5D4037', 
                fontWeight: 600,
                mb: 1 
              }}>
                {t('messages.imageGenerated')}
              </Typography>
            </Box>
            
            {generatedImage.imageUrl && (
              <GeneratedImage 
                src={generatedImage.imageUrl || ''} 
                alt={`AI generated image for ${gameState.child.name}'s parenting journey`}
              />
            )}
            
            {generatedImage.imageBase64 && !generatedImage.imageUrl && (
              <GeneratedImage 
                src={generatedImage.imageBase64 ? `data:image/png;base64,${generatedImage.imageBase64}` : ''} 
                alt={`AI generated image for ${gameState.child.name}'s parenting journey`}
              />
            )}
            

          </CardContent>
        </GeneratedImageContainer>
      )}
    </Box>
  );
};

// Add displayName for production debugging
AIImageGenerator.displayName = 'AIImageGenerator';
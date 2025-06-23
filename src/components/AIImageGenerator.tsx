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

// Security: Maximum length for art style input to prevent jailbreaking
const MAX_ART_STYLE_LENGTH = 100;

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
  background: 'linear-gradient(45deg, #8D6E63 30%, #5D4037 90%)',
  color: 'white',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: 'linear-gradient(45deg, #5D4037 30%, #3E2723 90%)',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 20px rgba(93, 64, 55, 0.4)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  '&:disabled': {
    background: 'rgba(139, 69, 19, 0.3)',
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
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<ImageGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artStyleInput, setArtStyleInput] = useState<string>('');

  // On mount or when endingSummary changes, pre-fill art style if hidden comment present
  useEffect(() => {
    if (!artStyleInput) {
      const match = endingSummary.match(/<!--\s*story_style:\s*([^>]+?)\s*-->/i);
      if (match && match[1]) {
        // Security: Limit length even from extracted style
        const extractedStyle = match[1].trim();
        setArtStyleInput(extractedStyle.length > MAX_ART_STYLE_LENGTH 
          ? extractedStyle.substring(0, MAX_ART_STYLE_LENGTH) 
          : extractedStyle);
      }
    }
  }, [endingSummary]);

  // Security: Validate and sanitize art style input
  const handleArtStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Limit length to prevent jailbreaking
    if (input.length > MAX_ART_STYLE_LENGTH) {
      return; // Don't update if exceeds limit
    }
    
    // Basic sanitization - remove potentially dangerous characters
    const sanitized = input.replace(/[<>{}]/g, '').trim();
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
      const sanitizedArtStyle = artStyleInput.trim().substring(0, MAX_ART_STYLE_LENGTH);
      
      const options: ImageGenerationOptions = {
        size: '768x768',
        quality: 'standard',
        ...(sanitizedArtStyle !== '' ? { customArtStyle: sanitizedArtStyle } : {})
      };

      const result = await generateEndingImage(gameState, endingSummary, options);
      
      if (result.success) {
        setGeneratedImage(result);
        onImageGenerated?.(result);
        track('AI Image Generation Success');
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
              maxLength: MAX_ART_STYLE_LENGTH,
              'aria-label': 'Art style input'
            }}
            helperText={`${artStyleInput.length}/${MAX_ART_STYLE_LENGTH} characters`}
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
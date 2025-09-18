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
  Grid,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Image, AutoAwesome, CheckCircle } from '@mui/icons-material';
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

interface MultiAgeImageGeneratorProps {
  gameState: GameState;
  endingSummary: string;
  onImagesGenerated?: (images: { [age: number]: ImageGenerationResult }) => void;
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
  maxHeight: '300px',
  objectFit: 'contain',
  display: 'block',
});

const AgeChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  left: theme.spacing(1),
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  fontWeight: 600,
}));

export const MultiAgeImageGenerator: React.FC<MultiAgeImageGeneratorProps> = ({
  gameState,
  endingSummary,
  onImagesGenerated,
  className,
  onBeforeGenerate,
  hasCredits = true,
  creditsCount: _creditsCount = 0,
  isCheckingCredits = false,
}) => {
  const { t, i18n } = useTranslation();
  const { anonId, kidId } = usePaymentStore(state => ({ anonId: state.anonId, kidId: state.kidId }));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ [age: number]: ImageGenerationResult }>({});
  const [error, setError] = useState<string | null>(null);
  const [artStyleInput, setArtStyleInput] = useState<string>('');
  const [currentGeneratingAge, setCurrentGeneratingAge] = useState<number | null>(null);

  // Get current language from i18n
  const currentLanguage = i18n.language;

  // Define the ages for image generation (every 3 years from 3 to 18)
  const imageAges = [3, 6, 9, 12, 15, 18];

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

  const handleArtStyleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const maxLength = getMaxArtStyleLength(currentLanguage);
    if (value.length <= maxLength) {
      setArtStyleInput(value);
    }
  };

  const generateImageForAge = async (age: number): Promise<ImageGenerationResult> => {
    console.log(`🎯 Starting generateImageForAge for age ${age}`);
    
    try {
      // Create a modified game state for the specific age
      const ageGameState = {
        ...gameState,
        child: { ...gameState.child, age },
        player: { ...gameState.player, age: gameState.player.age + (age - gameState.child.age) }
      };
      console.log(`🎮 Created ageGameState for age ${age}:`, ageGameState);

      // Final validation before sending
      const sanitizedArtStyle = artStyleInput.trim().substring(0, getMaxArtStyleLength(currentLanguage));
      
      const options: ImageGenerationOptions = {
        size: '768x768',
        quality: 'standard',
        ...(sanitizedArtStyle !== '' ? { customArtStyle: sanitizedArtStyle } : {})
      };
      console.log(`⚙️ Image generation options for age ${age}:`, options);

      // Get outcome from history for this specific age as aiGeneratedText
      const ageOutcome = gameState.history.find(entry => entry.age === age)?.outcome;
      console.log(`📝 Using outcome for age ${age}:`, ageOutcome ? ageOutcome.substring(0, 100) + '...' : 'No outcome found');
      
      console.log(`🚀 Calling generateEndingImage for age ${age}`);
      const result = await generateEndingImage(ageGameState, endingSummary, options, ageOutcome);
      console.log(`🎨 generateEndingImage returned for age ${age}:`, result);
      
      return result;
    } catch (error) {
      console.error(`❌ Error in generateImageForAge for age ${age}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in generateImageForAge'
      };
    }
  };

  const handleGenerateAllImages = async () => {
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
    setGeneratedImages({});
    
    try {
      track('Multi-Age Image Generation Started');
      
      const newImages: { [age: number]: ImageGenerationResult } = {};
      
      // Generate images sequentially to avoid overwhelming the API
      for (const age of imageAges) {
        setCurrentGeneratingAge(age);
        
        try {
          const result = await generateImageForAge(age);
          console.log(`🎨 imageData Generated image for age ${age}:`, result);
          console.log(`📸  imageData Result has imageBase64?`, !!result.imageBase64);
          console.log(`🔗 imageData Result has imageUrl?`, !!result.imageUrl);
          
          if (result.success) {
            newImages[age] = result;
            setGeneratedImages(prev => ({ ...prev, [age]: result }));
            
            // Note: MultiAgeImageGenerator is for display only, not for storing in history
            
            track('Age Image Generated', { age });
          } else {
            console.error(`Failed to generate image for age ${age}:`, result.error);
            // Continue with other ages even if one fails
          }
        } catch (err) {
          console.error(`Error generating image for age ${age}:`, err);
          // Continue with other ages even if one fails
        }
        
        // Small delay between generations to be respectful to the API
        if (age !== imageAges[imageAges.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      onImagesGenerated?.(newImages);
      
      if (anonId && kidId) {
        updateSessionFlags(anonId, kidId, { imageGenerated: true });
        logEvent(anonId, kidId, 'multi_age_images_generated', { 
          ageCount: Object.keys(newImages).length,
          artStyle: artStyleInput || null 
        });
      }
      
      track('Multi-Age Image Generation Completed', { 
        successCount: Object.keys(newImages).length,
        totalAges: imageAges.length 
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('messages.imageGenerationFailed');
      setError(errorMessage);
      track('Multi-Age Image Generation Error', { error: errorMessage || 'unknown-error' });
    } finally {
      setIsGenerating(false);
      setCurrentGeneratingAge(null);
    }
  };

  const handleRetry = () => {
    setError(null);
    setGeneratedImages({});
    handleGenerateAllImages();
  };

  const hasAnyImages = Object.keys(generatedImages).length > 0;
  const completedCount = Object.keys(generatedImages).length;

  return (
    <Box className={className}>
      {!hasAnyImages && !isGenerating && (
        <GenerateImageContainer>
          <Box sx={{ mb: 2 }}>
            <AutoAwesome sx={{ fontSize: 40, color: '#8D6E63', mb: 1 }} />
            <Typography variant="h6" sx={{ 
              color: '#5D4037', 
              fontWeight: 600,
              mb: 2 
            }}>
              {t('messages.multiAgeImageGeneration', { 
                childName: gameState.child.name,
                defaultValue: `Generate ${gameState.child.name}'s Growth Journey` 
              })}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: '#8D6E63',
              mb: 2
            }}>
              {t('messages.multiAgeImageDescription', {
                defaultValue: 'Create images showing your child at ages 3, 6, 9, 12, 15, and 18 to see their complete growth journey.'
              })}
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
              onClick={handleGenerateAllImages}
              startIcon={<Image />}
              disabled={isGenerating}
            >
              {hasCredits 
                ? t('messages.generateMultiAgeImages', { 
                    childName: gameState.child.name,
                    defaultValue: `Generate ${gameState.child.name}'s Growth Journey`
                  })
                : (t('messages.supportSimulator', { childName: gameState.child.name }) || 
                   `Support the Baby Simulator and see ${gameState.child.name}'s growth journey`)
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
              {currentGeneratingAge 
                ? t('messages.generatingAgeImage', { 
                    childName: gameState.child.name, 
                    age: currentGeneratingAge,
                    defaultValue: `Generating ${gameState.child.name} at age ${currentGeneratingAge}...`
                  })
                : t('messages.generatingImages', { 
                    childName: gameState.child.name,
                    defaultValue: `Generating ${gameState.child.name}'s images...`
                  })
              }
            </Typography>
            <Typography variant="body2" sx={{ 
              color: '#8D6E63',
              fontSize: '0.9rem',
              mb: 2
            }}>
              {t('messages.multiAgeGenerationProgress', {
                completed: completedCount,
                total: imageAges.length,
                defaultValue: `Progress: ${completedCount}/${imageAges.length} images completed`
              })}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              {imageAges.map(age => (
                <Chip
                  key={age}
                  label={`${age - 1}岁`}
                  size="small"
                  color={generatedImages[age] ? 'success' : currentGeneratingAge === age ? 'primary' : 'default'}
                  icon={generatedImages[age] ? <CheckCircle /> : undefined}
                />
              ))}
            </Box>
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

      {hasAnyImages && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ 
            color: '#5D4037', 
            fontWeight: 600,
            mb: 2,
            textAlign: 'center'
          }}>
            {t('messages.growthJourneyImages', {
              childName: gameState.child.name,
              defaultValue: `${gameState.child.name}'s Growth Journey`
            })}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {imageAges.map(age => {
              const imageResult = generatedImages[age];
              if (!imageResult || !imageResult.success) return null;
              
              return (
                <Box key={age} sx={{ flex: '1 1 300px', minWidth: '300px', maxWidth: '400px' }}>
                  <GeneratedImageContainer>
                    <Box sx={{ position: 'relative' }}>
                      <AgeChip label={`${age - 1}岁`} color="primary" />
                      {imageResult.imageUrl && (
                        <GeneratedImage 
                          src={imageResult.imageUrl} 
                          alt={`${gameState.child.name} at age ${age}`}
                        />
                      )}
                      {imageResult.imageBase64 && !imageResult.imageUrl && (
                        <GeneratedImage 
                          src={`data:image/png;base64,${imageResult.imageBase64}`} 
                          alt={`${gameState.child.name} at age ${age}`}
                        />
                      )}
                    </Box>
                  </GeneratedImageContainer>
                </Box>
              );
            })}
          </Box>
          
          {!isGenerating && completedCount < imageAges.length && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                onClick={handleRetry}
                variant="outlined"
                startIcon={<Image />}
              >
                {t('messages.retryMissingImages', {
                  defaultValue: 'Retry Missing Images'
                })}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// Add displayName for production debugging
MultiAgeImageGenerator.displayName = 'MultiAgeImageGenerator';
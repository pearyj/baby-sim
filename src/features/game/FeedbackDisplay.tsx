import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  CardContent,
  Button,
  Box,
  Typography,
  Fade,
  Zoom,
  LinearProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { PlayArrow, Flag, Start } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { TextDisplay } from '../../components/ui/TextDisplay';
import { StreamingTextDisplay } from '../../components/ui/StreamingTextDisplay';
import logger from '../../utils/logger';

interface FeedbackDisplayProps {
  feedback: string;
  onContinue: () => void;
  isEnding?: boolean;
  isFirstQuestion?: boolean;
  isLoadingFirstQuestion?: boolean;
  childName?: string;
  isStreaming?: boolean;
  streamingContent?: string;
}

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  background: theme.palette.background.paper,
  overflow: 'visible',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette.info.main} 100%)`,
    borderRadius: '12px 12px 0 0',
  },
}));

const ContinueButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1.5, 4),
  fontSize: '1.125rem',
  fontWeight: 600,
  textTransform: 'none',
  minHeight: 56,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
}));

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedback,
  onContinue,
  isEnding = false,
  isFirstQuestion = false,
  isLoadingFirstQuestion = false,
  childName = '',
  isStreaming = false,
  streamingContent = '',
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Animation effect when component mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Auto scroll to this component only for initial feedback (not when transitioning from questions)
  useEffect(() => {
    if (isVisible && containerRef.current && isFirstQuestion) {
      // Only auto-scroll for the first question feedback, not for regular feedback
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, isFirstQuestion]);
  
  // Scroll to top when streaming content begins
  useEffect(() => {
    if (isStreaming && streamingContent && containerRef.current) {
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isStreaming, streamingContent]);
  
  // Determine button text and styling
  const buttonText = 
    isStreaming
      ? t('actions.generating')
      : isLoadingFirstQuestion && isFirstQuestion 
        ? t('actions.loading')
        : isEnding 
          ? t('actions.endGame')
          : isFirstQuestion && childName
            ? t('actions.startRaisingChild', { childName })
          : isFirstQuestion
            ? t('actions.startRaising')
            : t('actions.continue');

  const getButtonIcon = () => {
    if (isStreaming) return null;
    if (isLoadingFirstQuestion && isFirstQuestion) return null;
    if (isEnding) return <Flag sx={{ mr: 1 }} />;
    if (isFirstQuestion) return <Start sx={{ mr: 1 }} />;
    return <PlayArrow sx={{ mr: 1 }} />;
  };
  
  const handleContinue = () => {
    logger.debug("DEBUG: FeedbackDisplay handleContinue - TOP");
    logger.debug("Continue button clicked in FeedbackDisplay", {
      isEnding,
      isFirstQuestion,
      onContinueType: typeof onContinue,
      isFunction: typeof onContinue === 'function'
    });
    
    try {
      if (typeof onContinue === 'function') {
        onContinue();
      } else {
        logger.error("Error: onContinue is not a function", onContinue);
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    } catch (err) {
      logger.error("Error in handleContinue:", err);
      alert(t('messages.continueError'));
    }
  };
  
  useEffect(() => {
    if (feedback) {
      logger.debug('Feedback text updated:', feedback);
      logger.debug('Current streaming state:', { isStreaming, streamingContent });
    }
  }, [feedback, isStreaming, streamingContent]);
  
  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3 } }} ref={containerRef}>
      <Box sx={{ maxWidth: '48rem', mx: 'auto' }}>
        <Fade in={isVisible} timeout={500}>
          <StyledCard elevation={3}>
            <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
              {isLoadingFirstQuestion && isFirstQuestion && (
                <Box sx={{ mb: 3 }}>
                  <LinearProgress 
                    color="primary" 
                    sx={{ 
                      borderRadius: 1,
                      height: 6,
                      backgroundColor: 'rgba(0,0,0,0.1)'
                    }} 
                  />
                </Box>
              )}
              
              <Box sx={{ mb: 3 }}>
                {isStreaming && streamingContent ? (
                  <StreamingTextDisplay
                    content={streamingContent}
                    isStreaming={isStreaming}
                    isComplete={!isStreaming}
                    showTypewriter={true}
                    placeholder={t('intro.generatingResult')}
                    onStreamingStart={() => {
                      // Scroll to the top of the new feedback block
                      setTimeout(() => {
                        containerRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                          inline: 'nearest'
                        });
                      }, 50);
                    }}
                    onStreamingComplete={() => {
                      // Force a re-render to show the static content when streaming completes
                      // This helps ensure proper transition from streaming to static display
                    }}
                  />
                ) : (
                  <Typography
                    component="div"
                    sx={{
                      fontSize: { xs: '1rem', sm: '1.125rem' },
                      lineHeight: 1.6,
                      color: 'text.primary',
                      fontWeight: 400,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    <TextDisplay 
                      text={feedback} 
                      animated={false} 
                      delay={200}
                      paragraphClassName=""
                    />
                  </Typography>
                )}
              </Box>
              
              <Zoom in={isVisible} timeout={700} style={{ transitionDelay: '300ms' }}>
                <Box>
                  <ContinueButton
                    fullWidth
                    variant="contained"
                    color={isEnding ? 'warning' : 'primary'}
                    onClick={handleContinue}
                    disabled={(isLoadingFirstQuestion && isFirstQuestion) || isStreaming}
                    sx={{
                      ...(isStreaming && {
                        backgroundColor: '#424242',
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#424242',
                        },
                        '&.Mui-disabled': {
                          backgroundColor: '#424242',
                          color: '#ffffff',
                        },
                      }),
                      ...(isEnding && !isStreaming && {
                        background: 'linear-gradient(135deg, #6750A4 0%, #7D5260 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #4F378B 0%, #633B48 100%)',
                        },
                      }),
                    }}
                    startIcon={getButtonIcon()}
                  >
                    {buttonText}
                  </ContinueButton>
                </Box>
              </Zoom>
            </CardContent>
          </StyledCard>
        </Fade>
      </Box>
    </Box>
  );
}; 
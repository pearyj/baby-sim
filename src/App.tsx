import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Routes, Route } from 'react-router-dom';
import './App.css'

import useGameStore from './stores/useGameStore'
import { useGameFlow } from './hooks/useGameFlow'
import logger from './utils/logger'
import { performanceMonitor } from './utils/performanceMonitor'
import { checkAllPrompts, testPromptGeneration } from './utils/promptChecker'
import { useEffect } from 'react'
import { ShareableEndingCard } from './components/ShareableEndingCard'
import { QuestionDisplay } from './features/game/QuestionDisplay'
import { FeedbackDisplay } from './features/game/FeedbackDisplay'
import { WelcomeScreen } from './pages/WelcomeScreen'
import { TimelineProvider } from './features/timeline/TimelineProvider'
import { Header } from './components/layout/Header'
import { InfoPage } from './pages/InfoPage'
import { StreamingTextDisplay } from './components/ui/StreamingTextDisplay'
import { PerformanceMonitor } from './components/dev/PerformanceMonitor'
import { DebugNumericalValues } from './components/dev/DebugNumericalValues'
import { FeedbackButton } from './components/ui/FeedbackButton'
import { AdTestPage } from './pages/AdTestPage'
import { PaymentTestPage } from './pages/PaymentTestPage'
import { PaymentSuccessPage } from './pages/PaymentSuccessPage'
import { GalleryPage } from './pages/GalleryPage';
import GalleryCarousel from './components/GalleryCarousel';
import { debugPrintActiveModel, isPremiumStyleActive } from './services/gptServiceUnified';
import { PaywallUI } from './components/payment/PaywallUI';
import { usePaymentStore } from './stores/usePaymentStore';
import { AgeImagePrompt } from './components/AgeImagePrompt';
import React from 'react';
import * as storageService from './services/storageService';

const MainContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  display: 'flex',
  flexDirection: 'column',
}));

const ContentArea = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  paddingTop: theme.spacing(8), // Account for fixed header
}));

const MainContentArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
});

const LoadingCard = styled(Card)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(5),
  margin: theme.spacing(2),
  maxWidth: 600,
  marginLeft: 'auto',
  marginRight: 'auto',
}));

const ErrorCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.palette.error.light,
  color: theme.palette.error.contrastText,
  padding: theme.spacing(3),
  maxWidth: 500,
  margin: 'auto',
}));

const EndingCard = styled(Card)(({ theme }) => ({
  background: `url('/endingbkgd.png')`,
  backgroundSize: 'cover',
  backgroundPosition: 'bottom center',
  backgroundRepeat: 'no-repeat',
  marginBottom: theme.spacing(3),
  color: '#5D4037',
  '& .MuiTypography-root': {
    color: '#5D4037',
  },
  '& .MuiChip-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: theme.palette.primary.main,
  },
}));

function App() {
  useGameFlow() // Initialize game flow logic
  const { t } = useTranslation();
  const [showLLMPaywall, setShowLLMPaywall] = React.useState(false);
  const [showGiveUpReminder, setShowGiveUpReminder] = React.useState(false);
  // const [isWaitingForPremiumCredit, setIsWaitingForPremiumCredit] = React.useState(false);
  
  // Determine if in development mode
  const isDevelopment = import.meta.env.DEV;

  // Check for secret test ending URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const secretTestEnding = urlParams.get('secretTestEnding') === 'yes';
  
  const {
    gamePhase,
    child,
    history,
    currentAge,
    currentQuestion,
    feedbackText,
    endingSummaryText,
    playerDescription,
    childDescription,
    storeIsLoading,
    error,
    selectOption,
    selectOptionStreaming,
    continueGame,
    resetToWelcome,
    testEnding,
    isStreaming,
    streamingContent,
    streamingType,
    enableStreaming,
    toggleStreaming,
    player,
    finance,
    marital,
    isSingleParent,
    shouldGenerateImage,
  } = useGameStore(state => ({
    gamePhase: state.gamePhase,
    player: state.player,
    child: state.child,
    history: state.history,
    currentAge: state.currentAge,
    currentQuestion: state.currentQuestion,
    feedbackText: state.feedbackText,
    endingSummaryText: state.endingSummaryText,
    playerDescription: state.playerDescription,
    childDescription: state.childDescription,
    storeIsLoading: state.isLoading,
    error: state.error,
    startGame: state.startGame,
    selectOption: state.selectOption,
    selectOptionStreaming: state.selectOptionStreaming,
    continueGame: state.continueGame,
    resetToWelcome: state.resetToWelcome,
    testEnding: state.testEnding,
    isStreaming: state.isStreaming,
    streamingContent: state.streamingContent,
    streamingType: state.streamingType,
    enableStreaming: state.enableStreaming,
    toggleStreaming: state.toggleStreaming,
    finance: state.finance,
    marital: state.marital,
    isSingleParent: state.isSingleParent,
    shouldGenerateImage: state.shouldGenerateImage,
  }))

  // Payment store for premium gating
  const { credits, email, fetchCredits, anonId, initializeAnonymousId } = usePaymentStore(state => ({
    credits: state.credits,
    email: state.email,
    fetchCredits: state.fetchCredits,
    anonId: state.anonId,
    initializeAnonymousId: state.initializeAnonymousId,
  }));

  // Secret test ending trigger - works in production
  useEffect(() => {
    if (secretTestEnding && gamePhase === 'uninitialized') {
      testEnding();
    }
  }, [secretTestEnding, gamePhase, testEnding]);

  // Suppress unused variable warnings for production-only variables
  // These are used in development mode but not in production
  if (import.meta.env.DEV) {
    // This ensures TypeScript knows these variables might be used in dev mode
    void toggleStreaming;
  }

  const isLoading = storeIsLoading || 
                    gamePhase === 'loading_question' || 
                    gamePhase === 'generating_outcome' || 
                    gamePhase === 'ending_game'; // Exclude 'initializing' as it has a special view

  // Derived booleans for rendering logic
  const isGamePlayPhase = gamePhase === 'playing' || gamePhase === 'loading_question'; // Question display or loading next question
  const isFeedbackPhase = gamePhase === 'feedback'; // Outcome received, showing feedback text.
  const isGeneratingOutcomePhase = gamePhase === 'generating_outcome';
  const isEndingPhase = gamePhase === 'ending_game' || gamePhase === 'summary'; // Ending summary display or generating it

  const hasStoryToShow = history && history.length > 0;
  const showTimeline = hasStoryToShow && (isGamePlayPhase || isFeedbackPhase || isGeneratingOutcomePhase || isEndingPhase);
  
  // Development-only prompt system test
  useEffect(() => {
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_ENABLE_PROMPT_TESTS === 'true'
    ) {
      checkAllPrompts();
      testPromptGeneration();
    }
  }, []);

  // Ensure payment anonId is initialized early so paywall flows work consistently
  useEffect(() => {
    try {
      if (!anonId && typeof initializeAnonymousId === 'function') {
        initializeAnonymousId();
      }
    } catch (_) {
      // ignore
    }
    // We intentionally run this once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Print active model and masked API key prefix in browser console (dev only)
  useEffect(() => {
    debugPrintActiveModel();
  }, []);

  // Check give up streak whenever entering welcome or when app mounts
  useEffect(() => {
    try {
      const streak = storageService.getGiveUpStreak();
      // Show reminder if user has given up/restarted 3 or more times consecutively
      if (streak >= 3 && (gamePhase === 'welcome' || gamePhase === 'uninitialized')) {
        setShowGiveUpReminder(true);
      }
    } catch (_) {
      // ignore
    }
  }, [gamePhase]);

  if (error && gamePhase !== 'welcome' && gamePhase !== 'playing' && gamePhase !== 'feedback') { // Show general error screen only if not in a phase that might have its own error display or content
    return (
      <MainContainer>
        <Box sx={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 2
        }}>
          <ErrorCard>
            <CardContent>
              <Typography variant="h6" sx={{ color: 'error.main', mb: 2 }}>
                {t('messages.error')}
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {error}
              </Typography>
              <Button
                onClick={(e) => { e.preventDefault(); resetToWelcome(); }}
                variant="contained"
                color="primary"
                fullWidth
              >
                {t('actions.restart')}
              </Button>
            </CardContent>
          </ErrorCard>
        </Box>
      </MainContainer>
    );
  }

  const renderMainContent = () => {
    return performanceMonitor.timeSync('render-main-content', 'ui', () => {
      if (gamePhase === 'initializing') {
        return (
          <LoadingCard>
            <CardContent>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                {t('intro.birthStory')}
              </Typography>
              
              {isStreaming && streamingType === 'initial' && streamingContent && (
                <Box sx={{ mt: 3, p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('intro.generatingSettings')}
                  </Typography>
                  <StreamingTextDisplay
                    content={streamingContent}
                    isStreaming={isStreaming}
                    isComplete={false}
                    showTypewriter={true}
                    placeholder={t('intro.generatingGameSettings')}
                    onStreamingStart={() => {
                      // Scroll to the top of the new content when initialization begins
                      const container = document.querySelector('.MuiCard-root');
                      if (container) {
                        setTimeout(() => {
                          container.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                            inline: 'nearest'
                          });
                        }, 50);
                      }
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </LoadingCard>
        );
      }

      if (gamePhase === 'uninitialized' || gamePhase === 'initialization_failed' || gamePhase === 'welcome') {
        // No longer need to determine action here, WelcomeScreen handles this
        return <WelcomeScreen onTestEnding={isDevelopment ? testEnding : undefined} />;
      }
      
      // Age image generation is now only triggered manually by user clicking the photo button
      // Remove automatic prompt display

      if (isEndingPhase) {
        return (
          <Container maxWidth="md" sx={{ py: 4 }}>
            <Fade in timeout={800}>
              <Box>
                {/* Show loading encouragement instead of shareable card while results are loading */}
                {isLoading && gamePhase === 'ending_game' ? (
                  <EndingCard elevation={3}>
                    <CardContent sx={{ p: 4 }}>
                      <Typography variant="h4" sx={{ 
                        textAlign: 'center', 
                        mb: 3, 
                        fontWeight: 600,
                        background: 'linear-gradient(45deg, #8D6E63 30%, #5D4037 90%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0px 2px 4px rgba(255, 255, 255, 0.3), 0px 4px 8px rgba(255, 255, 255, 0.2)',
                        filter: 'drop-shadow(0px 2px 4px rgba(255, 255, 255, 0.3))',
                      }}>
                        {t('messages.journeyComplete')}
                      </Typography>
                      
                      <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Chip 
                          label={t('messages.childGrownUp', { childName: child?.name || t('game.childName') })}
                          color="primary"
                          variant="outlined"
                          sx={{ fontSize: '1rem', py: 1 }}
                        />
                      </Box>
                      
                      <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Box sx={{ mb: 2 }}>
                          <CircularProgress size={30} />
                        </Box>
                        <Typography variant="h6" sx={{ 
                          mb: 2,
                          fontWeight: 500,
                          color: '#5D4037',
                          textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)',
                        }}>
                          {t('messages.generatingReport')}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          fontStyle: 'italic',
                          color: '#8D6E63',
                          mb: 2,
                          lineHeight: 1.6,
                          textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)',
                        }}>
                          {t('messages.reviewJourney', { childName: child?.name || t('game.childName') })}<br/>
                          {t('messages.analyzeDecisions')}<br/>
                          {t('messages.evaluateGrowth')}<br/>
                          {t('messages.lookToFuture', { childName: child?.name || t('game.childName') })}
                        </Typography>
                      </Box>
                    </CardContent>
                  </EndingCard>
                ) : (
                  <>
                    <ShareableEndingCard
                      childName={child?.name || t('game.childName')}
                      endingSummaryText={endingSummaryText || t('messages.endingComplete')}
                      playerDescription={playerDescription || undefined}
                      childDescription={childDescription || undefined}
                      gameState={player && child ? {
                        player,
                        child,
                        history,
                        playerDescription: playerDescription || '',
                        childDescription: childDescription || '',
                        finance,
                        marital,
                        isSingleParent,
                        pendingChoice: null,
                        currentQuestion: null,
                        feedbackText: null,
                        endingSummaryText: endingSummaryText || null
                      } : undefined}
                    />

                    {/* Carousel showing community images with custom heading */}
                    <Box sx={{ mt: 6 }}>
                      <GalleryCarousel
                        title={t('messages.shareCarouselHeading', {
                          childName: child?.name || t('game.childName'),
                        })}
                      />
                    </Box>
                    
                    <Box sx={{ mt: 5, textAlign: 'center' }}>
                      <Button
                        onClick={(e) => { e.preventDefault(); resetToWelcome(); }}
                        variant="contained"
                        size="large"
                        sx={{
                          py: 1.5,
                          fontSize: '1.1rem',
                          minWidth: 200,
                          background: 'linear-gradient(45deg, #8D6E63 30%, #5D4037 90%)',
                          color: '#fff',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #5D4037 30%, #3E2723 90%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 20px rgba(93, 64, 55, 0.4)',
                          },
                          '&:active': {
                            transform: 'translateY(0)',
                          },
                        }}
                      >
                        {t('actions.restartNewJourney')}
                      </Button>
                    </Box>
                  </>
                )}
              </Box>
            </Fade>
          </Container>
        );
      }

      if (isFeedbackPhase || isGeneratingOutcomePhase) {
          // Check if this is the initial feedback narrative (after initialization)
          const isInitialNarrative = history.length === 1 && (history[0].question === "游戏开始" || history[0].question === "Game Start");

          // Debug the continueGame function
          logger.info("Rendering FeedbackDisplay with:", {
            continueGameType: typeof continueGame,
            isFunction: typeof continueGame === 'function',
            gamePhase,
            isInitialNarrative,
            childName: child?.name
          });

          // Create a safe wrapper for continueGame with premium (ultra) gating on every GPT-5 call
          const safeContinue = async () => {
            const storeContinueGame = useGameStore.getState().continueGame;

            if (isPremiumStyleActive()) {
              // Refresh credits before gating
              try {
                if (!anonId && typeof initializeAnonymousId === 'function') {
                  initializeAnonymousId();
                }
                await fetchCredits();
              } catch (_) {}
              // Require email and at least 0.05 credits for GPT-5 interactions
              if (!email || typeof credits !== 'number' || credits < 0.05) {
                setShowLLMPaywall(true);
                return;
              }
            }

            if (typeof storeContinueGame === 'function') {
              storeContinueGame();
            } else {
              logger.error("continueGame from store is not a function:", storeContinueGame);
              window.location.reload();
            }
          };

          return (
            <FeedbackDisplay
              feedback={feedbackText || (isGeneratingOutcomePhase ? "" : "")}
              onContinue={safeContinue}
              isEnding={child?.age ? child.age >= 17 : false}
              isFirstQuestion={isInitialNarrative}
              isLoadingFirstQuestion={isInitialNarrative && isLoading}
              childName={child?.name || t('game.childName')}
              isStreaming={isStreaming && streamingType === 'outcome'}
              streamingContent={streamingContent}
              gameState={player && child ? {
                player,
                child,
                history,
                playerDescription: playerDescription || '',
                childDescription: childDescription || '',
                finance,
                marital,
                isSingleParent
              } : undefined}
              currentAge={currentAge}
            />
          );
      }

      if (isGamePlayPhase) {
        if (currentQuestion) {
          // Wrap selectOption to gate GPT-5 usage by credits
          const storeSelectOption = enableStreaming ? selectOptionStreaming : selectOption;
          const safeSelectOption = async (optionId: string) => {
            if (isPremiumStyleActive()) {
              // Refresh credits before gating
              try {
                if (!anonId && typeof initializeAnonymousId === 'function') {
                  initializeAnonymousId();
                }
                await fetchCredits();
              } catch (_) {}
              if (!email || typeof credits !== 'number' || credits < 0.05) {
                setShowLLMPaywall(true);
                return;
              }
            }
            await storeSelectOption(optionId);
          };
          return (
            <QuestionDisplay
              question={currentQuestion}
              onSelectOption={safeSelectOption}
              isLoading={false} 
              childName={child?.name || t('game.childName')}
              isStreaming={isStreaming && streamingType === 'question'}
              streamingContent={streamingContent}
            />
          );
        } else if (gamePhase === 'loading_question' && isLoading) { 
          // Show streaming content if available, otherwise show loading
          if (isStreaming && streamingType === 'question' && streamingContent) {
            return (
              <QuestionDisplay
                question={null} // Will be handled by the streaming display
                onSelectOption={async () => {}}
                isLoading={false}
                childName={child?.name || t('game.childName')}
                isStreaming={true}
                streamingContent={streamingContent}
              />
            );
          }
          
          return (
            <LoadingCard>
              <CardContent>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  {t('messages.gameInProgress')}
                </Typography>
              </CardContent>
            </LoadingCard>
          );
        }
      }
      
      if (isLoading) { 
          return (
            <LoadingCard>
              <CardContent>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  {t('actions.loading')}
                </Typography>
              </CardContent>
            </LoadingCard>
          );
      }

      return (
        <LoadingCard>
          <CardContent>
            <Typography variant="h6" color="text.secondary">
              {t('messages.gameStateUnclear', { gamePhase })}
            </Typography>
          </CardContent>
        </LoadingCard>
      );
    }, { gamePhase, isLoading });
  };

  return (
    <MainContainer>
      <Header />
      <ContentArea>
        <MainContentArea>
          <Routes>
            <Route path="/info" element={<InfoPage />} />
            {/* Add dedicated route for AdTestPage in development */} 
            {isDevelopment && <Route path="/ad-test-page" element={<AdTestPage />} />}
            <Route path="/test/payment" element={<PaymentTestPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/" element={
              <Container component="main" maxWidth="lg" sx={{ 
                px: { xs: 1, sm: 1.5 }, 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column' 
              }}>
                <Box sx={{ flex: 1 }} />
                <Box sx={{ py: 3, pb: 6, maxWidth: '48rem', mx: 'auto', width: '100%' }}>
                  {child?.name && showTimeline && (
                    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                      <Button
                        onClick={() => {
                          if (typeof resetToWelcome === 'function') {
                            resetToWelcome();
                          } else {
                            logger.error("resetToWelcome is not a function:", resetToWelcome);
                            window.location.reload();
                          }
                        }}
                        variant="outlined"
                        color="error"
                        size="small"
                        sx={{ borderRadius: 3 }}
                      >
                        {t('actions.giveUpAndRestart', { childName: child.name })}
                      </Button>
                    </Box>
                  )}
                  
                  {showTimeline && (
                    <TimelineProvider 
                      history={history}
                      currentAge={currentAge}
                      childGender={child?.gender || 'male'}
                      isVisible={true}
                      hideLatest={(isFeedbackPhase || isGeneratingOutcomePhase) && !(child?.age && child.age >= 17)} 
                    />
                  )}
                  
                  {renderMainContent()}
                </Box>
              </Container>
            } />
          </Routes>
        </MainContentArea>
      </ContentArea>
      <FeedbackButton />

      {/* Gentle reminder dialog for repeated give-ups */}
      <Dialog open={showGiveUpReminder} onClose={() => setShowGiveUpReminder(false)}>
        <DialogTitle>{t('gentleReminder.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {t('gentleReminder.body')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGiveUpReminder(false)} variant="contained">
            {t('gentleReminder.ok')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Show performance monitor in development mode */}
      {isDevelopment && <PerformanceMonitor />}
      
      {/* Show debug numerical values in development mode */}
      {isDevelopment && <DebugNumericalValues />}

      {/* Premium LLM paywall dialog */}
      {showLLMPaywall && (
        <PaywallUI
          open={showLLMPaywall}
          onClose={async () => {
            setShowLLMPaywall(false);
          }}
          childName={child?.name || t('game.childName')}
          mode="llm"
          onCreditsGained={() => {
            // Proceed automatically only if generation is waiting and user has just gained credits
            const storeContinueGame = useGameStore.getState().continueGame;
            if (typeof storeContinueGame === 'function') {
              storeContinueGame();
            }
          }}
        />
      )}
    </MainContainer>
  );
}

export default App
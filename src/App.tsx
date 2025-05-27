import { Header } from './components/layout/Header'
import { QuestionDisplay, FeedbackDisplay } from './features/game'
import { TimelineProvider } from './features/timeline'
import { WelcomeScreen, InfoPage } from './pages'
import { PerformanceMonitor } from './components/dev'
import { StreamingTextDisplay } from './components/ui/StreamingTextDisplay'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Fade
} from '@mui/material'
import { styled } from '@mui/material/styles'
import './App.css'

import useGameStore from './stores/useGameStore'
import { useGameFlow } from './hooks/useGameFlow'
import { logger } from './utils/logger'
import { performanceMonitor } from './utils/performanceMonitor'
import { checkAllPrompts, testPromptGeneration } from './utils/promptChecker'
import { useEffect } from 'react'
// Removed direct gptService and storageService imports
// Removed Question, GameState, GameStateToStore type imports from local files if not used by App.tsx directly

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
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.secondary.light} 100%)`,
  marginBottom: theme.spacing(3),
}));

function App() {
  useGameFlow() // Initialize game flow logic
  const { t } = useTranslation();
  
  // Determine if in development mode
  const isDevelopment = import.meta.env.DEV;

  const {
    gamePhase,
    child,
    history,
    currentAge,
    currentQuestion,
    feedbackText,
    endingSummaryText,
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
    toggleStreaming, // Used only in development mode
    showInfoModal,
    closeInfoModal,
  } = useGameStore(state => ({
    gamePhase: state.gamePhase,
    player: state.player,
    child: state.child,
    history: state.history,
    currentAge: state.currentAge,
    currentQuestion: state.currentQuestion,
    feedbackText: state.feedbackText,
    endingSummaryText: state.endingSummaryText,
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
    showInfoModal: state.showInfoModal,
    closeInfoModal: state.closeInfoModal,
  }))

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
    if (process.env.NODE_ENV === 'development') {
      checkAllPrompts();
      testPromptGeneration();
    }
  }, []);

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
      
      if (isEndingPhase) {
        return (
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Fade in timeout={500}>
              <EndingCard elevation={3}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h4" sx={{ 
                    textAlign: 'center', 
                    mb: 3, 
                    fontWeight: 600,
                    background: 'linear-gradient(45deg, #6750A4 30%, #7D5260 90%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
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
                  
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="body1" component="div" sx={{ lineHeight: 1.7 }}>
                      <ReactMarkdown>{endingSummaryText || (isLoading && gamePhase === 'ending_game' ? t('messages.endingGenerating') : t('messages.endingComplete'))}</ReactMarkdown>
                    </Typography>
                  </Box>
                  
                  {/* Show loading encouragement instead of restart button while results are loading */}
                  {isLoading && gamePhase === 'ending_game' ? (
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                      <Box sx={{ mb: 2 }}>
                        <CircularProgress size={30} />
                      </Box>
                      <Typography variant="h6" sx={{ 
                        mb: 2,
                        fontWeight: 500,
                        color: 'primary.main'
                      }}>
                        {t('messages.generatingReport')}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontStyle: 'italic',
                        color: 'text.secondary',
                        mb: 2,
                        lineHeight: 1.6
                      }}>
                        {t('messages.reviewJourney', { childName: child?.name || t('game.childName') })}<br/>
                        {t('messages.analyzeDecisions')}<br/>
                        {t('messages.evaluateGrowth')}<br/>
                        {t('messages.lookToFuture', { childName: child?.name || t('game.childName') })}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: 'primary.dark',
                        fontWeight: 500
                      }}>
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      
                      
                      <Button
                        onClick={(e) => { e.preventDefault(); resetToWelcome(); }}
                        variant="contained"
                        color="primary"
                        fullWidth
                        size="large"
                        sx={{ py: 1.5, fontSize: '1.1rem' }}
                      >
                        {t('actions.restartNewJourney')}
                      </Button>
                    </>
                  )}
                </CardContent>
              </EndingCard>
            </Fade>
          </Container>
        );
      }

      if (isFeedbackPhase || isGeneratingOutcomePhase) {
          // Check if this is the initial feedback narrative (after initialization)
          const isInitialNarrative = history.length === 1 && history[0].question === "游戏开始";
          
          // Debug the continueGame function
          logger.info("Rendering FeedbackDisplay with:", {
            continueGameType: typeof continueGame,
            isFunction: typeof continueGame === 'function',
            gamePhase,
            isInitialNarrative,
            childName: child?.name
          });
          
          // Create a safe wrapper for continueGame
          const safeContinue = () => {
            const storeContinueGame = useGameStore.getState().continueGame;
            if (typeof storeContinueGame === 'function') {
              storeContinueGame();
            } else {
              logger.error("continueGame from store is not a function:", storeContinueGame);
              // Fallback behavior: we could reload or go to welcome screen
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
            />
          );
      }

      if (isGamePlayPhase) {
        if (currentQuestion) {
          return (
            <QuestionDisplay
              question={currentQuestion}
              onSelectOption={enableStreaming ? selectOptionStreaming : selectOption}
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
        </MainContentArea>
      </ContentArea>
      
      {/* Show performance monitor in development mode */}
      {isDevelopment && <PerformanceMonitor autoRefresh={true} />}
      
      {/* Info Modal */}
      <InfoPage open={showInfoModal} onClose={closeInfoModal} />
    </MainContainer>
  );
}

export default App
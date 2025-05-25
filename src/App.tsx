import { Header } from './components/Header'
import { QuestionDisplay } from './components/QuestionDisplay'
import { FeedbackDisplay } from './components/FeedbackDisplay'
import { TimelineProvider } from './components/TimelineProvider'
import { WelcomeScreen } from './pages'
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
    continueGame,
    resetToWelcome,
    testEnding,
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
    continueGame: state.continueGame,
    resetToWelcome: state.resetToWelcome,
    testEnding: state.testEnding,
  }))

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
                发生错误
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
                重新开始游戏
              </Button>
            </CardContent>
          </ErrorCard>
        </Box>
      </MainContainer>
    );
  }

  const renderMainContent = () => {
    if (gamePhase === 'initializing') {
      return (
        <LoadingCard>
          <CardContent>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" color="text.secondary">
              经过3亿个精子的激烈角逐，数十个卵泡中的艰难竞争，再加上漫长而艰辛的十月怀胎，你家娃终于决定降临人间，准备向你发起最甜蜜又最痛苦的挑战了！
            </Typography>
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
                  养育之旅圆满结束
                </Typography>
                
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Chip 
                    label={`${child?.name || '你的孩子'} 已经长大成人，18岁了`}
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '1rem', py: 1 }}
                  />
                </Box>
                
                <Box sx={{ mb: 4 }}>
                  <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                    <ReactMarkdown>{endingSummaryText || (isLoading && gamePhase === 'ending_game' ? "结局生成中..." : "结局回顾完毕。")}</ReactMarkdown>
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
                      正在为你生成专属的结局报告...
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      mb: 2,
                      lineHeight: 1.6
                    }}>
                      回顾你与{child?.name || '孩子'}一起度过的18年时光<br/>
                      分析每一个重要的养育决定<br/>
                      评价你作为父母的成长历程<br/>
                      展望{child?.name || '孩子'}的美好未来
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'primary.dark',
                      fontWeight: 500
                    }}>
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ 
                      textAlign: 'center', 
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      mb: 3
                    }}>
                      感谢你参与这段养育的旅程
                    </Typography>
                    
                    <Button
                      onClick={(e) => { e.preventDefault(); resetToWelcome(); }}
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      sx={{ py: 1.5, fontSize: '1.1rem' }}
                    >
                      重新开始新的养育之旅
                    </Button>
                  </>
                )}
              </CardContent>
            </EndingCard>
          </Fade>
        </Container>
      );
    }

    if (isFeedbackPhase) {
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
            feedback={feedbackText || (isGeneratingOutcomePhase ? "正在分析你的选择..." : "")}
            onContinue={safeContinue}
            isEnding={child?.age ? child.age >= 17 : false}
            isFirstQuestion={isInitialNarrative}
            isLoadingFirstQuestion={isInitialNarrative && isLoading}
            childName={child?.name || ''}
          />
        );
    }

    if (isGamePlayPhase || isGeneratingOutcomePhase) {
      if (currentQuestion) {
        return (
          <QuestionDisplay
            question={currentQuestion}
            onSelectOption={selectOption}
            isLoading={isGeneratingOutcomePhase} 
            childName={child?.name || '孩子'}
          />
        );
      } else if (gamePhase === 'loading_question' && isLoading) { 
        return (
          <LoadingCard>
            <CardContent>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                你的养育之旅开始了...
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
                加载中...
              </Typography>
            </CardContent>
          </LoadingCard>
        );
    }

    return (
      <LoadingCard>
        <CardContent>
          <Typography variant="h6" color="text.secondary">
            请稍候，游戏状态 ({gamePhase}) 未明确处理。
          </Typography>
        </CardContent>
      </LoadingCard>
    );
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
                    放弃{child.name}，重新开始
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
    </MainContainer>
  );
}

export default App
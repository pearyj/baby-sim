import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Stack,
  Fade,
  Container
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { PlayArrow, Refresh, Psychology, Timeline, AutoAwesome } from '@mui/icons-material';
import useGameStore from '../stores/useGameStore';
import { loadState } from '../services/storageService';
import type { InitialStateType } from '../services/gptService';
import { logger } from '../utils/logger';

interface WelcomeScreenProps {
  onStartLoading?: () => void;
  onTestEnding?: () => void;
}

const WelcomeCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
  marginBottom: theme.spacing(3),
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.light}10 0%, ${theme.palette.secondary.light}10 100%)`,
  border: `1px solid ${theme.palette.primary.light}30`,
  marginBottom: theme.spacing(2),
}));

const SavedGameCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.warning.light}15 0%, ${theme.palette.info.light}15 100%)`,
  border: `1px solid ${theme.palette.warning.light}`,
  marginBottom: theme.spacing(3),
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1.5, 4),
  fontSize: '1.125rem',
  fontWeight: 600,
  textTransform: 'none',
  minHeight: 56,
  marginBottom: theme.spacing(2),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
  },
}));

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onTestEnding }) => {
  // In Vite, use import.meta.env.DEV for development mode check
  const isDevelopment = import.meta.env.DEV;
  
  // Add state for special requirements input
  const [specialRequirements, setSpecialRequirements] = useState('');
  
  // Get player and child data to check if we have a saved game
  const { gamePhase, initializeGame, continueSavedGame, resetToWelcome } = useGameStore(state => ({
    player: state.player,
    child: state.child,
    gamePhase: state.gamePhase,
    initializeGame: state.initializeGame,
    continueSavedGame: state.continueSavedGame,
    resetToWelcome: state.resetToWelcome,
  }));
  
  // Check localStorage directly to determine if there's a saved game
  // This ensures we're getting the most up-to-date state
  const savedState = loadState();
  const hasSavedGame = savedState !== null && savedState.player && savedState.child;
  
  logger.info("Welcome screen - Game phase:", gamePhase, "Has saved game:", hasSavedGame);

  // Handle starting a new game
  const handleStartNewGame = async () => {
    if (!specialRequirements) {
      try {
        logger.info("No special requirements, fetching pre-generated states...");
        const response = await fetch('/pregenerated_states.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch pregenerated_states.json: ${response.statusText}`);
        }
        const states: InitialStateType[] = await response.json();
        if (states && states.length > 0) {
          const randomIndex = Math.floor(Math.random() * states.length);
          const selectedState = states[randomIndex];
          logger.info("Selected pre-generated state:", selectedState);
          initializeGame({ preloadedState: selectedState });
        } else {
          logger.warn("No pre-generated states found or array is empty, falling back to default generation.");
          initializeGame({}); // Fallback to default generation without special requirements
        }
      } catch (error) {
        logger.error("Error fetching or using pre-generated states:", error);
        // Fallback to default generation in case of error
        initializeGame({}); 
      }
    } else {
      logger.info("Starting a new game with special requirements:", specialRequirements);
      initializeGame({ specialRequirements: specialRequirements });
    }
  };

  // New handler for the "Start New Game" button when a saved game exists
  const handleResetAndShowNewGameScreen = () => {
    if (resetToWelcome) {
      resetToWelcome(); // This clears localStorage and resets store state
    }
    setSpecialRequirements(''); // Clear the special requirements input field
    // The component will re-render, and since hasSavedGame will be false,
    // it will show the default new game screen.
  };

  // Handle continuing a saved game
  const handleContinueSavedGame = () => {
    logger.info("Continuing saved game");
    continueSavedGame();
  };

  // Special requirements input field
  const renderSpecialRequirementsInput = () => (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
        特殊要求（可选）
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder="我想养个邻居家的孩子"
        value={specialRequirements}
        onChange={(e) => setSpecialRequirements(e.target.value)}
        variant="outlined"
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        您可以描述具体的想要的关于自己和娃的背景和特点，AI将尽量满足您的要求。（当然，养娃和AI一样，是个玄学……）
      </Typography>
      <Typography variant="body1">
        准备好开始这段充满挑战与惊喜的养育之旅了吗？
      </Typography>
    </Box>
  );

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Fade in timeout={500}>
        <WelcomeCard elevation={3}>
          <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
            
            {hasSavedGame ? (
              <SavedGameCard elevation={2}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Timeline sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'warning.main' }}>
                      发现已保存的游戏进度
                    </Typography>
                  </Box>
                  
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    您好！我们发现您有一个进行中的游戏：
                  </Typography>
                  
                  <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip 
                        label={savedState?.child?.gender === 'male' ? '男孩' : '女孩'} 
                        color="primary" 
                        size="small" 
                      />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {savedState?.child?.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        当前年龄: {savedState?.child?.age} 岁
                      </Typography>
                    </Stack>
                  </Card>
                  
                  <Typography variant="body1">
                    您可以继续这个游戏，或者开始一个全新的游戏。
                  </Typography>
                </CardContent>
              </SavedGameCard>
            ) : (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ 
                  textAlign: 'center', 
                  mb: 3, 
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #6750A4 30%, #7D5260 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  养娃模拟器
                </Typography>
                
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 4, color: 'text.secondary' }}>
                  一个模拟从孩子出生到成年的养育历程的游戏
                </Typography>
                
                <FeatureCard elevation={1}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Psychology sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        游戏介绍
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      在这个游戏中，你将扮演一位父亲或母亲，从孩子出生开始，一直陪伴他/她成长到18岁。
                    </Typography>
                    <Typography variant="body1">
                      每一年，你都将面临各种养育抉择，你的选择将深刻影响孩子的性格、兴趣和未来发展方向。
                    </Typography>
                  </CardContent>
                </FeatureCard>
                
                <FeatureCard elevation={1}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AutoAwesome sx={{ mr: 1, color: 'secondary.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                        游戏特点
                      </Typography>
                    </Box>
                    <List dense>
                      <ListItem disablePadding>
                        <ListItemText primary="AI生成的角色背景、养育情境和故事线" />
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemText primary="每个决定都会影响娃的成长路径" />
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemText primary="时间轴记录你的养育历程，直到18岁送娃成人" />
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemText primary="查看娃的成长经历和自己是个什么样的父母" />
                      </ListItem>
                    </List>
                  </CardContent>
                </FeatureCard>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body1">
                    点击开始游戏，随机生成一位父亲/母亲的角色，以及娃的基本信息。
                  </Typography>
                </Alert>
                
                {renderSpecialRequirementsInput()}
              </Box>
            )}
            
            <Stack spacing={2}>
              {hasSavedGame ? (
                <>
                  <ActionButton
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleContinueSavedGame}
                    startIcon={<PlayArrow />}
                  >
                    继续游戏
                  </ActionButton>
                  
                  <ActionButton
                    fullWidth
                    variant="outlined"
                    color="error"
                    onClick={handleResetAndShowNewGameScreen}
                    startIcon={<Refresh />}
                  >
                    开始新游戏
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleStartNewGame}
                  startIcon={<PlayArrow />}
                >
                  开始游戏
                </ActionButton>
              )}

              {isDevelopment && onTestEnding && (
                <Button
                  fullWidth
                  variant="text"
                  color="secondary"
                  onClick={onTestEnding}
                  size="small"
                  sx={{ mt: 2 }}
                >
                  (Dev) Test Ending Page
                </Button>
              )}
            </Stack>
          </CardContent>
        </WelcomeCard>
      </Fade>
    </Container>
  );
}; 
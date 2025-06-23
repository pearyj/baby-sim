import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
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
import { useTranslation } from 'react-i18next';
import useGameStore from '../stores/useGameStore';
import { loadState } from '../services/storageService';
import type { InitialStateType } from '../services/gptServiceUnified';
import logger from '../utils/logger';
import pregenStatesZh from '../i18n/pregen/zh.json';
import pregenStatesEn from '../i18n/pregen/en.json';
import { track } from '@vercel/analytics';
import { useNavigate } from 'react-router-dom';

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  
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
    track('Game Started')
    if (!specialRequirements) {
      try {
        logger.info("No special requirements, loading pre-generated states...");
        
        // Get current language from i18n
        const currentLanguage = t('language.code'); // This should return 'zh' or 'en'
        
        // Select the appropriate pre-generated states based on language
        let states: InitialStateType[];
        let fallbackUsed = false;
        
        if (currentLanguage === 'zh') {
          states = pregenStatesZh as InitialStateType[];
          logger.info("Using Chinese pre-generated states");
        } else if (currentLanguage === 'en') {
          // Check if English states have actual content (not just placeholders)
          const hasRealContent = pregenStatesEn.some(state => 
            !state.playerDescription.includes('[English translation needed]')
          );
          
          if (hasRealContent) {
            states = pregenStatesEn as InitialStateType[];
            logger.info("Using English pre-generated states");
          } else {
            // Fallback to Chinese if English only has placeholders
            states = pregenStatesZh as InitialStateType[];
            fallbackUsed = true;
            logger.info("English states not ready, falling back to Chinese states");
          }
        } else {
          // Default fallback to Chinese for any other language
          states = pregenStatesZh as InitialStateType[];
          fallbackUsed = true;
          logger.info(`Unknown language ${currentLanguage}, falling back to Chinese states`);
        }
        
        // Final fallback to fetch original file if imported states are empty or invalid
        if (!states || states.length === 0) {
          logger.warn("Imported states are empty, falling back to original pregenerated_states.json");
          const response = await fetch('/pregenerated_states.json');
          if (!response.ok) {
            throw new Error(`Failed to fetch pregenerated_states.json: ${response.statusText}`);
          }
          states = await response.json();
          fallbackUsed = true;
        }
        
        if (states && states.length > 0) {
          const randomIndex = Math.floor(Math.random() * states.length);
          const selectedState = states[randomIndex];
          logger.info("Selected pre-generated state:", selectedState, fallbackUsed ? "(using fallback)" : "");
          initializeGame({ preloadedState: selectedState });
        } else {
          logger.warn("No pre-generated states found or array is empty, falling back to default generation.");
          initializeGame({}); // Fallback to default generation without special requirements
        }
      } catch (error) {
        logger.error("Error loading or using pre-generated states:", error);
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
        {t('welcome.specialRequirements')}
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder={t('welcome.specialRequirementsPlaceholder')}
        value={specialRequirements}
        onChange={(e) => setSpecialRequirements(e.target.value)}
        variant="outlined"
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('welcome.specialRequirementsDesc')}
      </Typography>
      <Typography variant="body1">
        {t('welcome.readyToStart')}
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
                      {t('welcome.savedGameFound')}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    {t('welcome.savedGameGreeting')}
                  </Typography>
                  
                  <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip 
                        label={savedState?.child?.gender === 'male' ? t('game.boy') : t('game.girl')} 
                        color="primary" 
                        size="small" 
                      />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {savedState?.child?.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('welcome.currentAge', { age: savedState?.child?.age })}
                      </Typography>
                    </Stack>
                  </Card>
                  
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {t('welcome.continueOrNew')}
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
                  {t('welcome.title')}
                </Typography>
                
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 4, color: 'text.secondary' }}>
                  {t('welcome.subtitle')}
                </Typography>
                
                <FeatureCard elevation={1}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Psychology sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {t('welcome.gameIntro')}
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {t('welcome.gameIntroText1')}
                    </Typography>
                    <Typography variant="body1">
                      {t('welcome.gameIntroText2')}
                    </Typography>
                  </CardContent>
                </FeatureCard>
                
                <FeatureCard elevation={1}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AutoAwesome sx={{ mr: 1, color: 'secondary.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                        {t('welcome.gameFeatures')}
                      </Typography>
                    </Box>
                    <List dense>
                      <ListItem disablePadding>
                        <ListItemText primary={t('welcome.feature1')} />
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemText primary={t('welcome.feature2')} />
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemText primary={t('welcome.feature3')} />
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemText primary={t('welcome.feature4')} />
                      </ListItem>
                    </List>
                  </CardContent>
                </FeatureCard>
                
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
                    {t('actions.continueGame')}
                  </ActionButton>
                  
                  <ActionButton
                    fullWidth
                    variant="outlined"
                    color="error"
                    onClick={handleResetAndShowNewGameScreen}
                    startIcon={<Refresh />}
                  >
                    {t('actions.startNewGame')}
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
                  {t('actions.startGame')}
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
                  {t('actions.testEnding')}
                </Button>
              )}
              {isDevelopment && (
                <Button
                  fullWidth
                  variant="text"
                  color="info"
                  onClick={() => navigate('/ad-test-page')}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('actions.testAdTimeline')}
                </Button>
              )}
              {isDevelopment && (
                <Button
                  fullWidth
                  variant="text"
                  color="info"
                  onClick={() => navigate('/payment-test-page')}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('actions.testPayment')}
                </Button>
              )}
            </Stack>
          </CardContent>
        </WelcomeCard>
      </Fade>
    </Container>
  );
}; 
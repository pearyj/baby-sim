import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
  List,
  ListItem,
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
import pregenStatesJa from '../i18n/pregen/ja.json';
import pregenStatesEs from '../i18n/pregen/es.json';
import { track } from '@vercel/analytics';
import { useNavigate } from 'react-router-dom';
import { setGameStyle as setGPTGameStyle } from '../services/gptServiceUnified';
import { initSession } from '../services/eventLogger';
import { usePaymentStore } from '../stores/usePaymentStore';
import GalleryCarousel from '../components/GalleryCarousel';

interface WelcomeScreenProps {
  onStartLoading?: () => void;
  onTestEnding?: () => void;
}

const WelcomeCard = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  boxShadow: '0 12px 40px rgba(30, 30, 30, 0.08)',
  marginBottom: theme.spacing(3),
  borderRadius: 24,
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.5)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 107, 53, 0.15)',
  boxShadow: '0 4px 20px rgba(255, 107, 53, 0.06)',
  marginBottom: theme.spacing(2),
  borderRadius: 16,
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 28px rgba(255, 107, 53, 0.12)',
    border: '1px solid rgba(255, 107, 53, 0.25)',
  },
}));

const SavedGameCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(224, 159, 62, 0.12) 0%, rgba(255, 185, 151, 0.12) 100%)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(224, 159, 62, 0.3)',
  boxShadow: '0 8px 24px rgba(224, 159, 62, 0.1)',
  marginBottom: theme.spacing(3),
  borderRadius: 20,
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: 24,
  padding: theme.spacing(1.5, 4),
  fontSize: '1.125rem',
  fontWeight: 600,
  textTransform: 'none',
  minHeight: 56,
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)',
  boxShadow: '0 4px 16px rgba(255, 107, 53, 0.3)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 24px rgba(255, 107, 53, 0.4)',
    background: 'linear-gradient(135deg, #FF8A5B 0%, #FF6B35 100%)',
  },
  '&:active': {
    transform: 'translateY(-1px)',
  },
}));

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onTestEnding }) => {
  // In Vite, use import.meta.env.DEV for development mode check
  const isDevelopment = import.meta.env.DEV;
  
  // Check for secret test ending URL parameter for production debugging
  const urlParams = new URLSearchParams(window.location.search);
  const secretTestEnding = urlParams.get('secretTestEnding') === 'yes';
  const showTestButtons = isDevelopment || secretTestEnding;
  
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  // Add state for special requirements input
  const [specialRequirements, setSpecialRequirements] = useState('');
  
  // ─────────────────────────────────────────────
  // Game style selection state
  // ─────────────────────────────────────────────
  type GameStyle = 'realistic' | 'fantasy' | 'cool' | 'ultra';
  const defaultStyle: GameStyle = 'realistic';
  const [gameStyle, setGameStyle] = useState<GameStyle>(defaultStyle);

  // Persisted style key (must match gptServiceUnified)
  const GAME_STYLE_STORAGE_KEY = 'childSimGameStyle';
  // On mount, load persisted style if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GAME_STYLE_STORAGE_KEY);
      if (raw === 'realistic' || raw === 'fantasy' || raw === 'cool' || raw === 'ultra') {
        setGameStyle(raw as GameStyle);
      }
    } catch (_) {
      // ignore read failures
    }
  }, []);
  // Whenever selection changes, persist it immediately so refresh retains it pre-start
  useEffect(() => {
    try {
      localStorage.setItem(GAME_STYLE_STORAGE_KEY, gameStyle);
    } catch (_) {
      // ignore write failures
    }
  }, [gameStyle]);
  
  // ────────────────────────────────────────────
  // Parent Gender Selection (mom/dad/non-binary/random)
  // ────────────────────────────────────────────
  type ParentGenderOption = 'random' | 'male' | 'female' | 'nonBinary';
  const [parentGender, setParentGender] = useState<ParentGenderOption>('random');
  
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

  const {
    anonId,
    setKidId,
    initializeAnonymousId,
  } = usePaymentStore(state => ({ 
    anonId: state.anonId, 
    setKidId: state.setKidId, 
    initializeAnonymousId: state.initializeAnonymousId,
  }));

  // Handle starting a new game
  const handleStartNewGame = async () => {
    // Ensure we have an anonymous ID before starting the session so that
    // all subsequent choice events are properly logged.
    let currentAnonId = anonId;
    if (!currentAnonId) {
      initializeAnonymousId();
      currentAnonId = usePaymentStore.getState().anonId;
    }

    // Create a new kidId for this run
    const kidId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
    setKidId(kidId);

    // Initialise session row in the database and wait for completion so that
    // subsequent choice events & flag updates are guaranteed to have a matching row.
    if (currentAnonId) {
      try {
        await initSession(currentAnonId, kidId, gameStyle, specialRequirements || null, { lang: i18n.language });
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[WelcomeScreen] initSession failed (non-blocking)', e);
        }
      }
    }
    // Pass selected game style to GPT service
    setGPTGameStyle(gameStyle);
    track('Game Started');
    if (!specialRequirements) {
      try {
        logger.info("No special requirements, loading pre-generated states...");
        
        // Get current language from i18n
        const currentLanguage = t('language.code'); // This should return 'zh', 'en', 'ja', or 'es'
        
        // Select the appropriate pre-generated states based on language
        let states: InitialStateType[];
        let fallbackUsed = false;
        
        if (currentLanguage === 'zh') {
          states = pregenStatesZh as InitialStateType[];
          logger.info("Using Chinese pre-generated states");
        } else if (currentLanguage === 'ja') {
          states = pregenStatesJa as InitialStateType[];
          logger.info("Using Japanese pre-generated states");
        } else if (currentLanguage === 'es') {
          states = pregenStatesEs as InitialStateType[];
          logger.info("Using Spanish pre-generated states");
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
          // Default fallback to English for any other language
          states = pregenStatesEn as InitialStateType[];
          fallbackUsed = true;
          logger.info(`Unknown language ${currentLanguage}, falling back to English states`);
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
        
        // Filter states by selected parent gender if applicable (male, female, nonBinary)
        let filteredStates = states;
        if (parentGender !== 'random') {
          filteredStates = states.filter(s => s.player.gender === parentGender);
        }

        if (filteredStates && filteredStates.length > 0) {
          const randomIndex = Math.floor(Math.random() * filteredStates.length);
          const selectedState = filteredStates[randomIndex];
          logger.info("Selected pre-generated state:", selectedState, fallbackUsed ? "(using fallback)" : "");
          initializeGame({ preloadedState: selectedState });
        } else {
          logger.warn("No pre-generated states found or array is empty, falling back to dynamic generation.");

          // If the user explicitly chose a parent gender, pass it as a special requirement so the LLM respects it.
          let genderRequirement: string | undefined;
          if (parentGender === 'male') {
            genderRequirement = 'The parent is a father.';
          } else if (parentGender === 'female') {
            genderRequirement = 'The parent is a mother.';
          } else if (parentGender === 'nonBinary') {
            genderRequirement = 'The parent is a non-binary caregiver.';
          }

          if (genderRequirement) {
            initializeGame({ specialRequirements: genderRequirement });
          } else {
            initializeGame({});
          }
        }
      } catch (error) {
        logger.error("Error loading or using pre-generated states:", error);
        // Fallback to default generation in case of error
        initializeGame({}); 
      }
    } else {
      // Combine gender requirement (if any) with user-entered special requirements
      const requirementsParts: string[] = [];
      if (parentGender !== 'random') {
        if (parentGender === 'male') requirementsParts.push('The parent is a father.');
        else if (parentGender === 'female') requirementsParts.push('The parent is a mother.');
        else if (parentGender === 'nonBinary') requirementsParts.push('The parent is a non-binary caregiver.');
      }
      if (specialRequirements.trim()) {
        requirementsParts.push(`Special requirements: ${specialRequirements.trim()}`);
      }
      const combinedRequirements = requirementsParts.join(' ');
      logger.info("Starting a new game with combined special requirements:", combinedRequirements);
      initializeGame({ specialRequirements: combinedRequirements });
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
    <Container 
      maxWidth="md" 
      sx={{ 
        py: 1.5,
        px: { xs: 1, sm: 3 }, // Tighter horizontal padding on mobile
      }}
    >
      <Fade in timeout={500}>
        <WelcomeCard elevation={3}>
          <CardContent sx={{ p: { xs: 2, sm: 4, md: 5 } }}>
            
            {hasSavedGame ? (
              <SavedGameCard elevation={2}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Timeline sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'warning.main' }}>
                      {t('welcome.savedGameFound')}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" sx={{ mb: 3 }}>
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
                  
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {t('welcome.continueOrNew')}
                  </Typography>
                </CardContent>
              </SavedGameCard>
            ) : (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ 
                  textAlign: 'center', 
                  mb: 2, 
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #FF6B35 0%, #E09F3E 50%, #FF6B35 100%)',
                  backgroundSize: '200% auto',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'gradient-shift 4s ease infinite',
                }}>
                  {t('welcome.title')}
                </Typography>
                
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1.5, color: 'text.secondary' }}>
                  {t('welcome.subtitle')}
                </Typography>

                {/* Game Introduction */}
                <FeatureCard elevation={1} sx={{ mt: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Psychology sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {t('welcome.gameIntro')}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 2, textAlign: 'left' }}>
                      {t('welcome.gameIntroText1')}
                    </Typography>
                    <Typography variant="body2" sx={{ textAlign: 'left' }}>
                      {t('welcome.gameIntroText2')}
                    </Typography>
                  </CardContent>
                </FeatureCard>
                
                <FeatureCard elevation={1} sx={{ mt: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AutoAwesome sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {t('welcome.gameFeatures')}
                      </Typography>
                    </Box>
                    <List dense>
                      <ListItem disablePadding>
                        <Typography variant="body2" sx={{ mb: 1, textAlign: 'left' }}>
                          {t('welcome.feature1')}
                        </Typography>
                      </ListItem>
                      <ListItem disablePadding>
                        <Typography variant="body2" sx={{ mb: 1, textAlign: 'left' }}>
                          {t('welcome.feature2')}
                        </Typography>
                      </ListItem>
                      <ListItem disablePadding>
                        <Typography variant="body2" sx={{ mb: 1, textAlign: 'left' }}>
                          {t('welcome.feature3')}
                        </Typography>
                      </ListItem>
                      <ListItem disablePadding>
                        <Typography variant="body2" sx={{ mb: 1, textAlign: 'left' }}>
                          {t('welcome.feature4')}
                        </Typography>
                      </ListItem>
                       <ListItem disablePadding>
                         <Typography variant="body2" sx={{ mb: 1, textAlign: 'left' }}>
                           {t('welcome.feature5')}
                         </Typography>
                       </ListItem>
                    </List>
                  </CardContent>
                </FeatureCard>

                {/* Proud Kids Gallery Carousel */}
                <FeatureCard elevation={1} sx={{ mt: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <GalleryCarousel />
                  </CardContent>
                </FeatureCard>

                {/* Parent Gender Selection */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, textAlign: 'center', color: 'primary.main' }}>
                    {t('welcome.selectParentGender')}
                  </Typography>
                  <Stack direction="row" spacing={{ xs: 1, sm: 2 }} justifyContent="center" sx={{ mb: 3, flexWrap: 'wrap' }}>
                    <Button
                      key="random"
                      variant={parentGender === 'random' ? 'contained' : 'outlined'}
                      color={parentGender === 'random' ? 'primary' : 'inherit'}
                      onClick={() => setParentGender('random')}
                      sx={{ 
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        borderRadius: { xs: '12px', sm: '8px' },
                        px: { xs: 1.5, sm: 2 }
                      }}
                    >
                      {t('welcome.parentGenderRandom')}
                    </Button>
                    <Button
                      key="female"
                      variant={parentGender === 'female' ? 'contained' : 'outlined'}
                      color={parentGender === 'female' ? 'primary' : 'inherit'}
                      onClick={() => setParentGender('female')}
                      sx={{ 
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        borderRadius: { xs: '12px', sm: '8px' },
                        px: { xs: 1.5, sm: 2 }
                      }}
                    >
                      {t('welcome.parentGenderMom')}
                    </Button>
                    <Button
                      key="male"
                      variant={parentGender === 'male' ? 'contained' : 'outlined'}
                      color={parentGender === 'male' ? 'primary' : 'inherit'}
                      onClick={() => setParentGender('male')}
                      sx={{ 
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        borderRadius: { xs: '12px', sm: '8px' },
                        px: { xs: 1.5, sm: 2 }
                      }}
                    >
                      {t('welcome.parentGenderDad')}
                    </Button>
                    {/* Show non-binary option for all languages */}
                    <Button
                      key="nonBinary"
                      variant={parentGender === 'nonBinary' ? 'contained' : 'outlined'}
                      color={parentGender === 'nonBinary' ? 'primary' : 'inherit'}
                      onClick={() => setParentGender('nonBinary')}
                      sx={{ 
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        borderRadius: { xs: '12px', sm: '8px' },
                        px: { xs: 1.5, sm: 2 }
                      }}
                    >
                      {t('welcome.parentGenderNonBinary')}
                    </Button>
                  </Stack>
                </Box>
                
                {/* Game Style Selection */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, textAlign: 'center', color: 'primary.main' }}>
                    {t('actions.chooseGameStyle')}
                  </Typography>

                  {/* Highlighted premium option on its own line */}
                  <Stack direction="row" spacing={{ xs: 1, sm: 2 }} justifyContent="center" sx={{ mb: 2 }}>
                    <Button
                      key="ultra"
                      variant={gameStyle === 'ultra' ? 'contained' : 'outlined'}
                      color={gameStyle === 'ultra' ? 'primary' : 'inherit'}
                      onClick={() => setGameStyle('ultra')}
                      sx={{ 
                        fontSize: { xs: '0.9rem', sm: '1rem' },
                        fontWeight: 800,
                        borderRadius: { xs: '14px', sm: '10px' },
                        px: { xs: 2, sm: 2.5 },
                        py: { xs: 1, sm: 1.2 }
                      }}
                    >
                      {t('gameStyle.ultra')}
                    </Button>
                  </Stack>

                  {/* Other options on a separate line */}
                  <Stack direction="row" spacing={{ xs: 1, sm: 2 }} justifyContent="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
                    {(['realistic', 'fantasy', 'cool'] as GameStyle[]).map(style => (
                      <Button
                        key={style}
                        variant={gameStyle === style ? 'contained' : 'outlined'}
                        color={gameStyle === style ? 'primary' : 'inherit'}
                        onClick={() => setGameStyle(style)}
                        sx={{ 
                          fontSize: { xs: '0.8rem', sm: '0.875rem' },
                          borderRadius: { xs: '12px', sm: '8px' },
                          px: { xs: 1.5, sm: 2 }
                        }}
                      >
                        {t(`gameStyle.${style}`)}
                      </Button>
                    ))}
                  </Stack>

                  {gameStyle === 'ultra' && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: -1, mb: 2 }}>
                      {t('gameStyle.ultraExplanation')}
                    </Typography>
                  )}
                </Box>
                
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

              {showTestButtons && onTestEnding && (
                <Button
                  fullWidth
                  variant="text"
                  color="secondary"
                  onClick={onTestEnding}
                  size="small"
                  sx={{ mt: 2 }}
                >
                  {secretTestEnding ? '🔍 Secret Test Ending (Production Debug)' : t('actions.testEnding')}
                </Button>
              )}
              {showTestButtons && (
                <Button
                  fullWidth
                  variant="text"
                  color="info"
                  onClick={() => navigate('/ad-test-page')}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {secretTestEnding ? '🔍 Secret Ad Test (Production Debug)' : t('actions.testAdTimeline')}
                </Button>
              )}
              {showTestButtons && (
                <Button
                  fullWidth
                  variant="text"
                  color="info"
                  onClick={() => navigate('/payment-test-page')}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {secretTestEnding ? '🔍 Secret Payment Test (Production Debug)' : t('actions.testPayment')}
                </Button>
              )}
            </Stack>
          </CardContent>
        </WelcomeCard>
      </Fade>
    </Container>
  );
}; 
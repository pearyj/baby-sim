// ────────────────────────────────────────────────────────────────────────────────
// |                                   TYPES                                        |
// ────────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
// import { persist, createJSONStorage } from 'zustand/middleware'; // Removed unused import
import * as gptService from '../services/gptServiceUnified';
import type { InitialStateType } from '../services/gptServiceUnified'; // Ensured type-only import
import * as storageService from '../services/storageService';
import type { GameState as ApiGameState, Player, Child, HistoryEntry, Question as ApiQuestionType } from '../types/game';
import { clearState } from '../services/storageService'; // Keep clearState, remove loadState and saveState as they are used via storageService.* methods
import type { GameStateToStore } from '../services/storageService'; // Import GameStateToStore as a type
import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import i18n from '../i18n';
import { track } from '@vercel/analytics';
import { logEvent } from '../services/eventLogger';
import { usePaymentStore } from './usePaymentStore';
import { createStreamingActions } from './slices/streamingSlice';

// Define a placeholder type for Question. This can be refined later.
interface QuestionType extends ApiQuestionType {}

// Updated GameStateType to include more specific game phases
type GamePhase = 
  | 'uninitialized'      // Before anything happens
  | 'initializing'       // Actively fetching initial state from API
  | 'initialization_failed' // API call for initial state failed
  | 'welcome'            // Initial state loaded, showing welcome/intro
  | 'playing'            // Game is active, player is making choices
  | 'loading_question'   // Added for clarity when specifically loading a question
  | 'feedback'           // Showing feedback after a choice
  | 'generating_outcome' // Added for clarity
  | 'ending_game'        // Added for clarity when generating summary
  | 'ended'              // Game has concluded (e.g., ran out of questions)
  | 'summary'            // Showing the final summary
  | 'test_ending';       // Development mode for testing the ending screen

interface GameStoreState {
  gamePhase: GamePhase; // Replaces gameState for more clarity
  player: Player | null;
  child: Child | null;
  playerDescription: string | null;
  childDescription: string | null;
  initialGameNarrative: string | null; // For the introductory text
  history: HistoryEntry[];
  feedbackText: string | null;
  endingSummaryText: string | null;
  finance: number; // Finance level 0-10 (0=bankrupt, 10=wealthy)
  marital: number; // Marital relationship level 0-10 (0=partner left, 10=excellent)
  isSingleParent: boolean; // Added for single parent status

  currentAge: number; // This might be derived from child.age later
  currentQuestion: QuestionType | null;
  nextQuestion: QuestionType | null;
  isLoading: boolean; // General loading state for questions, outcomes etc. (distinct from initializing)
  error: string | null; // General error state for questions, outcomes etc.
  showFeedback: boolean;
  isEnding: boolean; // True when the game is in the process of ending, before the summary
  showEndingSummary: boolean;
  
  // Image generation tracking
  generatedImageAges: number[]; // Track ages at which images have been generated
  hasSkippedImageGeneration: boolean; // Track if user has ever skipped image generation in this session
  shouldGenerateImage: boolean; // Flag to indicate if image should be generated at current age
  generatedImages: { age: number; imageBase64?: string; imageUrl?: string }[]; // Store generated images data
  
  // Streaming state
  isStreaming: boolean; // Whether any content is currently streaming
  streamingContent: string; // Current streaming content
  streamingType: 'question' | 'outcome' | 'initial' | null; // What type of content is streaming
  enableStreaming: boolean; // User preference for streaming mode
  
  // Store the pending choice to recover from refreshes during API calls
  pendingChoice?: {
    questionId?: string;
    optionId: string;
    questionText: string;
    optionText: string;
  } | null;

  // Actions
  initializeGame: (options?: { specialRequirements?: string; preloadedState?: InitialStateType }) => Promise<void>;
  startGame: (player: Player, child: Child, playerDescription: string, childDescription: string) => void;
  continueSavedGame: () => void; // New function to continue a saved game
  loadQuestion: () => Promise<void>; // Now async for fetching
  loadQuestionStreaming: () => Promise<void>; // Streaming version
  selectOption: (optionId: string) => Promise<void>; // Now async
  selectOptionStreaming: (optionId: string) => Promise<void>; // Streaming version
  continueGame: () => Promise<void>; // Now async for potential ending generation
  resetToWelcome: () => void; // New function to reset to the welcome screen
  testEnding: () => Promise<void>; // Dev function to test ending screen
  toggleStreaming: () => void; // Toggle streaming mode
  addGeneratedImage: (age: number, imageData: { imageBase64?: string; imageUrl?: string }) => void; // Store generated image
  skipImageGeneration: () => void; // Mark that user has skipped image generation in this session
}

// ────────────────────────────────────────────────────────────────────────────────
// |                            HELPERS & PERSISTENCE                                |
// ────────────────────────────────────────────────────────────────────────────────

// Helper function to generate narrative with translations
const generateNarrative = (scenarioState: {
  player: { gender: 'male' | 'female' | 'nonBinary'; age: number };
  child: { name: string ; gender: 'male' | 'female'; haircolor: string; race: string; };
  playerDescription: string;
  childDescription: string;
}): string => {
  const playerGenderKey = scenarioState.player.gender === 'male' ? 'father' :
                         scenarioState.player.gender === 'female' ? 'mother' : 'parent';
  const childGenderKey = scenarioState.child.gender === 'male' ? 'boy' : 'girl';
  const childHairColorKey = scenarioState.child.haircolor;
  const childRaceKey = scenarioState.child.race;
  
  const playerDesc = i18n.t(`game.${playerGenderKey}`);
  const childDesc = i18n.t(`game.${childGenderKey}`);
  const childHairColorDesc = i18n.t(`game.${childHairColorKey}`);
  const journeyStart = i18n.t('ui.journeyStart');
  const readyToBegin = i18n.t('ui.readyToBegin');
  
  // Construct the narrative based on current language
  if (i18n.language === 'en') {
    return `As a ${playerDesc.toLowerCase()} (${scenarioState.player.age} years old), you are about to begin the journey of raising your child ${scenarioState.child.name} (${childDesc.toLowerCase()}, just born).

${scenarioState.playerDescription}

${scenarioState.childDescription}

${journeyStart}

${readyToBegin}`;
  } else {
    // Chinese version (default)
    return `作为${playerDesc}（${scenarioState.player.age}岁），你即将开始养育你的孩子${scenarioState.child.name}（${childDesc}，${childHairColorDesc}头发，${childRaceKey}，刚刚出生）的旅程。

${scenarioState.playerDescription}

${scenarioState.childDescription}

${journeyStart}

${readyToBegin}`;
  }
};

// Helper function to save current state to localStorage
const saveGameState = (state: GameStoreState) => {
  if (!state.player || !state.child) {
    logger.debug("Not saving state - player or child missing", { player: state.player, child: state.child });
    return; // Don't save if essential data is missing
  }
  
  // Ensure currentAge and child.age are synchronized
  const syncedAge = state.child.age;
  const currentState = state.currentAge;
  if (currentState !== syncedAge) {
    logger.warn(`Age mismatch detected: currentAge=${currentState}, child.age=${syncedAge}. Using child.age as source of truth.`);
  }
  
  const stateToStore: GameStateToStore = {
    player: {
      gender: state.player.gender,
      age: state.player.age,
      description: state.playerDescription || '',
    },
    child: {
      name: state.child.name,
      gender: state.child.gender,
      age: state.child.age,
      haircolor: state.child.haircolor,
      race: state.child.race,
      description: state.childDescription || '',
    },
    history: state.history,
    currentYear: syncedAge, // Use child.age as the authoritative source
    activeQuestion: state.currentQuestion,
    finance: state.finance,
    marital: state.marital,
    isSingleParent: state.isSingleParent,
    pendingChoice: state.pendingChoice,
    // Ending card persistence
    endingSummaryText: state.endingSummaryText,
    isEnding: state.isEnding,
    showEndingSummary: state.showEndingSummary,
    gamePhase: state.gamePhase,
    // Generated images data
    generatedImages: state.generatedImages,
  };
  
  logger.debug("Saving game state to localStorage:", stateToStore);
  storageService.saveState(stateToStore);
};

// ────────────────────────────────────────────────────────────────────────────────
// |                          ZUSTAND STORE CREATION                                |
// ────────────────────────────────────────────────────────────────────────────────

const useGameStore = create<GameStoreState>((set, get) => {
  // Try to load initial state from localStorage
  const savedState = storageService.loadState();
  logger.debug("Loaded state from localStorage:", savedState);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 1: DEFAULT / INITIAL STATE
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Define a type for just the data properties
  type GameStoreData = Omit<GameStoreState, 
    'initializeGame' | 'startGame' | 'continueSavedGame' | 'loadQuestion' | 
    'loadQuestionStreaming' | 'selectOption' | 'selectOptionStreaming' | 
    'continueGame' | 'resetToWelcome' | 'testEnding' | 'toggleStreaming' | 'addGeneratedImage' | 'skipImageGeneration'
  >;
  
  const initialState: GameStoreData = {
    // ——— 1.1) GLOBAL / UI / INITIALIZATION ————————————————————————————————
    gamePhase: 'uninitialized',
    isLoading: false,
    error: null,
    initialGameNarrative: null,

    // ——— 1.2) CURRENT PLAYER & CHILD —————————————————————————————————
    player: null,
    child: null,
    playerDescription: null,
    childDescription: null,
    endingSummaryText: null,
    finance: 5, // Start with middle-class finance level (0=bankrupt, 10=wealthy)
    marital: 5, // Start with middle-class marital relationship level (0=partner left, 10=excellent)
    isSingleParent: false,
    currentAge: 1,

    // ——— 1.3) GAME FLOW & HISTORY —————————————————————————————————————
    currentQuestion: null,
    nextQuestion: null,
    history: [],
    feedbackText: null,
    showFeedback: false,
    isEnding: false,
    showEndingSummary: false,
    pendingChoice: null,

    // ——— 1.4) IMAGE GENERATION TRACKING ——————————————————————————————
    generatedImageAges: [],
    hasSkippedImageGeneration: false,
    shouldGenerateImage: false,
    generatedImages: [],
    
    // ——— 1.5) STREAMING STATE ————————————————————————————————————————
    isStreaming: false,
    streamingContent: '',
    streamingType: null,
    enableStreaming: true,
  };

  // If there's saved state, use it to initialize
  if (savedState && savedState.player && savedState.child) {
    // Ensure age consistency - use child.age as authoritative source
    const authorizedAge = savedState.child.age;
    const savedCurrentYear = savedState.currentYear;
    
    if (authorizedAge !== savedCurrentYear) {
      logger.warn(`Age inconsistency in saved state: child.age=${authorizedAge}, currentYear=${savedCurrentYear}. Using child.age as authoritative.`);
    }
    
    initialState.gamePhase = 'welcome';
    initialState.player = {
      gender: savedState.player.gender,
      age: savedState.player.age,
      name: savedState.child.name,
      profile: {},
      traits: [],
    };
    initialState.child = {
      name: savedState.child.name,
      gender: savedState.child.gender,
      age: authorizedAge,
      haircolor: savedState.child.haircolor,
      race: savedState.child.race,
      profile: {},
      traits: [],
    };
    initialState.playerDescription = savedState.player.description;
    initialState.childDescription = savedState.child.description;
    initialState.history = savedState.history;
    initialState.currentAge = authorizedAge; // Use child.age as authoritative source
    initialState.currentQuestion = savedState.activeQuestion;
    initialState.finance = savedState.finance ?? 5; // Load finance from saved state
    initialState.marital = savedState.marital ?? 5; // Load marital relationship level from saved state
    initialState.isSingleParent = savedState.isSingleParent ?? false; // Load isSingleParent from saved state
    
    // Restore ending-card data if present
    initialState.endingSummaryText = savedState.endingSummaryText ?? null;
    initialState.showEndingSummary = savedState.showEndingSummary ?? false;
    initialState.isEnding = savedState.isEnding ?? false;
    
    // Restore generated images if present
    initialState.generatedImages = savedState.generatedImages ?? [];

    // If the saved state indicates we were on the summary screen, restore directly to it
    if (savedState.showEndingSummary || savedState.gamePhase === 'summary') {
      initialState.gamePhase = 'summary';
      initialState.isEnding = true;
      initialState.showEndingSummary = true;
    }
    
    logger.debug("Initialized game with saved state:", initialState);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 2: ACTION METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  const actions = {
    initializeGame: async (options?: { specialRequirements?: string; preloadedState?: InitialStateType }) => {
      // Clear any existing state before initializing a new game
      clearState();
      
      const startTime = Date.now(); // Record start time for the 2-second delay logic

      // Start overall game initialization timing
      performanceMonitor.startTiming('game-initialization-total', 'local', {
        hasSpecialRequirements: !!options?.specialRequirements,
        hasPreloadedState: !!options?.preloadedState
      });

      // Reset to initializing state with empty values
      performanceMonitor.timeSync('reset-game-state', 'local', () => {
        set(prevState => ({ 
          ...prevState, // Explicitly carry over previous state (including actions)
          gamePhase: 'initializing', 
          error: null, 
          isLoading: true, 
          history: [],
          feedbackText: null,
          endingSummaryText: null,
          player: null,
          child: null,
          playerDescription: null,
          childDescription: null,
          initialGameNarrative: null,
          currentAge: 1,
          currentQuestion: null,
          nextQuestion: null,
          showFeedback: false,
          isEnding: false,
          showEndingSummary: false,
          pendingChoice: null, // Make sure to clear pendingChoice as well
          isSingleParent: false, // Clear isSingleParent
        }));
      });
      
      try {
        // Force a state update to ensure any components dependent on this state re-render
        // This helps prevent stale UI states
        await new Promise(resolve => setTimeout(resolve, 0));
        
        logger.debug("Initializing new game with fresh state" + (options?.specialRequirements ? " and special requirements" : ""));
        
        let initialScenarioState: ApiGameState;
        const { enableStreaming } = get();
        
        if (enableStreaming && !options?.preloadedState) {
          // Use streaming for initial state generation (not for preloaded states)
          set(prevState => ({ 
            ...prevState, 
            isStreaming: true,
            streamingContent: '',
            streamingType: 'initial' as const
          }));
          
          initialScenarioState = await performanceMonitor.timeAsync(
            'generate-initial-state-streaming', 
            'api', 
            async () => {
              // For now, use non-streaming version for initial state
              return await gptService.generateInitialState({
                specialRequirements: options?.specialRequirements,
                preloadedState: options?.preloadedState
              });
            },
            { isStreaming: true }
          );
          
          // Clear streaming state
          set(prevState => ({ 
            ...prevState, 
            isStreaming: false,
            streamingContent: '',
            streamingType: null
          }));
        } else {
          // Use regular generation
          initialScenarioState = await performanceMonitor.timeAsync(
            'generate-initial-state', 
            'api', 
            () => gptService.generateInitialState(options),
            { isPreloaded: !!options?.preloadedState }
          );
        }

        // If a preloaded state was used, ensure a minimum 2-second loading display
        if (options?.preloadedState) {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = 2000 - elapsedTime;
          if (remainingTime > 0) {
            await performanceMonitor.timeAsync('artificial-delay', 'local', async () => {
              await new Promise(resolve => setTimeout(resolve, remainingTime));
            }, { delayMs: remainingTime });
          }
        }

        // Process the initial state (local processing)
        const processedState = performanceMonitor.timeSync('process-initial-state', 'local', () => {
          // Use finance from the initial scenario state, or default to 5 for LLM-generated states
          const calculatedFinance = initialScenarioState.finance ?? 5;

          logger.debug(`Initial finance: ${calculatedFinance}`);
          logger.debug(`Single parent status: ${initialScenarioState.isSingleParent} (LLM-generated)`);

          const narrative = generateNarrative(initialScenarioState);

          // Initial history entry for game start (age 1, before first question)
          const readyToBeginText = i18n.t('ui.readyToBegin');
          const initialHistoryEntry: HistoryEntry = {
            age: 1,
            question: i18n.language === 'en' ? "Game Start" : "游戏开始",
            choice: i18n.language === 'en' ? "Begin parenting journey" : "开始养育旅程",
            outcome: narrative.substring(0, narrative.lastIndexOf(`\n\n${readyToBeginText}`)) // Get only the descriptive part
          };

          return {
            player: initialScenarioState.player,
            child: { ...initialScenarioState.child, age: 1 }, // Change initial age from 0 to 1
            playerDescription: initialScenarioState.playerDescription,
            childDescription: initialScenarioState.childDescription,
            endingSummaryText: narrative, 
            finance: calculatedFinance, // Use the calculated finance value
            marital: initialScenarioState.marital ?? 5, // Use LLM-generated marital relationship level
            isSingleParent: initialScenarioState.isSingleParent || false, // Use LLM-generated value
            currentAge: 1, // Change current display age from 0 to 1
            history: [initialHistoryEntry],
            initialGameNarrative: narrative, 
            feedbackText: narrative, 
            gamePhase: 'feedback' as GamePhase, 
            isLoading: false, 
            error: null,
            currentQuestion: null,
            nextQuestion: null,
            showFeedback: true, 
            isEnding: false,
            showEndingSummary: false,
          };
        });
        
        // Update state
        performanceMonitor.timeSync('update-state', 'local', () => {
          set(prevState => ({ ...prevState, ...processedState }));
        });
        
        // Save to localStorage
        performanceMonitor.timeSync('save-game-state', 'local', () => {
          saveGameState(get());
        });

        // End overall timing and print report
        performanceMonitor.endTiming('game-initialization-total');
        performanceMonitor.printReport();
        
      } catch (err) {
        performanceMonitor.endTiming('game-initialization-total');
        logger.error('Error initializing game in store:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize game data.';
        set(prevState => ({ 
          ...prevState,
          gamePhase: 'initialization_failed', 
          error: errorMessage, 
          isLoading: false,
          player: null, child: null, playerDescription: null, childDescription: null, initialGameNarrative: null, history: [], feedbackText: null,
        }));
      }
    },

    startGame: (player: Player, child: Child, playerDescription: string, childDescription: string) => {
      const currentPhase = get().gamePhase;
      
      // Reset hasSkippedImageGeneration when starting a new game
      set(prevState => ({ 
        ...prevState, 
        hasSkippedImageGeneration: false 
      }));
      
      if (currentPhase === 'uninitialized' || currentPhase === 'initialization_failed') {
        // Correctly set child age to 1 for preloadedState
        get().initializeGame({ specialRequirements: '', preloadedState: { player, child: { ...child, age: 1 }, playerDescription, childDescription, isSingleParent: false } });
      } else if (currentPhase === 'welcome') {
        if (get().initialGameNarrative) {
           const newState = {
              gamePhase: 'feedback' as GamePhase,
              feedbackText: get().initialGameNarrative,
              isLoading: false,
              showFeedback: true,
              currentQuestion: null,
           };
           set(prevState => ({ ...prevState, ...newState }));
           saveGameState(get());
        } else {
          // Correctly set child age to 1 for preloadedState
          get().initializeGame({ specialRequirements: '', preloadedState: { player, child: { ...child, age: 1 }, playerDescription, childDescription, isSingleParent: false } }); 
        }
      } else {
        logger.warn("startGame called in an unexpected phase:", get().gamePhase);
      }
    },

    // New function to handle continuing a saved game
    continueSavedGame: () => {
      logger.debug("Continuing saved game with state:", get());
      
      // Check if we're in an error state with any API-related error
      const currentError = get().error;
      const pendingChoice = get().pendingChoice;
      
      // Check for various types of API errors that need recovery
      const isAPIError = currentError && (
        currentError.includes("Failed to fetch") ||
        currentError.includes("Failed to parse JSON") ||
        currentError.includes("SyntaxError") ||
        currentError.includes("Bad escaped character") ||
        currentError.includes("Failed serverless request") ||
        currentError.includes("Failed direct API request")
      );
      
      // If there was a pending choice and an error occurred (API likely failed)
      if (pendingChoice && isAPIError) {
        logger.debug("Detected pending choice with API error, returning to question state:", currentError);
        // We need to reload the question so the user can try again
        const { child, player } = get();
        
        if (child && player) {
          // Reset to the playing state with the last question
          set(prevState => ({
            ...prevState,
            error: null,
            gamePhase: 'playing' as GamePhase,
            isLoading: false,
            showFeedback: false,
            feedbackText: null,
            // We don't have the full question, but we can display a message about trying again
            currentQuestion: {
              id: pendingChoice.questionId || "recovered-question",
              question: pendingChoice.questionText,
              options: [
                { id: pendingChoice.optionId, text: pendingChoice.optionText, cost: 0 },
                // Provide recovery options
                { id: "retry", text: i18n.t('messages.retryChoice'), cost: 0 },
                { id: "reload", text: i18n.t('messages.reloadGame'), cost: 0 }
              ],
              isExtremeEvent: false
            },
          }));
          
          // Update handler for selectOption to handle the recovery options
          return;
        }
      } else if (isAPIError) {
        logger.debug("Detected API error after refresh, resetting to question state:", currentError);
        // If we have a current age but encountered an API error, we need to reset to the question state
        const { child, player } = get();
        
        if (child && player) {
          // Reset to the playing state so user can make their choice again
          set(prevState => ({
            ...prevState,
            error: null,
            gamePhase: 'playing' as GamePhase,
            isLoading: false,
            showFeedback: false,
            feedbackText: null,
          }));
          
          // Reload the question for the current age
          get().loadQuestion();
          return;
        }
      }
      
      // If we have a current question, go to playing phase
      if (get().currentQuestion) {
        set(prevState => ({ 
          ...prevState,
          gamePhase: 'playing' as GamePhase, 
          showFeedback: false,
          isLoading: false,
          error: null // Clear any errors
        }));
        logger.debug("Continuing to playing phase with existing question");
      } 
      // If we have feedback text to show but no question (and it's not an error message)
      else if (get().feedbackText && 
               typeof get().feedbackText === 'string' && 
               !isAPIError) {
        set(prevState => ({
          ...prevState,
          gamePhase: 'feedback' as GamePhase,
          showFeedback: true,
          isLoading: false,
          error: null // Clear any errors
        }));
        logger.debug("Continuing to feedback phase with existing feedback");
      }
      // If we're at the initial welcome phase with saved data
      else if (get().player && get().child) {
        // First check if we have a beginning narrative in history
        const initialStoryEntry = get().history.find(h => h.question === "游戏开始" || h.question === "Game Start");
        
        if (initialStoryEntry) {
          // When showing the initial story, ensure we preserve the saved age information
          // Don't reset to age 1 if we have a saved game with a higher age
          const currentState = get();
          const shouldShowInitialStory = currentState.history.length === 1 && initialStoryEntry.age === 1;
          
          if (shouldShowInitialStory) {
            // This is truly the beginning of the game - show initial narrative
            const newState = {
              gamePhase: 'feedback' as GamePhase,
              showFeedback: true,
              feedbackText: initialStoryEntry.outcome,
              isLoading: false,
              error: null // Clear any errors
            };
            set(prevState => ({ ...prevState, ...newState }));
            logger.debug("Continuing with initial narrative for new game");
          } else {
            // This is a saved game with progress - determine appropriate feedback or question
            // Look for the most recent history entry to show appropriate feedback
            const mostRecentEntry = currentState.history[currentState.history.length - 1];
            
            if (mostRecentEntry && mostRecentEntry.outcome) {
              // Show the most recent outcome as feedback
              const newState = {
                gamePhase: 'feedback' as GamePhase,
                showFeedback: true,
                feedbackText: mostRecentEntry.outcome,
                isLoading: false,
                error: null // Clear any errors
              };
              set(prevState => ({ ...prevState, ...newState }));
              logger.debug(`Continuing saved game with most recent feedback for age ${mostRecentEntry.age}`);
            } else {
              // No feedback available, load question for current age
              logger.debug("No recent feedback found - loading question for current age");
              set(prevState => ({ ...prevState, error: null }));
              get().loadQuestion();
            }
          }
        } else {
          // Need to get a question - transition to playing
          logger.debug("No narratives or questions found - loading question for current age");
          set(prevState => ({ ...prevState, error: null }));
          get().loadQuestion();
        }
      }
      else {
        logger.warn("continueSavedGame: No valid saved state to continue");
      }
    },

    continueGame: async () => {
      const { isEnding, gamePhase, child, player, playerDescription, childDescription, history, nextQuestion: preloadedNextQuestion, endingSummaryText: est_store, isSingleParent, currentQuestion: cQ_store, feedbackText: ft_store } = get();
      
      if (gamePhase !== 'feedback') {
          logger.warn("continueGame called in an unexpected phase:", gamePhase);
          return;
      }
      if (!child || !player) {
          set(prevState => ({ ...prevState, error: "Cannot continue: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
          return;
      }

      const currentChildAge = child.age;
      logger.debug("Continue game called. Current age:", currentChildAge, "History entries:", history.length);

      // Special handling for initial game state - when we have just initialized the game
      // and we're showing the initial narrative (at age 1)
      if (history.length === 1 && history[0].question === "游戏开始") { 
          logger.debug("DEBUG: Entered initial narrative block in continueGame"); // New Log
          logger.debug("Continuing from initial narrative to first question");
          // Load first question (for age 1)
          try {
            // Reset player and child in localStorage to make sure we're working with the most up-to-date data
            const newState = { 
              showFeedback: false, 
              feedbackText: null,
              gamePhase: 'loading_question' as GamePhase,
              isLoading: true
            };
            set(prevState => ({ ...prevState, ...newState }));
            
            // Wrap the loadQuestion call in a try-catch to prevent unhandled errors
            try {
              // Call loadQuestion directly, not as a next tick action
              logger.debug("DEBUG: Attempting to load first question - BEFORE await loadQuestion()"); // New Log
              const { enableStreaming } = get();
              if (enableStreaming) {
                await get().loadQuestionStreaming();
              } else {
                await get().loadQuestion();
              }
              // Continuing the game means the player is engaging → reset give up streak
              storageService.resetGiveUpStreak();
              logger.debug("DEBUG: Successfully loaded first question - AFTER await loadQuestion()"); // New Log
              logger.debug("Successfully loaded first question");
            } catch (innerErr) {
              logger.error("Error during loadQuestion:", innerErr);
              // Handle error but don't reload the page
              set(prevState => ({ 
                ...prevState,
                error: i18n.t('messages.loadQuestionError'), 
                isLoading: false, 
                gamePhase: 'feedback' as GamePhase,
                feedbackText: i18n.t('messages.loadQuestionError') 
              }));
            }
          } catch (err) {
            logger.error("Error continuing from initial narrative:", err);
            // Don't reload the page, just show an error message to try again
            set(prevState => ({ 
              ...prevState,
              error: i18n.t('messages.loadQuestionError'), 
              isLoading: false, 
              gamePhase: 'feedback' as GamePhase,
              feedbackText: i18n.t('messages.loadQuestionError')
            }));
          }
          return;
      }

      // Logic for subsequent continues (after actual game questions)
      if (isEnding || currentChildAge >= 17) { // Game ends after age 17 event (becomes 18)
        track('Game Completed')
        logger.debug("Ending the game and generating summary");
        set(prevState => ({ ...prevState, gamePhase: 'ending_game', isLoading: true, error: null, showFeedback: false, feedbackText: null }));
        try {
          const finalChildState = { ...child, age: 18 };
          const ageDeltaTo18 = 18 - (child?.age ?? 0);
          const finalPlayerState = player ? { ...player, age: player.age + ageDeltaTo18 } : player;
          const fullGameStateForApi: ApiGameState = {
            player: finalPlayerState!,
            child: finalChildState,
            playerDescription: playerDescription!,
            childDescription: childDescription!,
            history: history,
            endingSummaryText: est_store,
            isSingleParent: isSingleParent,
            currentQuestion: cQ_store,
            feedbackText: ft_store,
            finance: get().finance,
            marital: get().marital,
          };
          const summary = await gptService.generateEnding(fullGameStateForApi);
          const newState = {
            endingSummaryText: summary,
            showEndingSummary: true,
            gamePhase: 'summary' as GamePhase,
            isLoading: false,
            isEnding: true,
            currentAge: 18, 
            child: finalChildState, // Persist the final age
            player: finalPlayerState!,
          };
          set(prevState => ({ ...prevState, ...newState }));
          saveGameState(get());
        } catch (err) {
          logger.error('Error generating ending summary in store:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to generate ending.';
          set(prevState => ({ ...prevState, gamePhase: 'summary', error: errorMessage, isLoading: false, showEndingSummary: true, endingSummaryText: i18n.t('messages.errorGeneratingSummary') }));
        }
      } else {
        // Not ending, advance age and load next question.
        logger.debug("Advancing to next age:", currentChildAge + 1);
        const nextAge = currentChildAge + 1;
        const nextPlayerAge = (player?.age ?? 0) + 1;
        
        // Check if we should generate an image at this age (starting from age 3, then every 3 years: 3, 6, 9, 12, 15, 18)
        const { generatedImageAges } = get();
        // Image generation is now only triggered manually by user clicking the photo button
        // Remove automatic image generation every 3 years
        const shouldGenerateImage = false;
        
        if (shouldGenerateImage) {
          logger.info(`🎨 Image generation triggered for age ${nextAge}`);
        }
        
        const newState = {
            showFeedback: false, 
            feedbackText: null,
            child: { ...child, age: nextAge }, 
            currentAge: nextAge,
            player: player ? { ...player, age: nextPlayerAge } : player,
            gamePhase: 'loading_question' as GamePhase,
            isLoading: true,
            shouldGenerateImage,
            generatedImageAges: shouldGenerateImage ? [...generatedImageAges, nextAge] : generatedImageAges
        };
        set(prevState => ({ ...prevState, ...newState }));
        
        // Apply automatic finance recovery after advancing age if below 7 and child is older than 5
        const currentFinance = get().finance;
        if (currentFinance < 7 && nextAge > 5) {
          const newFinance = Math.min(10, currentFinance + 1);
          logger.info(`💰 Auto-recovery (age advance): Finance increased from ${currentFinance} to ${newFinance} (below 7 threshold, child age ${nextAge})`);
          set(prevState => ({ ...prevState, finance: newFinance }));
        } else if (currentFinance < 7 && nextAge <= 5) {
          logger.debug(`Skipping auto-recovery because child age (${nextAge}) ≤ 5`);
        }
        
        saveGameState(get());

        if (preloadedNextQuestion) {
          logger.debug("Using preloaded question for next age");
          const questionState = {
            currentQuestion: preloadedNextQuestion,
            nextQuestion: null,
            isLoading: false,
            gamePhase: 'playing' as GamePhase,
          };
          set(prevState => ({ ...prevState, ...questionState }));
          saveGameState(get());
        } else {
          logger.debug("Loading new question for next age");
          // Call loadQuestion directly instead of in the next tick
          const { enableStreaming } = get();
          if (enableStreaming) {
            await get().loadQuestionStreaming();
          } else {
            await get().loadQuestion();
          }
          // Player continues engaging → reset give up streak
          storageService.resetGiveUpStreak();
        }
      }
    },

    resetToWelcome: () => {
      logger.debug("Resetting to welcome screen");
      // Clear localStorage state
      clearState();
      // Increment give up streak when explicitly resetting to welcome
      try {
        const streak = storageService.incrementGiveUpStreak();
        logger.info(`Give up streak incremented to ${streak}`);
      } catch (_) {
        // ignore
      }
      // Reset the store state to welcome, but don't initialize a new game yet
      useGameStore.setState({
        gamePhase: 'welcome',
        player: null,
        child: null,
        playerDescription: null,
        childDescription: null,
        initialGameNarrative: null,
        history: [],
        feedbackText: null,
        endingSummaryText: null,
        currentAge: 1,
        currentQuestion: null,
        nextQuestion: null,
        isLoading: false,
        error: null,
        showFeedback: false,
        isEnding: false,
        showEndingSummary: false,
        pendingChoice: null,
        // Keep streaming preferences
        isStreaming: false,
        streamingContent: '',
        streamingType: null,
        // enableStreaming: true, // Keep the user's streaming preference
      });
    },

    testEnding: async () => {
      logger.debug("Testing ending screen");
      
      // Import i18n to get current language
      const { default: i18n } = await import('../i18n');
      const { mockGameStates } = await import('../data/mockData');
      
      // Use language-appropriate mock data
      const isChineseLanguage = i18n.language === 'zh';
      const selectedMockData = isChineseLanguage ? mockGameStates.chinese : mockGameStates.english;
      
      // Extract data from the selected mock data
      const mockPlayer: Player = {
        gender: selectedMockData.player.gender,
        age: selectedMockData.player.age,
        name: selectedMockData.player.name || (isChineseLanguage ? '测试妈妈' : 'Test Mom'),
        profile: selectedMockData.player.profile || {},
        traits: selectedMockData.player.traits || [],
      };
      
      const mockChild: Child = {
        name: selectedMockData.child.name,
        gender: selectedMockData.child.gender,
        age: 18, 
        haircolor: selectedMockData.child.haircolor,
        race: selectedMockData.child.race,
        profile: selectedMockData.child.profile || {},
        traits: selectedMockData.child.traits || [],
      };
      
      // Use the history from mock data
      const mockHistory: HistoryEntry[] = selectedMockData.history;
      
      // Set the state to simulate reaching the ending
      set(prevState => ({
        ...prevState,
        gamePhase: 'ending_game' as GamePhase,
        isLoading: true,
        error: null,
        showFeedback: false,
        feedbackText: null,
        player: mockPlayer,
        child: mockChild,
        playerDescription: selectedMockData.playerDescription,
        childDescription: selectedMockData.childDescription,
        history: mockHistory,
        currentAge: 18,
        isEnding: true,
        endingSummaryText: 'middle',
        isSingleParent: selectedMockData.isSingleParent,
      }));
      
      // Generate a mock ending summary
      try {
        const fullGameStateForApi: ApiGameState = {
          player: mockPlayer,
          child: mockChild,
          playerDescription: selectedMockData.playerDescription,
          childDescription: selectedMockData.childDescription,
          history: mockHistory,
          endingSummaryText: 'middle',
          isSingleParent: selectedMockData.isSingleParent,
          currentQuestion: null,
          feedbackText: null,
          finance: selectedMockData.finance,
          marital: selectedMockData.marital,
        };
        
        const summary = await gptService.generateEnding(fullGameStateForApi);
        const newState = {
          endingSummaryText: summary,
          showEndingSummary: true,
          gamePhase: 'summary' as GamePhase,
          isLoading: false,
          isEnding: true,
          currentAge: 18,
        };
        set(prevState => ({ ...prevState, ...newState }));
        // Persist the generated ending so refreshing the page reloads it
        saveGameState({ ...get(), ...newState } as unknown as GameStoreState);
      } catch (err) {
        logger.error('Error generating test ending summary:', err);
        // Provide a fallback mock ending - use the ending from mock data if available
        const mockEndingSummary = selectedMockData.endingSummaryText || 
          (isChineseLanguage ? 
            `## 最终章：当 ${mockChild.name} 长大成人

**十八岁的 ${mockChild.name}：**
经过18年的精心养育，${mockChild.name}已经成长为一个自信、独立且富有同理心的年轻人。他在学业上表现优秀，更重要的是，他拥有正确的价值观和良好的人际关系能力。

**为人父母的你：**
作为一位${mockPlayer.gender === 'female' ? '母亲' : '父亲'}，你在这18年中展现了极大的智慧和耐心。你成功地在给予孩子自由和设定边界之间找到了平衡，培养了一个既独立又有责任感的孩子。

**未来的序曲：**
${mockChild.name}对未来充满信心和期待。他已经准备好迎接成年生活的挑战，并且知道无论遇到什么困难，都有你的支持和爱作为坚强的后盾。

感谢你的养育，这段旅程就此告一段落。

*(这是一个测试结局，用于开发调试)*` :
            `## Final Chapter: ${mockChild.name} Reaches Adulthood

**${mockChild.name} at Eighteen:**
After 18 years of careful nurturing, ${mockChild.name} has grown into a confident, independent, and empathetic young adult. ${mockChild.gender === 'male' ? 'He' : 'She'} excels academically and, more importantly, possesses strong values and excellent interpersonal skills.

**Your Journey as a Parent:**
As a ${mockPlayer.gender === 'female' ? 'mother' : 'father'}, you have shown tremendous wisdom and patience throughout these 18 years. You successfully balanced giving your child freedom while setting boundaries, raising someone who is both independent and responsible.

**Looking Forward:**
${mockChild.name} is confident and excited about the future. ${mockChild.gender === 'male' ? 'He' : 'She'} is ready to face the challenges of adult life, knowing that your support and love will always be there as a strong foundation.

Thank you for your dedication. This parenting journey has come to a beautiful conclusion.

*(This is a test ending for development debugging)*`);
        
        set(prevState => ({
          ...prevState,
          endingSummaryText: mockEndingSummary,
          showEndingSummary: true,
          gamePhase: 'summary' as GamePhase,
          isLoading: false,
          isEnding: true,
        }));
        // Save fallback ending as well
        saveGameState(get());
      }
    },

    loadQuestion: async () => {
      const { child, player, playerDescription, childDescription, history, endingSummaryText: est_store, currentQuestion: cQ_store, feedbackText: ft_store, isSingleParent } = get();
      if (!child || !player) {
          set(prevState => ({ ...prevState, error: "Cannot load question: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
          return;
      }
      
      set(prevState => ({ ...prevState, gamePhase: 'loading_question', isLoading: true, error: null, currentQuestion: null }));
      try {
        logger.debug("Preparing game state for API call");
        const fullGameStateForApi: ApiGameState = {
            player: player!,
            child: child!,
            playerDescription: playerDescription!,
            childDescription: childDescription!,
            history: history,
            endingSummaryText: est_store,
            currentQuestion: cQ_store,
            feedbackText: ft_store,
            isSingleParent: isSingleParent,
            finance: get().finance,
            marital: get().marital,
        };
        
        logger.debug("Making API call to fetch question for age:", child.age);
        let question;
        try {
          question = await gptService.generateQuestion(fullGameStateForApi);
          logger.debug("Successfully received question from API:", question);
        } catch (apiError) {
          logger.error("API error when fetching question:", apiError);
          question = {
            id: `fallback-${Date.now()}`,
            question: i18n.language === 'en' ? 
              `Your ${child.age}-year-old child ${child.name} is growing up and needs your guidance now.` :
              `你的${child.age}岁孩子${child.name}正在成长，现在需要你的指导。`,
            options: [
              { id: "option1", text: i18n.t('messages.listenToChild'), cost: 0 },
              { id: "option2", text: i18n.t('messages.giveGuidance'), cost: 0 },
              { id: "option3", text: i18n.t('messages.encourageThinking'), cost: 0 }
            ],
            isExtremeEvent: false
          };
          logger.debug("Using fallback question:", question);
        }
        
        const newState = {
          currentQuestion: question,
          nextQuestion: null, 
          isLoading: false,
          showFeedback: false,
          feedbackText: null,
          gamePhase: 'playing' as GamePhase,
          error: null,
        };
        set(prevState => ({ ...prevState, ...newState }));
        saveGameState(get());
      } catch (err) {
          logger.error('Error in loadQuestion function:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to load question.';
          set(prevState => ({ 
            ...prevState,
            gamePhase: 'playing', 
            error: errorMessage, 
            isLoading: false,
            currentQuestion: {
              id: `error-${Date.now()}`,
              question: i18n.t('messages.loadQuestionErrorGeneric'),
              options: [
                { id: "retry", text: i18n.t('messages.retry'), cost: 0 },
                { id: "reload", text: i18n.t('messages.refreshPage'), cost: 0 }
              ],
              isExtremeEvent: false
            }
          })); 
      }
    },

    selectOption: async (optionId: string) => {
      const { currentQuestion, player, child, playerDescription, childDescription, history, endingSummaryText: est_store, currentQuestion: cQ_store, feedbackText: ft_store, isSingleParent } = get();
      if (!currentQuestion || !player || !child) {
        set(prevState => ({ ...prevState, error: "Cannot select option: Missing data.", gamePhase: 'playing', isLoading: false }));
        return;
      }
      
      // Special handling for recovery options
      if (optionId === "retry") {
        logger.debug("User selected to retry the last pending choice");
        set(prevState => ({ ...prevState, error: null, isLoading: false }));
        get().loadQuestion();
        return;
      } else if (optionId === "reload") {
        logger.debug("User selected to reload the game");
        window.location.reload();
        return;
      }
      
      // Handle custom options
      let selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
      
      if (!selectedOption && optionId.startsWith('custom_')) {
        const customOption = (window as any).lastCustomOption;
        if (customOption && customOption.id === optionId) {
          selectedOption = customOption;
          logger.debug("Using custom option:", selectedOption);
          delete (window as any).lastCustomOption;
        }
      }
      
      if (!selectedOption) {
          set(prevState => ({ ...prevState, error: "Invalid option selected.", gamePhase: 'playing', isLoading: false }));
          return;
      }

      // Compute the raw finance change (cost or gain) for the chosen option
      let financeDelta = selectedOption.financeDelta || selectedOption.cost || 0;

      // Prevent wealth deduction (negative financeDelta) until the child is older than 5
      if (child.age <= 5 && financeDelta < 0) {
        logger.debug(`Skipping finance deduction of ${financeDelta} because child age (${child.age}) ≤ 5`);
        financeDelta = 0;
      }
      const maritalDelta = selectedOption.maritalDelta || 0;
      
      const newFinance = Math.max(0, Math.min(10, get().finance + financeDelta));
      const newMarital = Math.max(0, Math.min(10, get().marital + maritalDelta));
      
      const wasBankrupt = get().finance === 0;
      const isNowBankrupt = newFinance === 0;

      logger.info(`💰 Finance: ${get().finance} + ${financeDelta} = ${newFinance}`);
      logger.info(`💕 Marital: ${get().marital} + ${maritalDelta} = ${newMarital}`);

      // Check for bankruptcy recovery
      if (wasBankrupt && (selectedOption as any).isRecovery) {
        const recoveredFinance = Math.max(3, newFinance + 2); // Recover to at least level 3
        logger.info(`🎉 Player recovered from bankruptcy! Finance improved from ${newFinance} to ${recoveredFinance}`);
        
        set(prevState => ({ 
          ...prevState, 
          finance: recoveredFinance,
          marital: newMarital, // Still apply marital delta during recovery
          gamePhase: 'generating_outcome', 
          isLoading: true,
          isStreaming: true,
          streamingContent: '',
          streamingType: 'outcome',
          error: null 
        }));
        
        logger.debug(`Bankruptcy recovery: Finance set to ${recoveredFinance}, Marital set to ${newMarital}`);
      } else {
        if (newFinance === 0 && !wasBankrupt) {
          logger.warn(`Bankruptcy reached! Finance dropped to 0`);
        }

        set(prevState => ({ 
          ...prevState, 
          finance: newFinance,
          marital: newMarital,
          gamePhase: 'generating_outcome', 
          isLoading: true,
          isStreaming: true,
          streamingContent: '',
          streamingType: 'outcome',
          error: null 
        }));
        
        logger.debug(`Finance updated: ${get().finance} + ${financeDelta} = ${newFinance}. Marital updated: ${get().marital} + ${maritalDelta} = ${newMarital}. Is Bankrupt: ${isNowBankrupt}`);
      }

      // Save intermediate state
      const intermediateState = {
        ...get(),
        pendingChoice: {
          questionId: currentQuestion.id,
          optionId: selectedOption.id,
          questionText: currentQuestion.question,
          optionText: selectedOption.text
        }
      };
      saveGameState(intermediateState);
      
      try {
        const eventAge = child.age; 
        const fullGameStateForApi: ApiGameState = {
          player: player!,
          child: child!,
          playerDescription: playerDescription!,
          childDescription: childDescription!,
          history: history,
          endingSummaryText: est_store,
          currentQuestion: cQ_store,
          feedbackText: ft_store,
          isSingleParent: isSingleParent,
          finance: get().finance,
          marital: get().marital,
        };
        const result = await gptService.generateOutcomeAndNextQuestion(
          fullGameStateForApi,
          currentQuestion.question,
          selectedOption.text
        );
        const newHistoryEntry: HistoryEntry = {
          age: eventAge, 
          question: currentQuestion.question,
          choice: selectedOption.text,
          outcome: result.outcome,
        };
        
        const updatedHistory = history
          .filter(entry => entry.age !== eventAge)
          .concat(newHistoryEntry)
          .sort((a, b) => a.age - b.age);
        
        logger.debug(`Updated history: Removed entry for age ${eventAge} if it existed, added new entry`);
        
        const newState = {
          feedbackText: result.outcome,
          nextQuestion: result.nextQuestion || null,
          isEnding: result.isEnding || false,
          history: updatedHistory,
          currentQuestion: null, 
          showFeedback: true,
          gamePhase: 'feedback' as GamePhase,
          isLoading: false,
          pendingChoice: null,
        };
        set(prevState => ({ ...prevState, ...newState }));
        saveGameState(get());

        // Log choice event
        const { anonId, kidId } = usePaymentStore.getState();
        if (anonId && kidId) {
          logEvent(anonId, kidId, 'choice', {
            age: eventAge,
            optionId: selectedOption.id,
            question: currentQuestion.question,
            choiceText: selectedOption.text,
            customInstruction: selectedOption.text,
          });
        }
      } catch (err) {
        logger.error('Error generating outcome in store:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to process selection.';
        set(prevState => ({ 
          ...prevState,
          gamePhase: 'feedback', 
          error: errorMessage, 
          isLoading: false, 
          showFeedback: true, 
          feedbackText: i18n.t('messages.processChoiceError', { errorMessage })
        }));
      }
    },

    addGeneratedImage: (age: number, imageData: { imageBase64?: string; imageUrl?: string }) => {
      console.log('🔍 imageData addGeneratedImage called with age:', age, 'imageData:', imageData);
      console.log('📊 imageData has imageBase64?', !!imageData.imageBase64);
      console.log('🔗 imageData has imageUrl?', !!imageData.imageUrl);
      
      set(prevState => {
        console.log('📝 imageData Current history length:', prevState.history.length);
        
        // Always add image data to the last history entry
        const updatedHistory = [...prevState.history];
        if (updatedHistory.length > 0) {
          const lastIndex = updatedHistory.length - 1;
          console.log('📋 imageData Last history entry before update:', updatedHistory[lastIndex]);
          
          // For localStorage optimization, only store imageUrl, never imageBase64
          const optimizedImageData = imageData.imageUrl 
            ? { imageUrl: imageData.imageUrl } 
            : {}; // Don't store anything if no imageUrl
          
          updatedHistory[lastIndex] = { 
            ...updatedHistory[lastIndex], 
            ...optimizedImageData 
          };
          
          console.log('✅ imageData Last history entry after update:', updatedHistory[lastIndex]);
          console.log('🖼️ imageData Updated entry has imageBase64?', !!updatedHistory[lastIndex].imageBase64);
          console.log('🔗 imageData Updated entry has imageUrl?', !!updatedHistory[lastIndex].imageUrl);
        }
        
        const newState = {
          ...prevState,
          history: updatedHistory,
          // Keep the generatedImages array for backward compatibility, also optimize storage
          generatedImages: [...prevState.generatedImages, { 
            age, 
            imageBase64: imageData.imageUrl ? undefined : imageData.imageBase64,
            imageUrl: imageData.imageUrl 
          }]
        };
        
        console.log('💾 imageData New state history:', newState.history);
        return newState;
      });
      
      console.log('💿 imageData Saving game state...');
      saveGameState(get());
      console.log('✅ imageData Game state saved');
    },

    skipImageGeneration: () => {
      set(state => ({
        ...state,
        hasSkippedImageGeneration: true,
        shouldGenerateImage: false
      }));
      saveGameState(get());
    },

    
  };

  // Set initial state and merge with actions to return complete store state
  const streamingActions = createStreamingActions(set, get, (state) => saveGameState(state));
  return {
    ...initialState,
    ...actions,
    ...streamingActions,
  };
});

// Log the state after the store is fully created
setTimeout(() => {
  if (typeof useGameStore.getState !== 'function') {
    // Remove this line: logger.debug("DEBUG: useGameStore.getState is not yet a function after timeout");
  }
}, 100);

export default useGameStore;
export type { Player, Child, HistoryEntry, QuestionType, GamePhase };

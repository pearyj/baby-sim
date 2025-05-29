import { create } from 'zustand';
// import { persist, createJSONStorage } from 'zustand/middleware'; // Removed unused import
import * as gptService from '../services/gptServiceUnified';
import type { InitialStateType } from '../services/gptServiceUnified'; // Ensured type-only import
import * as storageService from '../services/storageService';
import type { GameState as ApiGameState, Player, Child, HistoryEntry, Question as ApiQuestionType } from '../types/game';
import { clearState } from '../services/storageService'; // Keep clearState, remove loadState and saveState as they are used via storageService.* methods
import type { GameStateToStore } from '../services/storageService'; // Import GameStateToStore as a type
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import i18n from '../i18n';

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
  | 'summary';           // Showing final game summary

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
  wealthTier: 'poor' | 'middle' | 'wealthy' | null; // Added from previous step
  financialBurden: number; // Added for financial tracking
  isBankrupt: boolean; // Added for bankruptcy state

  currentAge: number; // This might be derived from child.age later
  currentQuestion: QuestionType | null;
  nextQuestion: QuestionType | null;
  isLoading: boolean; // General loading state for questions, outcomes etc. (distinct from initializing)
  error: string | null; // General error state for questions, outcomes etc.
  showFeedback: boolean;
  isEnding: boolean; // True when the game is in the process of ending, before the summary
  showEndingSummary: boolean;
  
  // Streaming state
  isStreaming: boolean; // Whether any content is currently streaming
  streamingContent: string; // Current streaming content
  streamingType: 'question' | 'outcome' | 'initial' | null; // What type of content is streaming
  enableStreaming: boolean; // User preference for streaming mode
  
  // UI state
  showInfoModal: boolean; // Whether the info modal is open
  
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
  openInfoModal: () => void; // Open the info modal
  closeInfoModal: () => void; // Close the info modal
}

// Helper function to generate narrative with translations
const generateNarrative = (scenarioState: {
  player: { gender: 'male' | 'female'; age: number };
  child: { name: string; gender: 'male' | 'female' };
  playerDescription: string;
  childDescription: string;
}): string => {
  const playerGenderKey = scenarioState.player.gender === 'male' ? 'father' : 'mother';
  const childGenderKey = scenarioState.child.gender === 'male' ? 'boy' : 'girl';
  
  const playerDesc = i18n.t(`game.${playerGenderKey}`);
  const childDesc = i18n.t(`game.${childGenderKey}`);
  const journeyStart = i18n.t('ui.journeyStart');
  const readyToBegin = i18n.t('ui.readyToBegin');
  
  // Construct the narrative based on current language
  if (i18n.language === 'en') {
    return `As a ${playerDesc.toLowerCase()} (${scenarioState.player.age} years old), you are about to begin the journey of raising your child ${scenarioState.child.name} (${childDesc.toLowerCase()}, just born).\n\n${scenarioState.playerDescription}\n\n${scenarioState.childDescription}\n\n${journeyStart}\n\n${readyToBegin}`;
  } else {
    // Chinese version (default)
    return `作为${playerDesc}（${scenarioState.player.age}岁），你即将开始养育你的孩子${scenarioState.child.name}（${childDesc}，刚刚出生）的旅程。\n\n${scenarioState.playerDescription}\n\n${scenarioState.childDescription}\n\n${journeyStart}\n\n${readyToBegin}`;
  }
};

// Helper function to save current state to localStorage
const saveGameState = (state: GameStoreState) => {
  if (!state.player || !state.child) {
    logger.log("Not saving state - player or child missing", { player: state.player, child: state.child });
    return; // Don't save if essential data is missing
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
      description: state.childDescription || '',
    },
    history: state.history,
    currentYear: state.currentAge,
    activeQuestion: state.currentQuestion,
  };
  
  logger.log("Saving game state to localStorage:", stateToStore);
  storageService.saveState(stateToStore);
};

const useGameStore = create<GameStoreState>((set, get) => {
  // Try to load initial state from localStorage
  const savedState = storageService.loadState();
  logger.log("Loaded state from localStorage:", savedState);
  
  const initialState: GameStoreState = {
    // Initial State
    gamePhase: 'uninitialized',
    player: null,
    child: null,
    playerDescription: null,
    childDescription: null,
    initialGameNarrative: null,
    history: [],
    feedbackText: null,
    endingSummaryText: null,
    wealthTier: null, // Initialize wealthTier
    financialBurden: 0, // Initialize financialBurden
    isBankrupt: false, // Initialize isBankrupt
    
    currentAge: 1,
    currentQuestion: null,
    nextQuestion: null,
    isLoading: false,
    error: null,
    showFeedback: false,
    isEnding: false,
    showEndingSummary: false,
    pendingChoice: null,
    
    // Streaming state
    isStreaming: false,
    streamingContent: '',
    streamingType: null,
    enableStreaming: true, // Enable streaming by default
    
    // UI state
    showInfoModal: false,
    
    // Define all required functions up front with unused parameters prefixed
    initializeGame: async (_options?: { specialRequirements?: string; preloadedState?: InitialStateType }) => { logger.log("initializeGame stub called") },
    startGame: (_player: Player, _child: Child, _playerDescription: string, _childDescription: string) => { logger.log("startGame stub called") },
    continueSavedGame: () => { logger.log("continueSavedGame stub called") },
    loadQuestion: async () => { logger.log("loadQuestion stub called") },
    loadQuestionStreaming: async () => { logger.log("loadQuestionStreaming stub called") },
    selectOption: async () => { logger.log("selectOption stub called") },
    selectOptionStreaming: async () => { logger.log("selectOptionStreaming stub called") },
    continueGame: async () => { logger.log("continueGame stub called") },
    resetToWelcome: () => { logger.log("resetToWelcome stub called") },
    testEnding: async () => { logger.log("testEnding stub called") },
    toggleStreaming: () => { logger.log("toggleStreaming stub called") },
    openInfoModal: () => { logger.log("openInfoModal stub called") },
    closeInfoModal: () => { logger.log("closeInfoModal stub called") },
  };

  // If there's saved state, use it to initialize
  if (savedState && savedState.player && savedState.child) {
    initialState.gamePhase = 'welcome';
    initialState.player = {
      gender: savedState.player.gender,
      age: savedState.player.age,
      // Add any missing properties that might be required
      name: savedState.child.name, // Player might need a name property
      profile: {}, // Add empty objects for any expected properties
      traits: [],
    };
    initialState.child = {
      name: savedState.child.name,
      gender: savedState.child.gender,
      age: savedState.child.age,
      // Add any missing properties that might be required
      profile: {}, // Add empty objects for any expected properties
      traits: [],
    };
    initialState.playerDescription = savedState.player.description;
    initialState.childDescription = savedState.child.description;
    initialState.history = savedState.history;
    initialState.currentAge = savedState.currentYear;
    initialState.currentQuestion = savedState.activeQuestion;
    
    logger.log("Initialized game with saved state:", initialState);
  }

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
          wealthTier: null, // Clear wealthTier
          financialBurden: 0, // Reset financialBurden
          isBankrupt: false, // Reset isBankrupt
        }));
      });
      
      try {
        // Force a state update to ensure any components dependent on this state re-render
        // This helps prevent stale UI states
        await new Promise(resolve => setTimeout(resolve, 0));
        
        logger.log("Initializing new game with fresh state" + (options?.specialRequirements ? " and special requirements" : ""));
        
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
          const tierMap = { poor: 0, middle: 10, wealthy: 30 };
          const B = tierMap[initialScenarioState.wealthTier || 'middle']; // Default to middle if not present
          const calculatedFinancialBurden = -B;

          logger.log(`Scenario wealthTier: ${initialScenarioState.wealthTier}, Initial financialBurden: ${calculatedFinancialBurden}`);

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
            wealthTier: initialScenarioState.wealthTier || 'middle', // Persist wealthTier
            financialBurden: calculatedFinancialBurden, // Persist calculated financialBurden
            isBankrupt: false, // Initialize isBankrupt for a new game
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
            endingSummaryText: null,
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
      if (currentPhase === 'uninitialized' || currentPhase === 'initialization_failed') {
        // Correctly set child age to 1 for preloadedState and add default wealthTier
        get().initializeGame({ specialRequirements: '', preloadedState: { player, child: { ...child, age: 1 }, playerDescription, childDescription, wealthTier: 'middle' } });
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
          // Correctly set child age to 1 for preloadedState and add default wealthTier
          get().initializeGame({ specialRequirements: '', preloadedState: { player, child: { ...child, age: 1 }, playerDescription, childDescription, wealthTier: 'middle' } }); 
        }
      } else {
        logger.warn("startGame called in an unexpected phase:", get().gamePhase);
      }
    },

    // New function to handle continuing a saved game
    continueSavedGame: () => {
      logger.log("Continuing saved game with state:", get());
      
      // Check if we're in an error state with "Failed to fetch" error
      const currentError = get().error;
      const pendingChoice = get().pendingChoice;
      
      // If there was a pending choice and an error occurred (API likely failed)
      if (pendingChoice && currentError && currentError.includes("Failed to fetch")) {
        logger.log("Detected pending choice with 'Failed to fetch' error, returning to question state");
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
                { id: "retry", text: "重新尝试相同的选择", cost: 0 },
                { id: "reload", text: "重新加载游戏", cost: 0 }
              ],
              isExtremeEvent: false
            },
          }));
          
          // Update handler for selectOption to handle the recovery options
          return;
        }
      } else if (currentError && currentError.includes("Failed to fetch")) {
        logger.log("Detected 'Failed to fetch' error after refresh, resetting to question state");
        // If we have a current age but encountered a fetch error, we need to reset to the question state
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
        logger.log("Continuing to playing phase with existing question");
      } 
      // If we have feedback text to show but no question (and it's not an error message)
      else if (get().feedbackText && 
               typeof get().feedbackText === 'string' && 
               !(get().feedbackText as string).includes("Failed to fetch")) {
        set(prevState => ({
          ...prevState,
          gamePhase: 'feedback' as GamePhase,
          showFeedback: true,
          isLoading: false,
          error: null // Clear any errors
        }));
        logger.log("Continuing to feedback phase with existing feedback");
      }
      // If we're at the initial welcome phase with saved data
      else if (get().player && get().child) {
        // First check if we have a beginning narrative in history
        const initialStoryEntry = get().history.find(h => h.question === "游戏开始" || h.question === "Game Start");
        
        if (initialStoryEntry) {
          // Set feedback to show the initial story
          const newState = {
            gamePhase: 'feedback' as GamePhase,
            showFeedback: true,
            feedbackText: initialStoryEntry.outcome,
            isLoading: false,
            error: null // Clear any errors
          };
          set(prevState => ({ ...prevState, ...newState }));
          logger.log("Continuing with initial narrative");
        } else {
          // Need to get a question - transition to playing
          logger.log("No narratives or questions found - loading question for current age");
          set(prevState => ({ ...prevState, error: null }));
          get().loadQuestion();
        }
      }
      else {
        logger.warn("continueSavedGame: No valid saved state to continue");
      }
    },

    loadQuestion: async () => {
      const { child, player, playerDescription, childDescription, history, wealthTier, financialBurden, currentQuestion: cQ_store, feedbackText: ft_store, endingSummaryText: est_store, isBankrupt } = get();
      if (!child || !player) {
          set(prevState => ({ ...prevState, error: "Cannot load question: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
          return;
      }
      set(prevState => ({ ...prevState, gamePhase: 'loading_question', isLoading: true, error: null, currentQuestion: null }));
      try {
        logger.log("Preparing game state for API call");
        const fullGameStateForApi: ApiGameState = {
            player: player!,
            child: child!, // child.age is the current age (e.g., 1 for first question set)
            playerDescription: playerDescription!,
            childDescription: childDescription!,
            history: history,
            wealthTier: wealthTier || 'middle', // Provide default if null
            financialBurden: financialBurden || 0, // Provide default if null
            currentQuestion: cQ_store,
            feedbackText: ft_store,
            endingSummaryText: est_store,
            isBankrupt: isBankrupt || false, // Pass isBankrupt state
        };
        
        logger.log("Making API call to fetch question for age:", child.age);
        // fetchQuestion service is expected to ask for child.age (e.g. 1-year-old events)
        // The gptService.generateQuestionPrompt uses `gameState.child.age`.
        // So if child.age is 1 (meaning currently 1 years old), it will ask for events for a 1-year-old.
        // This is now correct with the new age progression system.
        let question;
        try {
          question = await gptService.generateQuestion(fullGameStateForApi);
          logger.log("Successfully received question from API:", question);
        } catch (apiError) {
          logger.error("API error when fetching question:", apiError);
          // Create a fallback question if the API fails
          question = {
            id: `fallback-${Date.now()}`,
            question: `你的${child.age}岁孩子${child.name}正在成长，现在需要你的指导。`,
            options: [
              { id: "option1", text: "耐心倾听并理解孩子的需求", cost: 0 },
              { id: "option2", text: "给予适当的引导和建议", cost: 0 },
              { id: "option3", text: "鼓励孩子独立思考解决问题", cost: 0 }
            ],
            isExtremeEvent: false
          };
          logger.log("Using fallback question:", question);
        }
        
        const newState = {
          currentQuestion: question,
          nextQuestion: null, 
          isLoading: false,
          showFeedback: false,
          feedbackText: null,
          gamePhase: 'playing' as GamePhase,
          error: null, // Clear any previous errors
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
            // Add a fallback question
            currentQuestion: {
              id: `error-${Date.now()}`,
              question: "加载问题时发生错误，请选择如何继续",
              options: [
                { id: "retry", text: "重新尝试", cost: 0 },
                { id: "reload", text: "刷新页面", cost: 0 }
              ],
              isExtremeEvent: false
            }
          })); 
      }
    },

    loadQuestionStreaming: async () => {
      const { child, player, playerDescription, childDescription, history, wealthTier, financialBurden, currentQuestion: cQ_store, feedbackText: ft_store, endingSummaryText: est_store, isBankrupt, enableStreaming } = get();
      
      console.log('🚀 loadQuestionStreaming called! enableStreaming:', enableStreaming);
      logger.log(`🚀 loadQuestionStreaming called with enableStreaming: ${enableStreaming}`);
      
      if (!enableStreaming) {
        console.log('⚠️ Streaming disabled, falling back to regular loadQuestion');
        // Fall back to regular loading if streaming is disabled
        return get().loadQuestion();
      }
      
      if (!child || !player) {
        set(prevState => ({ ...prevState, error: "Cannot load question: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
        return;
      }
      
      // Set streaming state
      set(prevState => ({ 
        ...prevState, 
        gamePhase: 'loading_question', 
        isLoading: true, 
        isStreaming: true,
        streamingContent: '',
        streamingType: 'question',
        error: null, 
        currentQuestion: null 
      }));
      
      try {
        logger.log("Preparing game state for streaming API call");
        const fullGameStateForApi: ApiGameState = {
          player: player!,
          child: child!,
          playerDescription: playerDescription!,
          childDescription: childDescription!,
          history: history,
          wealthTier: wealthTier || 'middle',
          financialBurden: financialBurden || 0,
          currentQuestion: cQ_store,
          feedbackText: ft_store,
          endingSummaryText: est_store,
          isBankrupt: isBankrupt || false,
        };
        
        logger.log("Making streaming API call to fetch question for age:", child.age);
        
        const question = await gptService.generateQuestion(
          fullGameStateForApi,
          {
            streaming: true,
            onProgress: (partialContent: string) => {
              // Update streaming content as it comes in
              set(prevState => ({ 
                ...prevState, 
                streamingContent: partialContent 
              }));
            }
          }
        );
        
        logger.log("Successfully received streaming question from API:", question);
        
        // Set final state with complete question
        const newState = {
          currentQuestion: question,
          nextQuestion: null,
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          streamingType: null,
          showFeedback: false,
          feedbackText: null,
          gamePhase: 'playing' as GamePhase,
          error: null,
        };
        set(prevState => ({ ...prevState, ...newState }));
        saveGameState(get());
        
      } catch (err) {
        logger.error('Error in loadQuestionStreaming function:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load question.';
        
        // Clear streaming state and show error
        set(prevState => ({ 
          ...prevState,
          gamePhase: 'playing', 
          error: errorMessage, 
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          streamingType: null,
          currentQuestion: {
            id: `error-${Date.now()}`,
            question: "加载问题时发生错误，请选择如何继续",
            options: [
              { id: "retry", text: "重新尝试", cost: 0 },
              { id: "reload", text: "刷新页面", cost: 0 }
            ],
            isExtremeEvent: false
          }
        })); 
      }
    },

    selectOption: async (optionId: string) => {
      const { currentQuestion, player, child, playerDescription, childDescription, history, wealthTier, financialBurden, feedbackText: ft_store, endingSummaryText: est_store } = get();
      if (!currentQuestion || !player || !child) {
        set(prevState => ({ ...prevState, error: "Cannot select option: Missing data.", gamePhase: 'playing', isLoading: false }));
        return;
      }
      
      // Special handling for recovery options
      if (optionId === "retry") {
        // This is a special option to retry the last pending choice
        logger.log("User selected to retry the last pending choice");
        // Clear error state and reload question
        set(prevState => ({ ...prevState, error: null, isLoading: false }));
        get().loadQuestion();
        return;
      } else if (optionId === "reload") {
        // This is a special option to reload the game
        logger.log("User selected to reload the game");
        window.location.reload();
        return;
      }
      
      // Handle custom options
      let selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
      
      // Check if this is a custom option
      if (!selectedOption && optionId.startsWith('custom_')) {
        // Retrieve the custom option from window
        const customOption = (window as any).lastCustomOption;
        if (customOption && customOption.id === optionId) {
          selectedOption = customOption;
          logger.log("Using custom option:", selectedOption);
          // Clean up after use
          delete (window as any).lastCustomOption;
        }
      }
      
      if (!selectedOption) {
          set(prevState => ({ ...prevState, error: "Invalid option selected.", gamePhase: 'playing', isLoading: false }));
          return;
      }

      // Update financial burden based on selected option cost
      const newFinancialBurden = (financialBurden || 0) + (selectedOption.cost || 0);
      let newIsBankrupt = get().isBankrupt; // Preserve existing bankruptcy state unless changed

      // Check for bankruptcy recovery: if player is currently bankrupt and chooses an option with isRecovery flag
      if (get().isBankrupt && (selectedOption as any).isRecovery) {
        newIsBankrupt = false;
        logger.info(`🎉 Player recovered from bankruptcy! Financial burden reduced significantly.`);
        // Significantly reduce financial burden on recovery (but not to zero)
        const recoveredBurden = Math.max(20, newFinancialBurden - 35); // Reduce by 35, minimum 20
        logger.info(`Financial burden reduced from ${newFinancialBurden} to ${recoveredBurden}`);
        const finalFinancialBurden = recoveredBurden;
        
        set(prevState => ({ 
          ...prevState, 
          financialBurden: finalFinancialBurden,
          isBankrupt: newIsBankrupt,
          gamePhase: 'generating_outcome', 
          isLoading: true, 
          error: null 
        }));
        logger.log(`Bankruptcy recovery: Financial burden set to ${finalFinancialBurden}. Is Bankrupt: ${newIsBankrupt}`);
      } else {
        // Normal financial burden logic
        if (newFinancialBurden >= 50) {
          newIsBankrupt = true;
          logger.warn(`Bankruptcy threshold reached! Financial Burden: ${newFinancialBurden}`);
        }

        set(prevState => ({ 
          ...prevState, 
          financialBurden: newFinancialBurden,
          isBankrupt: newIsBankrupt, // Set the bankruptcy state
          gamePhase: 'generating_outcome', 
          isLoading: true, 
          error: null 
        }));
        logger.log(`Financial burden updated: ${financialBurden} + ${selectedOption.cost || 0} = ${newFinancialBurden}. Is Bankrupt: ${newIsBankrupt}`);
      }

      // Save this intermediate state to localStorage so we can recover if needed
      const intermediateState = {
        ...get(), // Get the most recent state AFTER setting newFinancialBurden
        pendingChoice: {
          questionId: currentQuestion.id,
          optionId: selectedOption.id,
          questionText: currentQuestion.question,
          optionText: selectedOption.text
        }
      };
      // Explicitly set financialBurden in intermediateState for saving, as get() might be async otherwise
      // Actually, the set above should be synchronous for the next get(), but to be safe:
      // intermediateState.financialBurden = newFinancialBurden; 
      // No, the set call updates the store, get() after it will have the new value.
      saveGameState(intermediateState);
      
      try {
        const eventAge = child.age; 
        const currentState = get(); // Get the current state to get the updated financial burden
        const fullGameStateForApi: ApiGameState = {
          player: player!,
          child: child!,
          playerDescription: playerDescription!,
          childDescription: childDescription!,
          history: history,
          wealthTier: wealthTier || 'middle',
          financialBurden: currentState.financialBurden, // Use the updated financial burden from state
          isBankrupt: currentState.isBankrupt, // Use the updated bankruptcy state
          currentQuestion: currentQuestion, // currentQuestion from selectOption scope
          feedbackText: ft_store,
          endingSummaryText: est_store,
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
        
        // Filter out any existing entries for the same age and add the new one
        const updatedHistory = history
          .filter(entry => entry.age !== eventAge) // Remove entries with the same age
          .concat(newHistoryEntry) // Add the new entry
          .sort((a, b) => a.age - b.age); // Sort by age
        
        logger.log(`Updated history: Removed entry for age ${eventAge} if it existed, added new entry`);
        
        const newState = {
          feedbackText: result.outcome,
          nextQuestion: result.nextQuestion || null,
          isEnding: result.isEnding || false,
          history: updatedHistory,
          // Child's age does not advance here; it advances in continueGame
          currentQuestion: null, 
          showFeedback: true,
          gamePhase: 'feedback' as GamePhase,
          isLoading: false,
          pendingChoice: null, // Clear the pending choice since we got a result
        };
        set(prevState => ({ ...prevState, ...newState }));
        saveGameState(get());
      } catch (err) {
        logger.error('Error generating outcome in store:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to process selection.';
        set(prevState => ({ 
          ...prevState,
          gamePhase: 'feedback', 
          error: errorMessage, 
          isLoading: false, 
          showFeedback: true, 
          feedbackText: "很抱歉，在处理您的选择时遇到了技术问题。您可以尝试重新选择或刷新页面。错误详情：" + errorMessage
        }));
      }
    },

    selectOptionStreaming: async (optionId: string) => {
      const { currentQuestion, player, child, playerDescription, childDescription, history, wealthTier, financialBurden, feedbackText: ft_store, endingSummaryText: est_store, enableStreaming } = get();
      
      console.log('🚀 selectOptionStreaming called! optionId:', optionId, 'enableStreaming:', enableStreaming);
      logger.log(`🚀 selectOptionStreaming called with optionId: ${optionId}, enableStreaming: ${enableStreaming}`);
      
      if (!enableStreaming) {
        console.log('⚠️ Streaming disabled, falling back to regular selectOption');
        // Fall back to regular selectOption if streaming is disabled
        return get().selectOption(optionId);
      }
      
      if (!currentQuestion || !player || !child) {
        set(prevState => ({ ...prevState, error: "Cannot select option: Missing data.", gamePhase: 'playing', isLoading: false }));
        return;
      }
      
      // Special handling for recovery options
      if (optionId === "retry") {
        logger.log("User selected to retry the last pending choice");
        set(prevState => ({ ...prevState, error: null, isLoading: false }));
        get().loadQuestionStreaming();
        return;
      } else if (optionId === "reload") {
        logger.log("User selected to reload the game");
        window.location.reload();
        return;
      }
      
      // Handle custom options
      let selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
      
      if (!selectedOption && optionId.startsWith('custom_')) {
        const customOption = (window as any).lastCustomOption;
        if (customOption && customOption.id === optionId) {
          selectedOption = customOption;
          logger.log("Using custom option:", selectedOption);
          delete (window as any).lastCustomOption;
        }
      }
      
      if (!selectedOption) {
        set(prevState => ({ ...prevState, error: "Invalid option selected.", gamePhase: 'playing', isLoading: false }));
        return;
      }

      // Update financial burden
      const newFinancialBurden = (financialBurden || 0) + (selectedOption.cost || 0);
      let newIsBankrupt = get().isBankrupt;

      // Check for bankruptcy recovery: if player is currently bankrupt and chooses an option with isRecovery flag
      if (get().isBankrupt && (selectedOption as any).isRecovery) {
        newIsBankrupt = false;
        logger.info(`🎉 Player recovered from bankruptcy! Financial burden reduced significantly.`);
        // Significantly reduce financial burden on recovery (but not to zero)
        const recoveredBurden = Math.max(20, newFinancialBurden - 35); // Reduce by 35, minimum 20
        logger.info(`Financial burden reduced from ${newFinancialBurden} to ${recoveredBurden}`);
        const finalFinancialBurden = recoveredBurden;
        
        // Set streaming state
        set(prevState => ({ 
          ...prevState, 
          financialBurden: finalFinancialBurden,
          isBankrupt: newIsBankrupt,
          gamePhase: 'generating_outcome', 
          isLoading: true,
          isStreaming: true,
          streamingContent: '',
          streamingType: 'outcome',
          error: null 
        }));
        
        logger.log(`Bankruptcy recovery: Financial burden set to ${finalFinancialBurden}. Is Bankrupt: ${newIsBankrupt}`);
      } else {
        // Normal financial burden logic
        if (newFinancialBurden >= 50) {
          newIsBankrupt = true;
          logger.warn(`Bankruptcy threshold reached! Financial Burden: ${newFinancialBurden}`);
        }

        // Set streaming state
        set(prevState => ({ 
          ...prevState, 
          financialBurden: newFinancialBurden,
          isBankrupt: newIsBankrupt,
          gamePhase: 'generating_outcome', 
          isLoading: true,
          isStreaming: true,
          streamingContent: '',
          streamingType: 'outcome',
          error: null 
        }));
        
        logger.log(`Financial burden updated: ${financialBurden} + ${selectedOption.cost || 0} = ${newFinancialBurden}. Is Bankrupt: ${newIsBankrupt}`);
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
        const currentState = get(); // Get the current state to get the updated financial burden
        const fullGameStateForApi: ApiGameState = {
          player: player!,
          child: child!,
          playerDescription: playerDescription!,
          childDescription: childDescription!,
          history: history,
          wealthTier: wealthTier || 'middle',
          financialBurden: currentState.financialBurden, // Use the updated financial burden from state
          isBankrupt: currentState.isBankrupt, // Use the updated bankruptcy state
          currentQuestion: currentQuestion,
          feedbackText: ft_store,
          endingSummaryText: est_store,
        };
        
        const result = await gptService.generateOutcomeAndNextQuestion(
          fullGameStateForApi,
          currentQuestion.question,
          selectedOption.text,
          {
            streaming: true,
            onProgress: (partialContent: string) => {
              // Update streaming content as it comes in
              set(prevState => ({ 
                ...prevState, 
                streamingContent: partialContent 
              }));
            }
          }
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
        
        logger.log(`Updated history: Removed entry for age ${eventAge} if it existed, added new entry`);
        
        const newState = {
          feedbackText: result.outcome,
          nextQuestion: result.nextQuestion || null,
          isEnding: result.isEnding || false,
          history: updatedHistory,
          currentQuestion: null, 
          showFeedback: true,
          gamePhase: 'feedback' as GamePhase,
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          streamingType: null,
          pendingChoice: null,
        };
        set(prevState => ({ ...prevState, ...newState }));
        saveGameState(get());
        
      } catch (err) {
        logger.error('Error generating outcome in streaming store:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to process selection.';
        set(prevState => ({ 
          ...prevState,
          gamePhase: 'feedback', 
          error: errorMessage, 
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          streamingType: null,
          showFeedback: true, 
          feedbackText: "很抱歉，在处理您的选择时遇到了技术问题。您可以尝试重新选择或刷新页面。错误详情：" + errorMessage
        }));
      }
    },

    continueGame: async () => {
      const { isEnding, gamePhase, child, player, playerDescription, childDescription, history, nextQuestion: preloadedNextQuestion, wealthTier, financialBurden, currentQuestion: cQ_store, feedbackText: ft_store, endingSummaryText: est_store, isBankrupt } = get();
      
      if (gamePhase !== 'feedback') {
          logger.warn("continueGame called in an unexpected phase:", gamePhase);
          return;
      }
      if (!child || !player) {
          set(prevState => ({ ...prevState, error: "Cannot continue: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
          return;
      }

      const currentChildAge = child.age;
      logger.log("Continue game called. Current age:", currentChildAge, "History entries:", history.length);

      // Special handling for initial game state - when we have just initialized the game
      // and we're showing the initial narrative (at age 1)
      if (history.length === 1 && history[0].question === "游戏开始") { 
          logger.log("DEBUG: Entered initial narrative block in continueGame"); // New Log
          logger.log("Continuing from initial narrative to first question");
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
              logger.log("DEBUG: Attempting to load first question - BEFORE await loadQuestion()"); // New Log
              const { enableStreaming } = get();
              if (enableStreaming) {
                await get().loadQuestionStreaming();
              } else {
                await get().loadQuestion();
              }
              logger.log("DEBUG: Successfully loaded first question - AFTER await loadQuestion()"); // New Log
              logger.log("Successfully loaded first question");
            } catch (innerErr) {
              logger.error("Error during loadQuestion:", innerErr);
              // Handle error but don't reload the page
              set(prevState => ({ 
                ...prevState,
                error: "加载首个问题时出现错误，请再次尝试。", 
                isLoading: false, 
                gamePhase: 'feedback' as GamePhase,
                feedbackText: "很抱歉，在加载您的第一个问题时遇到了技术问题。请再次尝试。" 
              }));
            }
          } catch (err) {
            logger.error("Error continuing from initial narrative:", err);
            // Don't reload the page, just show an error message to try again
            set(prevState => ({ 
              ...prevState,
              error: "Failed to load first question. Please try again.", 
              isLoading: false, 
              gamePhase: 'feedback' as GamePhase,
              feedbackText: "很抱歉，在加载您的第一个问题时遇到了技术问题。请再次尝试。"
            }));
          }
          return;
      }

      // Logic for subsequent continues (after actual game questions)
      if (isEnding || currentChildAge >= 17) { // Game ends after age 17 event (becomes 18)
        logger.log("Ending the game and generating summary");
        set(prevState => ({ ...prevState, gamePhase: 'ending_game', isLoading: true, error: null, showFeedback: false, feedbackText: null }));
        try {
          const finalChildState = { ...child, age: 18 };
          const fullGameStateForApi: ApiGameState = {
            player: player!,
            child: finalChildState,
            playerDescription: playerDescription!,
            childDescription: childDescription!,
            history: history,
            wealthTier: wealthTier || 'middle',
            financialBurden: financialBurden || 0,
            isBankrupt: isBankrupt || false, // Pass isBankrupt state
            currentQuestion: cQ_store,
            feedbackText: ft_store,
            endingSummaryText: est_store,
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
          };
          set(prevState => ({ ...prevState, ...newState }));
          saveGameState(get());
        } catch (err) {
          logger.error('Error generating ending summary in store:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to generate ending.';
          set(prevState => ({ ...prevState, gamePhase: 'summary', error: errorMessage, isLoading: false, showEndingSummary: true, endingSummaryText: "Error: Could not generate summary." }));
        }
      } else {
        // Not ending, advance age and load next question.
        logger.log("Advancing to next age:", currentChildAge + 2);
        const nextAge = currentChildAge + 2;
        const newState = {
            showFeedback: false, 
            feedbackText: null,
            child: { ...child, age: nextAge }, 
            currentAge: nextAge,
            gamePhase: 'loading_question' as GamePhase,
            isLoading: true
        };
        set(prevState => ({ ...prevState, ...newState }));
        saveGameState(get());

        if (preloadedNextQuestion) {
          logger.log("Using preloaded question for next age");
          const questionState = {
            currentQuestion: preloadedNextQuestion,
            nextQuestion: null,
            isLoading: false,
            gamePhase: 'playing' as GamePhase,
          };
          set(prevState => ({ ...prevState, ...questionState }));
          saveGameState(get());
        } else {
          logger.log("Loading new question for next age");
          // Call loadQuestion directly instead of in the next tick
          const { enableStreaming } = get();
          if (enableStreaming) {
            await get().loadQuestionStreaming();
          } else {
            await get().loadQuestion();
          }
        }
      }
    },

    resetToWelcome: () => {
      logger.log("Resetting to welcome screen");
      // Clear localStorage state
      clearState();
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

    toggleStreaming: () => {
      const { enableStreaming } = get();
      logger.log(`🔄 Toggling streaming mode from ${enableStreaming} to ${!enableStreaming}`);
      set(prevState => ({ 
        ...prevState, 
        enableStreaming: !enableStreaming 
      }));
      
      // Add a visual confirmation
      console.log(`🔄 Streaming mode is now: ${!enableStreaming ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    },

    openInfoModal: () => {
      logger.log("Opening info modal");
      set(prevState => ({ 
        ...prevState, 
        showInfoModal: true 
      }));
    },

    closeInfoModal: () => {
      logger.log("Closing info modal");
      set(prevState => ({ 
        ...prevState, 
        showInfoModal: false 
      }));
    },

    testEnding: async () => {
      logger.log("Testing ending screen");
      // Create mock game data to test the ending screen
      const mockPlayer: Player = {
        gender: 'female',
        age: 35,
        name: '测试妈妈',
        profile: {},
        traits: [],
      };
      
      const mockChild: Child = {
        name: '小测试',
        gender: 'male',
        age: 18,
        profile: {},
        traits: [],
      };
      
      const mockHistory: HistoryEntry[] = [
        {
          age: 1,
          question: "游戏开始",
          choice: "开始养育",
          outcome: "你的养育之旅开始了。"
        },
        {
          age: 1,
          question: "孩子总是哭闹，你会怎么办？",
          choice: "耐心安抚孩子",
          outcome: "你的耐心让孩子逐渐安静下来，建立了良好的亲子关系。"
        },
        {
          age: 3,
          question: "孩子想要一个昂贵的玩具，但家庭预算紧张。",
          choice: "解释情况，提供替代方案",
          outcome: "孩子理解了家庭情况，学会了理财观念。"
        },
        {
          age: 5,
          question: "孩子在学校成绩不好，你如何应对？",
          choice: "与孩子一起制定学习计划",
          outcome: "通过共同努力，孩子的成绩有了显著提升。"
        },
        {
          age: 7,
          question: "孩子开始叛逆，经常与你发生冲突。",
          choice: "尊重孩子的独立性，同时保持沟通",
          outcome: "你们的关系在理解和尊重中得到了改善。"
        },
        {
          age: 17,
          question: "孩子即将成年，对未来感到迷茫。",
          choice: "给予支持和建议，但让孩子自己做决定",
          outcome: "孩子在你的支持下找到了人生方向，准备迎接成年生活。"
        }
      ];
      
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
        playerDescription: "你是一位35岁的职业女性，在事业和家庭之间努力平衡。你重视教育和家庭价值观，希望给孩子最好的成长环境。",
        childDescription: "小测试是一个聪明活泼的男孩，天生好奇心强，喜欢探索新事物。他有着温和的性格，但也有自己的主见。",
        history: mockHistory,
        currentAge: 18,
        isEnding: true,
        wealthTier: 'middle' as const,
        financialBurden: 5,
        isBankrupt: false,
      }));
      
      // Generate a mock ending summary
      try {
        const fullGameStateForApi: ApiGameState = {
          player: mockPlayer,
          child: mockChild,
          playerDescription: "你是一位35岁的职业女性，在事业和家庭之间努力平衡。你重视教育和家庭价值观，希望给孩子最好的成长环境。",
          childDescription: "小测试是一个聪明活泼的男孩，天生好奇心强，喜欢探索新事物。他有着温和的性格，但也有自己的主见。",
          history: mockHistory,
          wealthTier: 'middle',
          financialBurden: 5,
          isBankrupt: false,
          currentQuestion: null,
          feedbackText: null,
          endingSummaryText: null,
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
      } catch (err) {
        logger.error('Error generating test ending summary:', err);
        // Provide a fallback mock ending
        const mockEndingSummary = `## 最终章：当 小测试 长大成人

**十八岁的 小测试：**
经过18年的精心养育，小测试已经成长为一个自信、独立且富有同理心的年轻人。他在学业上表现优秀，更重要的是，他拥有正确的价值观和良好的人际关系能力。

**为人父母的你：**
作为一位母亲，你在这18年中展现了极大的智慧和耐心。你成功地在给予孩子自由和设定边界之间找到了平衡，培养了一个既独立又有责任感的孩子。

**未来的序曲：**
小测试对未来充满信心和期待。他已经准备好迎接成年生活的挑战，并且知道无论遇到什么困难，都有你的支持和爱作为坚强的后盾。

**岁月回响：**
这18年的养育之旅充满了挑战和喜悦。从最初的不安和摸索，到后来的从容和智慧，你和孩子一起成长，共同创造了美好的回忆。每一个决定都塑造了今天的小测试，也让你成为了更好的自己。

感谢你的养育，这段旅程就此告一段落。

*(这是一个测试结局，用于开发调试)*`;
        
        set(prevState => ({
          ...prevState,
          endingSummaryText: mockEndingSummary,
          showEndingSummary: true,
          gamePhase: 'summary' as GamePhase,
          isLoading: false,
          isEnding: true,
        }));
      }
    },
  };

  logger.log("DEBUG: typeof actions.continueGame IN STORE SETUP:", typeof actions.continueGame); // New Log
  const finalStoreObject = {
    ...initialState, 
    ...actions,      
  };
  logger.log("DEBUG: finalStoreObject.continueGame IN STORE SETUP:", typeof finalStoreObject.continueGame); // New Log
  // console.log("DEBUG: Store state immediately after creation (get()):", get()); // This would cause infinite loop here, call after

  return finalStoreObject;
});

// Log the state after the store is fully created
// We need to do this outside the create callback to avoid issues with `get()` during initialization
setTimeout(() => {
  if (typeof useGameStore.getState === 'function') {
    logger.log("DEBUG: Store state (getState().continueGame) shortly after creation:", typeof useGameStore.getState().continueGame);
    // console.log("DEBUG: Full store state (getState()) shortly after creation:", useGameStore.getState());
  } else {
    logger.log("DEBUG: useGameStore.getState is not yet a function after timeout");
  }
}, 0);

export default useGameStore;
// Placeholder for QuestionType if not already defined elsewhere
// export type { QuestionType };
export type { Player, Child, HistoryEntry, QuestionType, GamePhase }; // Exporting for use in components 
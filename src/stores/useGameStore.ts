import { create } from 'zustand';
// import { persist, createJSONStorage } from 'zustand/middleware'; // Removed unused import
import * as gptService from '../services/gptService';
import type { InitialStateType } from '../services/gptService'; // Ensured type-only import
import * as storageService from '../services/storageService';
import type { GameState as ApiGameState, Player, Child, HistoryEntry, Question as ApiQuestionType } from '../types/game';
import { clearState } from '../services/storageService'; // Keep clearState, remove loadState and saveState as they are used via storageService.* methods
import type { GameStateToStore } from '../services/storageService'; // Import GameStateToStore as a type

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

  currentAge: number; // This might be derived from child.age later
  currentQuestion: QuestionType | null;
  nextQuestion: QuestionType | null;
  isLoading: boolean; // General loading state for questions, outcomes etc. (distinct from initializing)
  error: string | null; // General error state for questions, outcomes etc.
  showFeedback: boolean;
  isEnding: boolean; // True when the game is in the process of ending, before the summary
  showEndingSummary: boolean;
  
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
  selectOption: (optionId: string) => Promise<void>; // Now async
  continueGame: () => Promise<void>; // Now async for potential ending generation
  resetToWelcome: () => void; // New function to reset to the welcome screen
}

// Helper function to save current state to localStorage
const saveGameState = (state: GameStoreState) => {
  if (!state.player || !state.child) {
    console.log("Not saving state - player or child missing", { player: state.player, child: state.child });
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
  
  console.log("Saving game state to localStorage:", stateToStore);
  storageService.saveState(stateToStore);
};

const useGameStore = create<GameStoreState>((set, get) => {
  // Try to load initial state from localStorage
  const savedState = storageService.loadState();
  console.log("Loaded state from localStorage:", savedState);
  
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
    
    currentAge: 0,
    currentQuestion: null,
    nextQuestion: null,
    isLoading: false,
    error: null,
    showFeedback: false,
    isEnding: false,
    showEndingSummary: false,
    pendingChoice: null,
    
    // Define all required functions up front with unused parameters prefixed
    initializeGame: async (_options?: { specialRequirements?: string; preloadedState?: InitialStateType }) => { console.log("initializeGame stub called") },
    startGame: (_player: Player, _child: Child, _playerDescription: string, _childDescription: string) => { console.log("startGame stub called") },
    continueSavedGame: () => { console.log("continueSavedGame stub called") },
    loadQuestion: async () => { console.log("loadQuestion stub called") },
    selectOption: async () => { console.log("selectOption stub called") },
    continueGame: async () => { console.log("continueGame stub called") },
    resetToWelcome: () => { console.log("resetToWelcome stub called") },
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
    
    console.log("Initialized game with saved state:", initialState);
  }

  const actions = {
    initializeGame: async (options?: { specialRequirements?: string; preloadedState?: InitialStateType }) => {
      // Clear any existing state before initializing a new game
      clearState();
      
      const startTime = Date.now(); // Record start time for the 2-second delay logic

      // Reset to initializing state with empty values
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
        currentAge: 0,
        currentQuestion: null,
        nextQuestion: null,
        showFeedback: false,
        isEnding: false,
        showEndingSummary: false,
        pendingChoice: null, // Make sure to clear pendingChoice as well
      }));
      
      try {
        // Force a state update to ensure any components dependent on this state re-render
        // This helps prevent stale UI states
        await new Promise(resolve => setTimeout(resolve, 0));
        
        console.log("Initializing new game with fresh state" + (options?.specialRequirements ? " and special requirements" : ""));
        
        const initialState: ApiGameState = await gptService.generateInitialState(options);

        // If a preloaded state was used, ensure a minimum 2-second loading display
        if (options?.preloadedState) {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = 2000 - elapsedTime;
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
        }

        const playerDesc = initialState.player.gender === 'male' ? '父亲' : '母亲';
        const childDesc = initialState.child.gender === 'male' ? '男孩' : '女孩';
        const narrative = `作为${playerDesc}（${initialState.player.age}岁），你即将开始养育你的孩子${initialState.child.name}（${childDesc}，刚刚出生）的旅程。

${initialState.playerDescription}

${initialState.childDescription}

从0岁开始，你将面临各种养育过程中的抉择，这些选择将影响孩子的成长和你们的家庭关系。

准备好开始这段旅程了吗？`;

        // Initial history entry for game start (age 0, before first question)
        const initialHistoryEntry: HistoryEntry = {
          age: 0,
          question: "游戏开始",
          choice: "开始养育旅程",
          outcome: narrative.substring(0, narrative.lastIndexOf('\n\n准备好开始这段旅程了吗？')) // Get only the descriptive part
        };

        const newState = {
          player: initialState.player,
          child: { ...initialState.child, age: 0 }, // Ensure child age starts at 0
          playerDescription: initialState.playerDescription,
          childDescription: initialState.childDescription,
          currentAge: 0, // Current display age starts at 0
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
        
        set(prevState => ({ ...prevState, ...newState }));
        
        // Save to localStorage
        saveGameState(get());
      } catch (err) {
        console.error('Error initializing game in store:', err);
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
        // Correctly set child age to 0 for preloadedState
        get().initializeGame({ specialRequirements: '', preloadedState: { player, child: { ...child, age: 0 }, playerDescription, childDescription } });
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
          // Correctly set child age to 0 for preloadedState
          get().initializeGame({ specialRequirements: '', preloadedState: { player, child: { ...child, age: 0 }, playerDescription, childDescription } }); 
        }
      } else {
        console.warn("startGame called in an unexpected phase:", get().gamePhase);
      }
    },

    // New function to handle continuing a saved game
    continueSavedGame: () => {
      console.log("Continuing saved game with state:", get());
      
      // Check if we're in an error state with "Failed to fetch" error
      const currentError = get().error;
      const pendingChoice = get().pendingChoice;
      
      // If there was a pending choice and an error occurred (API likely failed)
      if (pendingChoice && currentError && currentError.includes("Failed to fetch")) {
        console.log("Detected pending choice with 'Failed to fetch' error, returning to question state");
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
                { id: pendingChoice.optionId, text: pendingChoice.optionText },
                // Provide recovery options
                { id: "retry", text: "重新尝试相同的选择" },
                { id: "reload", text: "重新加载游戏" }
              ],
              isExtremeEvent: false
            },
          }));
          
          // Update handler for selectOption to handle the recovery options
          return;
        }
      } else if (currentError && currentError.includes("Failed to fetch")) {
        console.log("Detected 'Failed to fetch' error after refresh, resetting to question state");
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
        console.log("Continuing to playing phase with existing question");
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
        console.log("Continuing to feedback phase with existing feedback");
      }
      // If we're at the initial welcome phase with saved data
      else if (get().player && get().child) {
        // First check if we have a beginning narrative in history
        const initialStoryEntry = get().history.find(h => h.question === "游戏开始");
        
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
          console.log("Continuing with initial narrative");
        } else {
          // Need to get a question - transition to playing
          console.log("No narratives or questions found - loading question for current age");
          set(prevState => ({ ...prevState, error: null }));
          get().loadQuestion();
        }
      }
      else {
        console.warn("continueSavedGame: No valid saved state to continue");
      }
    },

    loadQuestion: async () => {
      const { child, player, playerDescription, childDescription, history } = get();
      if (!child || !player) {
          set(prevState => ({ ...prevState, error: "Cannot load question: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
          return;
      }
      set(prevState => ({ ...prevState, gamePhase: 'loading_question', isLoading: true, error: null, currentQuestion: null }));
      try {
        console.log("Preparing game state for API call");
        const fullGameStateForApi: ApiGameState = {
            player: player!,
            child: child!, // child.age is the current age (e.g., 0 for first question set)
            playerDescription: playerDescription!,
            childDescription: childDescription!,
            history: history,
        };
        
        console.log("Making API call to fetch question for age:", child.age);
        // fetchQuestion service is expected to ask for child.age (e.g. 0-th year events)
        // or child.age+1 (e.g. events for 1-year-old if child.age is 0)
        // The gptService.generateQuestionPrompt uses `gameState.child.age + 1`.
        // So if child.age is 0 (meaning currently 0 years old), it will ask for events for a 1-year-old.
        // This seems acceptable; the game narrative can adapt. The history will record event at age 0.
        let question;
        try {
          question = await gptService.generateQuestion(fullGameStateForApi);
          console.log("Successfully received question from API:", question);
        } catch (apiError) {
          console.error("API error when fetching question:", apiError);
          // Create a fallback question if the API fails
          question = {
            id: `fallback-${Date.now()}`,
            question: `你的${child.age}岁孩子${child.name}正在成长，现在需要你的指导。`,
            options: [
              { id: "option1", text: "耐心倾听并理解孩子的需求" },
              { id: "option2", text: "给予适当的引导和建议" },
              { id: "option3", text: "鼓励孩子独立思考解决问题" }
            ],
            isExtremeEvent: false
          };
          console.log("Using fallback question:", question);
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
          console.error('Error in loadQuestion function:', err);
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
                { id: "retry", text: "重新尝试" },
                { id: "reload", text: "刷新页面" }
              ],
              isExtremeEvent: false
            }
          })); 
      }
    },

    selectOption: async (optionId: string) => {
      const { currentQuestion, player, child, playerDescription, childDescription, history } = get();
      if (!currentQuestion || !player || !child) {
        set(prevState => ({ ...prevState, error: "Cannot select option: Missing data.", gamePhase: 'playing', isLoading: false }));
        return;
      }
      
      // Special handling for recovery options
      if (optionId === "retry") {
        // This is a special option to retry the last pending choice
        console.log("User selected to retry the last pending choice");
        // Clear error state and reload question
        set(prevState => ({ ...prevState, error: null, isLoading: false }));
        get().loadQuestion();
        return;
      } else if (optionId === "reload") {
        // This is a special option to reload the game
        console.log("User selected to reload the game");
        window.location.reload();
        return;
      }
      
      const selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
      if (!selectedOption) {
          set(prevState => ({ ...prevState, error: "Invalid option selected.", gamePhase: 'playing', isLoading: false }));
          return;
      }

      // Save the current question and selected option before making the API call
      // This will help with recovery if user refreshes during the API call
      
      // Save this intermediate state to localStorage so we can recover if needed
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
      
      set(prevState => ({ ...prevState, gamePhase: 'generating_outcome', isLoading: true, error: null }));
      try {
        const eventAge = child.age; 
        const fullGameStateForApi: ApiGameState = {
          player: player!,
          child: child!,
          playerDescription: playerDescription!,
          childDescription: childDescription!,
          history: history,
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
        
        console.log(`Updated history: Removed entry for age ${eventAge} if it existed, added new entry`);
        
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
        console.error('Error generating outcome in store:', err);
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

    continueGame: async () => {
      const { isEnding, gamePhase, child, player, playerDescription, childDescription, history, nextQuestion: preloadedNextQuestion } = get();
      
      if (gamePhase !== 'feedback') {
          console.warn("continueGame called in an unexpected phase:", gamePhase);
          return;
      }
      if (!child || !player) {
          set(prevState => ({ ...prevState, error: "Cannot continue: Player or child data is missing.", gamePhase: 'initialization_failed', isLoading: false }));
          return;
      }

      const currentChildAge = child.age;
      console.log("Continue game called. Current age:", currentChildAge, "History entries:", history.length);

      // Special handling for initial game state - when we have just initialized the game
      // and we're showing the initial narrative (at age 0)
      if (history.length === 1 && history[0].question === "游戏开始") { 
          console.log("DEBUG: Entered initial narrative block in continueGame"); // New Log
          console.log("Continuing from initial narrative to first question");
          // Load first question (for age 0)
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
              console.log("DEBUG: Attempting to load first question - BEFORE await loadQuestion()"); // New Log
              await get().loadQuestion();
              console.log("DEBUG: Successfully loaded first question - AFTER await loadQuestion()"); // New Log
              console.log("Successfully loaded first question");
            } catch (innerErr) {
              console.error("Error during loadQuestion:", innerErr);
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
            console.error("Error continuing from initial narrative:", err);
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
        console.log("Ending the game and generating summary");
        set(prevState => ({ ...prevState, gamePhase: 'ending_game', isLoading: true, error: null, showFeedback: false, feedbackText: null }));
        try {
          const finalChildState = { ...child, age: 18 };
          const fullGameStateForApi: ApiGameState = {
            player: player!,
            child: finalChildState,
            playerDescription: playerDescription!,
            childDescription: childDescription!,
            history: history,
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
          console.error('Error generating ending summary in store:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to generate ending.';
          set(prevState => ({ ...prevState, gamePhase: 'summary', error: errorMessage, isLoading: false, showEndingSummary: true, endingSummaryText: "Error: Could not generate summary." }));
        }
      } else {
        // Not ending, advance age and load next question.
        console.log("Advancing to next age:", currentChildAge + 1);
        const nextAge = currentChildAge + 1;
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
          console.log("Using preloaded question for next age");
          const questionState = {
            currentQuestion: preloadedNextQuestion,
            nextQuestion: null,
            isLoading: false,
            gamePhase: 'playing' as GamePhase,
          };
          set(prevState => ({ ...prevState, ...questionState }));
          saveGameState(get());
        } else {
          console.log("Loading new question for next age");
          // Call loadQuestion directly instead of in the next tick
          await get().loadQuestion(); 
        }
      }
    },

    resetToWelcome: () => {
      console.log("Resetting to welcome screen");
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
        currentAge: 0,
        currentQuestion: null,
        nextQuestion: null,
        isLoading: false,
        error: null,
        showFeedback: false,
        isEnding: false,
        showEndingSummary: false,
        pendingChoice: null,
      });
    },
  };

  console.log("DEBUG: typeof actions.continueGame IN STORE SETUP:", typeof actions.continueGame); // New Log
  const finalStoreObject = {
    ...initialState, 
    ...actions,      
  };
  console.log("DEBUG: finalStoreObject.continueGame IN STORE SETUP:", typeof finalStoreObject.continueGame); // New Log
  // console.log("DEBUG: Store state immediately after creation (get()):", get()); // This would cause infinite loop here, call after

  return finalStoreObject;
});

// Log the state after the store is fully created
// We need to do this outside the create callback to avoid issues with `get()` during initialization
setTimeout(() => {
  if (typeof useGameStore.getState === 'function') {
    console.log("DEBUG: Store state (getState().continueGame) shortly after creation:", typeof useGameStore.getState().continueGame);
    // console.log("DEBUG: Full store state (getState()) shortly after creation:", useGameStore.getState());
  } else {
    console.log("DEBUG: useGameStore.getState is not yet a function after timeout");
  }
}, 0);

export default useGameStore;
// Placeholder for QuestionType if not already defined elsewhere
// export type { QuestionType };
export type { Player, Child, HistoryEntry, QuestionType, GamePhase }; // Exporting for use in components 
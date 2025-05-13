import { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header'
import { QuestionDisplay } from './components/QuestionDisplay'
import { FeedbackDisplay } from './components/FeedbackDisplay'
import { TimelineProvider } from './components/TimelineProvider'
import { 
  generateQuestion, 
  generateOutcomeAndNextQuestion, 
  generateInitialState, 
  generateEnding, 
  resetTokenUsageStats,
  getTokenUsageStats
} from './services/gptService'
import type { Question, GameState } from './types/game'
import { loadState, saveState, clearState } from './utils/storage'
import type { GameStateToStore } from './utils/storage'
import './App.css'
import { WelcomeScreen } from './pages'
import ReactMarkdown from 'react-markdown'; // Added import
// Add comment to clarify the removed component
// The StoryDialog component was removed to eliminate the square on top of the page with age dropdown
// import { StoryDialog } from './components/StoryDialog'

function App() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentAge, setCurrentAge] = useState<number>(() => {
    const loaded = loadState();
    return (loaded && loaded.child.name) ? loaded.currentYear : 0;
  })
  const [nextQuestion, setNextQuestion] = useState<Question | null>(null)
  const [isEnding, setIsEnding] = useState(false)
  const [gameStarted, setGameStarted] = useState<boolean>(() => {
    const loaded = loadState();
    return !!(loaded && loaded.child.name && (loaded.history.length > 0 || loaded.currentYear >= 0));
  })
  const [initialFeedback, setInitialFeedback] = useState('')
  const [endingSummary, setEndingSummary] = useState<string>('');
  const [showEndingSummary, setShowEndingSummary] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(() => {
    const loaded = loadState();
    return !(loaded && loaded.child.name && (loaded.history.length > 0 || loaded.currentYear >= 0));
  })
  const [gameDataLoaded, setGameDataLoaded] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isLoadingFirstQuestion, setIsLoadingFirstQuestion] = useState(false);
  
  // Define default game state with minimum required fields
  const [gameState, setGameState] = useState<GameState>(() => {
    // Attempt to load state initially, but primarily rely on useEffect for full setup
    // This immediate load helps avoid a flicker if initial state is vastly different
    const loaded = loadState();
    if (loaded && loaded.child.name) { // Basic check for valid loaded state
      return {
        player: { gender: loaded.player.gender, age: loaded.player.age },
        child: { name: loaded.child.name, gender: loaded.child.gender, age: loaded.child.age },
        history: loaded.history,
        playerDescription: loaded.player.description,
        childDescription: loaded.child.description,
      };
    }
    return { // Default initial state
      player: {
        gender: 'female' as 'male' | 'female',
        age: 30
      },
      child: {
        name: '',
        gender: 'male' as 'male' | 'female',
        age: 0
      },
      history: [],
      playerDescription: '',
      childDescription: ''
    };
  });

  // Calculate if the story dialog should be visible based on history
  const hasStoryToShow = gameState.history.length > 0;

  // 添加一个状态来跟踪loadQuestion是否正在执行
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  // Load initial state when start loading is triggered
  const handleStartLoading = () => {
    setShowWelcomeScreen(false);
    initializeGame();
  };

  const initializeGame = async () => {
    setIsLoading(true);
    setGameDataLoaded(false);
    setInitialLoadComplete(false); // Mark as not complete while initializing a new game
    setError(null);
    try {
      // Get the initial state from API
      const initialState = await generateInitialState();
      
      // Set the game state with the initial data
      setGameState(prevState => {
        return {
          player: {
            ...prevState.player,
            ...initialState.player
          },
          child: {
            ...prevState.child,
            ...initialState.child
          },
          history: [],
          playerDescription: initialState.playerDescription || '',
          childDescription: initialState.childDescription || ''
        };
      });
      
      // Create initial feedback describing the game state
      const playerDesc = initialState.player.gender === 'male' ? '父亲' : '母亲';
      const childDesc = initialState.child.gender === 'male' ? '男孩' : '女孩';
      
      // Create the initial description
      const initialDesc = `作为${playerDesc}（${initialState.player.age}岁），你即将开始养育你的孩子${initialState.child.name}（${childDesc}，刚刚出生）的旅程。

${initialState.playerDescription}

${initialState.childDescription}

从0岁开始，你将面临各种养育过程中的抉择，这些选择将影响孩子的成长和你们的家庭关系。

准备好开始这段旅程了吗？`;
        
      setInitialFeedback(initialDesc);
      setGameDataLoaded(true);
      setInitialLoadComplete(true); // Now initialization is complete for this new game
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化游戏时发生错误');
      console.error('Error initializing game:', err);
      setGameDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Wrap handleStartGame in useCallback because it's used in useEffect dependency array
  const handleStartGame = useCallback(() => {
    // Reset token usage stats only when the game truly starts
    resetTokenUsageStats();
    console.log('🎮 Game started - token tracking initialized');
    
    setGameStarted(true);
    setShowFeedback(true);
    setFeedback(initialFeedback);
  }, [initialFeedback]);

  // useEffect to automatically start the game once data is loaded
  useEffect(() => {
    // If data is loaded, we are past the welcome screen, and the game hasn't started yet...
    if (gameDataLoaded && !gameStarted && !showWelcomeScreen) {
      handleStartGame(); // ...start the game automatically.
    }
  }, [gameDataLoaded, gameStarted, showWelcomeScreen, handleStartGame]);

  useEffect(() => {
    if (!initialLoadComplete) return; // Wait for initial load to complete

    // Only load question if game has started (and not the very first feedback screen)
    if (gameStarted && !showFeedback) { 
      console.log(`🔍 useEffect triggered for question logic - gameStarted: ${gameStarted}, currentAge: ${currentAge}, nextQuestion exists: ${!!nextQuestion}, initialLoadComplete: ${initialLoadComplete}`);
      
      if (nextQuestion) {
        console.log(`📋 Using pre-loaded question for age ${currentAge}`);
        if (!nextQuestion.id) {
          nextQuestion.id = `question-${currentAge + 1}`;
        }
        setCurrentQuestion(nextQuestion);
        setNextQuestion(null);
      } else if (!currentQuestion && !isLoadingQuestion) { 
        console.log(`📋 Loading new question for age ${currentAge}`);
        loadQuestion();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAge, gameStarted, showFeedback, nextQuestion, currentQuestion, isLoadingQuestion, initialLoadComplete]); // Added initialLoadComplete

  const handleFirstContinue = async () => {
    setIsLoadingFirstQuestion(true);
    setError(null); // Clear previous errors if any

    try {
      // Directly call loadQuestion to fetch the first question
      await loadQuestion(); 
      // Only hide the feedback screen if question loading was initiated successfully
      // loadQuestion itself will set currentQuestion or error
      setShowFeedback(false); 
    } catch (err) {
      // Error is handled by loadQuestion (sets error state).
      // We remain on the feedback screen, and isLoadingFirstQuestion will be set to false in finally.
      // This allows the button to revert from "加载中..."
      console.error("Error during handleFirstContinue -> loadQuestion:", err);
    } finally {
      setIsLoadingFirstQuestion(false);
    }
  };

  const loadQuestion = async () => {
    // 如果已经在加载中，跳过
    if (isLoadingQuestion) {
      console.log('⚠️ Skipping loadQuestion call - already loading');
      return;
    }
    
    setIsLoadingQuestion(true);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 Starting to load question for age ${currentAge + 1}`);
      
      const question = await generateQuestion(gameState);
      // 确保问题有ID
      if (!question.id) {
        question.id = `question-${currentAge + 1}`;
      }
      
      console.log(`✅ Successfully loaded question for age ${currentAge + 1}:`, question.question.substring(0, 50) + '...');
      
      setCurrentQuestion(question);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载问题时发生错误');
      console.error('Error loading question:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingQuestion(false);
    }
  }

  const handleSelectOption = async (optionId: string) => {
    if (!currentQuestion) return

    setIsLoading(true)
    setError(null)
    try {
      const selectedOption = currentQuestion.options.find(opt => opt.id === optionId)
      if (!selectedOption) throw new Error('选项不存在')

      // 使用新的合并函数获取反馈和下一个问题
      const result = await generateOutcomeAndNextQuestion(
        gameState,
        currentQuestion.question,
        selectedOption.text
      )
      
      setFeedback(result.outcome)
      
      // If the API indicates an ending, set the ending flag.
      // Age-based ending (18) will be handled in handleContinue.
      if (result.isEnding) {
        setIsEnding(true)
      } else if (result.nextQuestion) {
        // Preload the next question
        setNextQuestion(result.nextQuestion)
      } else {
        // Handle case where no next question is provided but it's not the end
        console.warn("No next question provided, but not marked as ending.");
        // Consider potentially fetching a new question here or handling differently
      }

      // Update game state *after* processing is done
      setGameState(prev => {
        // Filter out any existing history entry for the currentAge to prevent duplicates
        const historyWithoutCurrentAgeEntry = prev.history.filter(
          entry => entry.age !== currentAge
        );

        const newHistoryEntry = {
          age: currentAge,
          question: currentQuestion.question,
          choice: selectedOption.text,
          outcome: result.outcome
        };

        // Add the new entry and sort the history to maintain order
        const updatedHistory = [...historyWithoutCurrentAgeEntry, newHistoryEntry].sort(
          (a, b) => a.age - b.age
        );

        return {
          ...prev,
          child: {
            ...prev.child,
            age: currentAge // This updates the child's biological age displayed in some UIs
                           // Note: currentAge in history entry refers to the game event age.
          },
          history: updatedHistory
        };
      })

      // Reset current question *before* showing feedback
      setCurrentQuestion(null); 
      setShowFeedback(true) // Show feedback *after* processing and state updates

    } catch (err) {
      setError(err instanceof Error ? err.message : '处理选项时发生错误')
      console.error('Error handling option selection:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async () => {
    setShowFeedback(false);

    if (isEnding) {
      // If it's an API-triggered ending or already set ending, generate and show the summary
      setIsLoading(true);
      setError(null);
      try {
        console.log('📊 Generating ending summary (isEnding was true)');
        const summary = await generateEnding(gameState);
        setEndingSummary(summary);
        
        // Log token usage stats
        const tokenStats = getTokenUsageStats();
        console.log('📊 Final token usage statistics:', tokenStats);
        
        setShowEndingSummary(true); // Show the summary screen
      } catch (err) {
        setError(err instanceof Error ? err.message : '生成游戏结局时发生错误');
        console.error('Error generating game ending:', err);
        setShowFeedback(true); // Show feedback again if error occurs
      } finally {
        setIsLoading(false);
      }
    } else {
      // Not an API-triggered ending, proceed to the next age
      const newAge = currentAge + 1;
      
      if (newAge === 18) { // Check if the new age is the trigger for the game end
        console.log(`⏳ Reached age 18. Current age was: ${currentAge}. New age: ${newAge}. Preparing for ending.`);
        // Update age first, then set ending.
        // The gameState used by generateEnding should ideally have the child at age 17 for the last event,
        // and the summary prompt correctly indicates 18.
        setCurrentAge(newAge); 
        setIsEnding(true); // Now set the ending flag

        // Trigger summary generation for age 18
        setIsLoading(true);
        setError(null);
        try {
          console.log('📊 Generating ending summary because age reached 18');
          // Ensure gameState reflects the state before ending, typically history up to age 17 decision.
          // The generateEnding function internally handles the 18-year-old context for the narrative.
          const summary = await generateEnding(gameState); 
          setEndingSummary(summary);
          
          const tokenStats = getTokenUsageStats();
          console.log('📊 Final token usage statistics:', tokenStats);
          
          setShowEndingSummary(true); 
        } catch (err) {
          setError(err instanceof Error ? err.message : '生成游戏结局时发生错误');
          console.error('Error generating game ending at age 18:', err);
          // If summary generation fails, perhaps allow continuing or show error.
          // For now, re-showing feedback might be confusing. Let's just log and set error.
        } finally {
          setIsLoading(false);
        }
      } else {
        // Continue to the next age if not 18 yet
        console.log(`🔄 Continuing to next age: ${currentAge} -> ${newAge}`);
        setCurrentAge(newAge); 
        // Question loading is handled by the useEffect watching [currentAge, gameStarted, showFeedback]
      }
    }
  };

  // 修改重新开始游戏函数，使其重置token统计
  const handleRestartGame = () => {
    clearState(); // Clear localStorage
    console.log('🗑️ Cleared localStorage and restarting game.');

    resetTokenUsageStats();
    console.log('🎮 Game restarted - token tracking reset');
    
    setGameStarted(false);
    setShowFeedback(false);
    setFeedback('');
    setInitialFeedback('');
    setIsLoading(false);
    setError(null);
    setCurrentAge(0);
    setNextQuestion(null);
    setIsEnding(false);
    setShowEndingSummary(false);
    setEndingSummary('');
    setShowWelcomeScreen(true); // Go back to welcome screen
    setGameDataLoaded(false); // Reset data loaded flag
    setCurrentQuestion(null); // Clear any potentially loaded question
    setIsLoadingQuestion(false); // Reset question loading flag
    setInitialLoadComplete(false); // Crucially reset this flag
    
    // Reset game state object to initial defaults
    setGameState({
      player: { gender: 'female', age: 30 },
      child: { name: '', gender: 'male', age: 0 },
      history: [],
      playerDescription: '',
      childDescription: ''
    });
  };

  // Handler for testing the ending page directly
  const handleTestEnding = async () => {
    setShowWelcomeScreen(false); // Hide welcome screen
    setIsLoading(true);
    setError(null);

    const mockGameStateForEnding: GameState = {
      player: { gender: 'female', age: 48 }, // Example age after 18 years
      child: { name: 'Test Child', gender: 'male', age: 18 },
      playerDescription: 'A test parent who reached the end quickly for development purposes.',
      childDescription: 'A test child who grew up in an instant for testing. Full of potential!',
      history: [
        { age: 0, question: 'Test Event 1', choice: 'Test Choice A', outcome: 'The child learned something from test event 1.' },
        { age: 5, question: 'Test Event 2', choice: 'Test Choice B', outcome: 'A major developmental milestone occurred during test event 2.' },
        { age: 12, question: 'Test Event 3', choice: 'Test Choice C', outcome: 'The teenage years began with this test event.' }
      ]
    };

    // Set this mock state so the ending page can use it (e.g., for child's name and token stats display)
    setGameState(mockGameStateForEnding);
    // Also ensure currentAge is set if any part of the ending screen logic relies on it directly
    setCurrentAge(18);

    try {
      console.log('🧪 Triggering test ending generation with mock state:', mockGameStateForEnding);
      const summary = await generateEnding(mockGameStateForEnding);
      setEndingSummary(summary);
      
      // This will show actual API usage for this specific generateEnding call
      const tokenStats = getTokenUsageStats(); 
      console.log('📊 Token usage statistics for test ending call:', tokenStats);
      
      setShowEndingSummary(true); 
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成测试结局时发生错误';
      setError(errorMessage);
      console.error('Error generating test ending:', err);
      // Optionally, show feedback or error screen instead of just console logging
      // For now, it will fall through to the error display in the main return if setError is called.
    } finally {
      setIsLoading(false);
    }
  };

  // Effect for initial load and setup from localStorage
  useEffect(() => {
    const loadedState = loadState();
    if (loadedState && loadedState.child.name) { 
      console.log("Loaded state from localStorage:", loadedState);
      
      setGameState(prevState => ({
        ...prevState, 
        player: { gender: loadedState.player.gender, age: loadedState.player.age },
        child: { name: loadedState.child.name, gender: loadedState.child.gender, age: loadedState.child.age },
        history: loadedState.history,
        playerDescription: loadedState.player.description,
        childDescription: loadedState.child.description,
      }));
      setCurrentAge(loadedState.currentYear);

      if (loadedState.activeQuestion) {
        console.log("Restoring active question:", loadedState.activeQuestion);
        setCurrentQuestion(loadedState.activeQuestion);
        setShowFeedback(false); 
        setGameStarted(true);
        setShowWelcomeScreen(false);
        setGameDataLoaded(true); 
        setInitialFeedback(''); 
        console.log("Game resumed with an active question displayed.");
      } else if (loadedState.history.length > 0 || loadedState.currentYear >= 0) {
        setGameStarted(true);
        setShowWelcomeScreen(false);
        setGameDataLoaded(true); 
        setInitialFeedback(''); 
        setShowFeedback(false); 
        console.log("Game resumed from saved state, will load question for current age or show initial feedback.");
      }
    } else {
      setShowWelcomeScreen(true);
      console.log("No valid saved game state found or new game, starting with welcome screen.");
    }
    setInitialLoadComplete(true); // Signal that initial loading attempt is done
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Effect for saving state to localStorage
  useEffect(() => {
    if (gameStarted && gameState.child.name) { // Only save if game has started and is initialized
      const stateToSave: GameStateToStore = {
        player: {
          ...gameState.player,
          description: gameState.playerDescription,
        },
        child: {
          ...gameState.child,
          description: gameState.childDescription,
        },
        history: gameState.history,
        currentYear: currentAge,
        activeQuestion: currentQuestion, // Save the currentQuestion
      };
      saveState(stateToSave);
      console.log("Game state saved to localStorage at year:", currentAge, "with active question:", !!currentQuestion);
    }
  }, [gameState, currentAge, gameStarted, currentQuestion]); // Added currentQuestion to dependencies

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">发生错误</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={handleRestartGame}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重新开始游戏
          </button>
        </div>
      </div>
    )
  }

  // Timeline visibility condition
  const showTimeline = hasStoryToShow && gameStarted && !showEndingSummary;

  // Helper function to render main content based on state
  const renderMainContent = () => {
    if (showWelcomeScreen) {
      return <WelcomeScreen onStartLoading={handleStartLoading} onTestEnding={handleTestEnding} />;
    }
    
    if (isLoading && !gameDataLoaded && !showEndingSummary) {
      // Show loading only during initial data fetch
      return (
        <div className="text-center py-10">
          <p className="text-lg text-gray-600 animate-pulse">...经过3亿个精子的激烈角逐，数十个卵泡中的艰难竞争，再加上漫长而艰辛的十月怀胎，你家娃终于决定降临人间，准备向你发起最甜蜜又最痛苦的挑战了！...</p>
          {/* You could add a visual spinner here */}
        </div>
      );
    }

    if (showEndingSummary) {
      // Render Ending Summary Screen
      return (
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 mb-6 animate-fadeIn">
          <h2 className="text-2xl font-bold text-center mb-6 text-purple-700">养育之旅圆满结束</h2>
          <div className="text-center mb-4">
            <span className="inline-block bg-purple-100 text-purple-800 text-sm font-semibold px-3 py-1 rounded-full">
              {gameState.child.name} 已经长大成人，18岁了
            </span>
          </div>
          <div className="mb-8">
            <div className="prose prose-lg mx-auto"> {/* Removed whitespace-pre-line as react-markdown handles newlines */}
              <ReactMarkdown>{endingSummary}</ReactMarkdown> {/* Used ReactMarkdown */}
            </div>
          </div>
          
          {/* Token Usage Stats */}
          <div className="mt-8 mb-6 border-t pt-4">
            <h3 className="text-center text-lg font-semibold text-gray-700 mb-3">游戏API消耗统计</h3>
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <p className="mb-1">API调用次数: <span className="font-semibold">{getTokenUsageStats().apiCalls}次</span></p>
              <p className="mb-1">总Token数: <span className="font-semibold">{getTokenUsageStats().totalTokens.toLocaleString()}个</span></p>
              <p className="mb-1">输入Token: <span className="font-semibold">{getTokenUsageStats().promptTokens.toLocaleString()}个</span></p>
              <p className="mb-1">输出Token: <span className="font-semibold">{getTokenUsageStats().completionTokens.toLocaleString()}个</span></p>
              <p className="mb-1">预估花费: <span className="font-semibold">${getTokenUsageStats().estimatedCost.toFixed(6)} USD</span></p>
            </div>
          </div>
          
          <div className="text-center mb-6">
            <p className="text-gray-600 italic">感谢你参与这段养育的旅程</p>
          </div>
          <button
            onClick={handleRestartGame}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            重新开始新的养育之旅
          </button>
        </div>
      );
    }

    if (gameStarted) {
      // Render Game Play (Feedback or Question)
      if (showFeedback) {
        return (
          <FeedbackDisplay
            feedback={feedback}
            onContinue={
              (currentAge === 0 && gameState.history.length === 0) 
              ? handleFirstContinue 
              : handleContinue
            }
            isEnding={isEnding}
            isFirstQuestion={currentAge === 0 && gameState.history.length === 0}
            isLoadingFirstQuestion={(currentAge === 0 && gameState.history.length === 0) ? isLoadingFirstQuestion : undefined}
          />
        );
      } else if (currentQuestion) {
        return (
          <QuestionDisplay
            question={currentQuestion}
            onSelectOption={handleSelectOption}
            isLoading={isLoading}
            childName={gameState.child.name}
          />
        );
      } else {
         // If game started, not showing feedback, but no question yet (likely loading)
         return (
           <div className="text-center py-10">
             <p className="text-lg text-gray-600 animate-pulse">加载中...</p>
           </div>
         );
      }
    }

    // Fallback case (should ideally not be reached if logic is correct)
    return (
      <div className="text-center py-10">
        <p className="text-lg text-gray-600">请稍候...</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      {/* Main content area with timeline */}
      <div className="flex flex-1 pt-16">
        {/* Timeline Component and Restart Button */}
        {showTimeline && (
          <div className="w-64 p-4 border-r border-gray-200 bg-white flex flex-col space-y-4">
            {gameState.child.name && (
              <button
                onClick={handleRestartGame}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                放弃{gameState.child.name}，重新开始
                
              </button>
            )}
            <TimelineProvider 
              history={gameState.history}
              currentAge={currentAge}
              isVisible={true}
              hideLatest={showFeedback && !isEnding} // Hide latest timeline node when showing feedback (unless it's the ending)
            />
          </div>
        )}
        
        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <main className="container mx-auto px-4 sm:px-6 flex-1 flex flex-col">
            <div className="flex-1"></div> {/* Spacer to push content to bottom */}
            <div className="py-6 pb-12 max-w-3xl mx-auto w-full"> 
              {renderMainContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
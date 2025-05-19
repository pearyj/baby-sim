import { Header } from './components/Header'
import { QuestionDisplay } from './components/QuestionDisplay'
import { FeedbackDisplay } from './components/FeedbackDisplay'
import { TimelineProvider } from './components/TimelineProvider'
import { WelcomeScreen } from './pages'
import ReactMarkdown from 'react-markdown'
import './App.css'

import useGameStore from './stores/useGameStore'
import { useGameFlow } from './hooks/useGameFlow'
// Removed direct gptService and storageService imports
// Removed Question, GameState, GameStateToStore type imports from local files if not used by App.tsx directly

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
    initializeGame,
    selectOption,
    continueGame,
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
    initializeGame: state.initializeGame,
    startGame: state.startGame,
    selectOption: state.selectOption,
    continueGame: state.continueGame,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">发生错误</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={initializeGame}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重新开始游戏
          </button>
        </div>
      </div>
    );
  }

  const renderMainContent = () => {
    if (gamePhase === 'initializing') {
      return (
        <div className="text-center py-10">
          <p className="text-lg text-gray-600 animate-pulse">{'...经过3亿个精子的激烈角逐，数十个卵泡中的艰难竞争，再加上漫长而艰辛的十月怀胎，你家娃终于决定降临人间，准备向你发起最甜蜜又最痛苦的挑战了！...'}</p>
        </div>
      );
    }

    if (gamePhase === 'uninitialized' || gamePhase === 'initialization_failed' || gamePhase === 'welcome') {
      // No longer need to determine action here, WelcomeScreen handles this
      return <WelcomeScreen onTestEnding={isDevelopment ? initializeGame : undefined} />;
    }
    
    if (isEndingPhase) {
      return (
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 mb-6 animate-fadeIn">
          <h2 className="text-2xl font-bold text-center mb-6 text-purple-700">养育之旅圆满结束</h2>
          <div className="text-center mb-4">
            <span className="inline-block bg-purple-100 text-purple-800 text-sm font-semibold px-3 py-1 rounded-full">
              {child?.name || '你的孩子'} 已经长大成人，18岁了
            </span>
          </div>
          <div className="mb-8">
            <div className="prose prose-lg mx-auto">
              <ReactMarkdown>{endingSummaryText || (isLoading && gamePhase === 'ending_game' ? "结局生成中..." : "结局回顾完毕。")}</ReactMarkdown>
            </div>
          </div>
          <div className="text-center mb-6">
            <p className="text-gray-600 italic">感谢你参与这段养育的旅程</p>
          </div>
          <button
            onClick={initializeGame}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            重新开始新的养育之旅
          </button>
        </div>
      );
    }

    if (isFeedbackPhase) {
        // Check if this is the initial feedback narrative (after initialization)
        const isInitialNarrative = history.length === 1 && history[0].question === "游戏开始";
        
        // Debug the continueGame function
        console.log("Rendering FeedbackDisplay with:", {
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
            console.error("continueGame from store is not a function:", storeContinueGame);
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
        return <div className="text-center py-10"><p className="text-lg text-gray-600 animate-pulse">你的养育之旅开始了...</p></div>;
      }
    }
    
    if (isLoading) { 
        return <div className="text-center py-10"><p className="text-lg text-gray-600 animate-pulse">加载中...</p></div>;
    }

    return (
      <div className="text-center py-10">
        <p className="text-lg text-gray-600">请稍候，游戏状态 ({gamePhase}) 未明确处理。</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex flex-1 pt-16">
        {showTimeline && (
          <div className="w-64 p-4 border-r border-gray-200 bg-white flex flex-col space-y-4">
            {child?.name && (
              <button
                onClick={() => {
                  // Force complete reset
                  if (typeof initializeGame === 'function') {
                    initializeGame();
                    // Reload the page to ensure clean state
                    window.location.reload();
                  } else {
                    console.error("initializeGame is not a function:", initializeGame);
                    // Fallback action: just reload
                    window.location.reload();
                  }
                }}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                放弃{child.name}，重新开始
              </button>
            )}
            <TimelineProvider 
              history={history}
              currentAge={currentAge}
              isVisible={true}
              hideLatest={(isFeedbackPhase || isGeneratingOutcomePhase) && !(child?.age && child.age >= 17)} 
            />
          </div>
        )}
        <div className="flex-1 flex flex-col">
          <main className="container mx-auto px-4 sm:px-6 flex-1 flex flex-col">
            <div className="flex-1"></div>
            <div className="py-6 pb-12 max-w-3xl mx-auto w-full"> 
              {renderMainContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App
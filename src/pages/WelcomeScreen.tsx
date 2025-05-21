import React, { useState } from 'react';
import useGameStore from '../stores/useGameStore';
import { loadState } from '../services/storageService';
import type { InitialStateType } from '../services/gptService';

interface WelcomeScreenProps {
  onStartLoading?: () => void;
  onTestEnding?: () => void;
}

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
  
  console.log("Welcome screen - Game phase:", gamePhase, "Has saved game:", hasSavedGame);

  // Handle starting a new game
  const handleStartNewGame = async () => {
    if (!specialRequirements) {
      try {
        console.log("No special requirements, fetching pre-generated states...");
        const response = await fetch('/pregenerated_states.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch pregenerated_states.json: ${response.statusText}`);
        }
        const states: InitialStateType[] = await response.json();
        if (states && states.length > 0) {
          const randomIndex = Math.floor(Math.random() * states.length);
          const selectedState = states[randomIndex];
          console.log("Selected pre-generated state:", selectedState);
          initializeGame({ preloadedState: selectedState });
        } else {
          console.warn("No pre-generated states found or array is empty, falling back to default generation.");
          initializeGame({}); // Fallback to default generation without special requirements
        }
      } catch (error) {
        console.error("Error fetching or using pre-generated states:", error);
        // Fallback to default generation in case of error
        initializeGame({}); 
      }
    } else {
      console.log("Starting a new game with special requirements:", specialRequirements);
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
    console.log("Continuing saved game");
    continueSavedGame();
  };

  // Special requirements input field
  const renderSpecialRequirementsInput = () => (
    <div className="mb-6">
      <label htmlFor="specialRequirements" className="block text-sm font-medium text-gray-700 mb-2">
        特殊要求（可选）
      </label>
      <textarea
        id="specialRequirements"
        placeholder="我想养个邻居家的孩子"
        className="w-[200%] mx-auto block -ml-[60%] px-6 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
        rows={2}
        value={specialRequirements}
        onChange={(e) => setSpecialRequirements(e.target.value)}
      />
      <p className="mt-2 text-sm text-gray-500">您可以描述具体的想要的关于自己和娃的背景和特点，AI将尽量满足您的要求。（当然，养娃和AI一样，是个玄学……）</p>

      <p className="mt-2">准备好开始这段充满挑战与惊喜的养育之旅了吗？</p>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 animate-fadeIn">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-5 sm:p-8 mb-6">
        
        {hasSavedGame ? (
          <div className="mb-8 space-y-4 text-gray-700">
            <div className="bg-yellow-50 p-6 rounded-md border-2 border-yellow-200">
              <h2 className="text-2xl font-bold mb-4 text-yellow-700">发现已保存的游戏进度</h2>
              <p className="text-lg mb-4">
                您好！我们发现您有一个进行中的游戏：
              </p>
              <div className="mb-6 bg-white p-4 rounded-md shadow-sm">
                <p className="font-semibold">孩子: {savedState?.child?.name} ({savedState?.child?.gender === 'male' ? '男孩' : '女孩'})</p>
                <p>当前年龄: {savedState?.child?.age} 岁</p>
              </div>
              <p>
                您可以继续这个游戏，或者开始一个全新的游戏。
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-8 space-y-4 text-gray-700">
            <p className="text-lg">
              欢迎来到《养娃模拟器》，一个模拟从孩子出生到成年的养育历程的游戏。
            </p>
            
            <div className="bg-blue-50 p-4 rounded-md">
              <h2 className="text-xl font-semibold mb-3 text-blue-700">游戏介绍</h2>
              <p>在这个游戏中，你将扮演一位父亲或母亲，从孩子出生开始，一直陪伴他/她成长到18岁。</p>
              <p className="mt-2">每一年，你都将面临各种养育抉择，你的选择将深刻影响孩子的性格、兴趣和未来发展方向。</p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-md">
              <h2 className="text-xl font-semibold mb-3 text-purple-700">游戏特点</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>AI生成的角色背景、养育情境和故事线</li>
                <li>每个决定都会影响娃的成长路径</li>
                <li>时间轴记录你的养育历程，直到18岁送娃成人</li>
                <li>查看娃的成长经历和自己是个什么样的父母</li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-4 rounded-md">
              <h2 className="text-xl font-semibold mb-3 text-green-700">开始游戏</h2>
              <p>点击下方按钮，系统将为你随机生成一位父亲/母亲的角色，以及你娃的基本信息。</p>
              
            </div>
            
            {/* Add special requirements input */}
            {renderSpecialRequirementsInput()}
          </div>
        )}
        
        {hasSavedGame ? (
          <>
            <button
              onClick={handleContinueSavedGame}
              className="w-full py-3 bg-blue-500 text-white text-lg rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
            >
              继续游戏
            </button>
            
            <button
              onClick={handleResetAndShowNewGameScreen}
              className="w-full mt-4 py-3 bg-red-500 text-white text-lg rounded-lg hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
            >
              开始新游戏
            </button>
          </>
        ) : (
          <button
            onClick={handleStartNewGame}
            className="w-full py-3 bg-blue-500 text-white text-lg rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          >
            开始游戏
          </button>
        )}

        {/* Show Test Ending Button only in development mode */}
        {isDevelopment && onTestEnding && (
          <button
            onClick={onTestEnding}
            className="w-full mt-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
          >
            (Dev) Test Ending Page
          </button>
        )}
      </div>
    </div>
  );
}; 
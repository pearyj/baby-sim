import React, { useEffect, useState, useRef } from 'react';
import { TextDisplay } from './TextDisplay';

interface FeedbackDisplayProps {
  feedback: string;
  onContinue: () => void;
  isEnding?: boolean;
  isFirstQuestion?: boolean;
  isLoadingFirstQuestion?: boolean;
  childName?: string;
}

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedback,
  onContinue,
  isEnding = false,
  isFirstQuestion = false,
  isLoadingFirstQuestion = false,
  childName = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Animation effect when component mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  // 自动滚动到底部
  useEffect(() => {
    if (isVisible && containerRef.current) {
      // 延迟一点点时间确保DOM已更新
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 300);
    }
  }, [isVisible]);
  
  // Determine button text and styling
  const buttonText = 
    isLoadingFirstQuestion && isFirstQuestion 
      ? '加载中...'
      : isEnding 
        ? '结束游戏' 
        : isFirstQuestion && childName
          ? `开始养育${childName}`
        : isFirstQuestion
          ? '开始养育'
          : '继续';

  const buttonColor = isEnding 
    ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' 
    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  
  const handleContinue = () => {
    console.log("DEBUG: FeedbackDisplay handleContinue - TOP");
    console.log("Continue button clicked in FeedbackDisplay", {
      isEnding,
      isFirstQuestion,
      buttonText,
      childName,
      onContinueType: typeof onContinue
    });
    
    try {
      if (typeof onContinue === 'function') {
        // Don't catch errors here - let them propagate to the store where they can be properly handled
        onContinue();
      } else {
        console.error("Error: onContinue is not a function", onContinue);
        // Show an error message instead of immediately reloading
        const errorContainer = document.createElement('div');
        errorContainer.style.color = 'red';
        errorContainer.style.padding = '10px';
        errorContainer.style.marginTop = '10px';
        errorContainer.style.border = '1px solid red';
        errorContainer.style.borderRadius = '5px';
        errorContainer.textContent = '继续游戏时遇到错误，请尝试刷新页面。';
        
        // Insert the error message before the button
        const buttonElement = document.activeElement;
        if (buttonElement && buttonElement.parentNode) {
          buttonElement.parentNode.insertBefore(errorContainer, buttonElement);
        }
        
        // Optional: Add a reload button
        const reloadButton = document.createElement('button');
        reloadButton.textContent = '刷新页面';
        reloadButton.style.marginTop = '10px';
        reloadButton.style.padding = '5px 10px';
        reloadButton.style.backgroundColor = '#f87171';
        reloadButton.style.color = 'white';
        reloadButton.style.border = 'none';
        reloadButton.style.borderRadius = '5px';
        reloadButton.style.cursor = 'pointer';
        reloadButton.onclick = () => window.location.reload();
        
        if (errorContainer.parentNode) {
          errorContainer.parentNode.insertBefore(reloadButton, errorContainer.nextSibling);
        }
        
        // Wait 5 seconds before reloading
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    } catch (err) {
      console.error("Error in handleContinue:", err);
      // Show user-friendly error instead of immediately reloading
      alert('很抱歉，继续游戏时遇到问题。');
    }
  };
  
  return (
    <div className="w-full px-4 sm:px-6" ref={containerRef}>
      <div 
        className={`max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-5 sm:p-6 mb-6 transition-all duration-500 ease-in-out ${isVisible ? 'opacity-100 transform-none' : 'opacity-0 transform translate-y-4'}`}
      >
        <div className="mb-8">
          <TextDisplay 
            text={feedback} 
            animated={true} 
            delay={200}
            paragraphClassName="text-sm sm:text-lg md:text-xl leading-relaxed"
          />
        </div>
        <button
          onClick={handleContinue}
          disabled={isLoadingFirstQuestion && isFirstQuestion}
          className={`w-full py-3 ${buttonColor} text-white text-lg font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLoadingFirstQuestion && isFirstQuestion ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}; 
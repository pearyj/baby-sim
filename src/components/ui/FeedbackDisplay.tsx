import React, { useEffect, useState, useRef } from 'react';
import { TextDisplay } from './TextDisplay';

interface FeedbackDisplayProps {
  feedback: string;
  onContinue: () => void;
  isEnding?: boolean;
  isFirstQuestion?: boolean;
}

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedback,
  onContinue,
  isEnding = false,
  isFirstQuestion = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Animation effect when component mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  // 自动滚动到这个组件
  useEffect(() => {
    if (isVisible && containerRef.current) {
      // 延迟一点点时间确保DOM已更新
      setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [isVisible]);
  
  // Determine button text and styling
  const buttonText = isEnding ? '结束游戏' : isFirstQuestion ? '开始' : '继续';
  const buttonColor = isEnding 
    ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' 
    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  
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
          onClick={onContinue}
          className={`w-full py-3 ${buttonColor} text-white text-lg font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}; 
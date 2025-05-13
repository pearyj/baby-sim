import React, { useEffect, useRef } from 'react';
import type { Question } from '../types/game';
import { TextDisplay } from './TextDisplay';

interface QuestionDisplayProps {
  question: Question;
  onSelectOption: (optionId: string) => Promise<void>;
  isLoading: boolean;
  childName: string;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  onSelectOption,
  isLoading,
  childName
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 组件挂载时自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      // 延迟一点点时间确保DOM已更新
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 200);
    }
  }, []);
  
  return (
    <div className="w-full px-4 sm:px-6" ref={containerRef}>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md overflow-hidden mb-6 transition-all duration-300 animate-fadeIn relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-blue-600 font-medium">
                {childName}正在成长中...
              </p>
            </div>
          </div>
        )}
        <div className="p-5 sm:p-6">
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-normal">
              <TextDisplay 
                text={question.question}
                paragraphClassName="text-center sm:text-left"
              />
            </h2>
          </div>
          <div className="space-y-6">
            {question.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onSelectOption(option.id)}
                disabled={isLoading}
                className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="flex items-center">
                    <TextDisplay 
                      text={option.id+ ": " + option.text}
                      paragraphClassName="text-gray-800 group-hover:text-blue-800 transition-colors text-sm sm:text-base"
                    />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 
import React, { useEffect, useRef } from 'react';
import type { Question } from '../../types/game';
import { TextDisplay } from '../../components/ui/TextDisplay';

interface QuestionDisplayProps {
  question: Question;
  onSelectOption: (optionId: string) => Promise<void>;
  isLoading: boolean;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  onSelectOption,
  isLoading
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
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md overflow-hidden mb-6 transition-all duration-300 animate-fadeIn">
        <div className="p-5 sm:p-6">
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-normal">
              <TextDisplay 
                text={question.question}
                paragraphClassName="text-center sm:text-left"
              />
            </h2>
          </div>
          <div className="space-y-4">
            {question.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onSelectOption(option.id)}
                disabled={isLoading}
                className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="flex items-start sm:items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors flex-shrink-0 mt-1 sm:mt-0">
                    {option.id}
                  </div>
                  <div className="flex-1">
                    <TextDisplay 
                      text={option.text}
                      paragraphClassName="text-gray-800 group-hover:text-blue-800 transition-colors text-sm sm:text-base"
                    />
                  </div>
                </div>
                
                {/* Loading indicator that shows only when this option is being processed */}
                {isLoading && (
                  <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 
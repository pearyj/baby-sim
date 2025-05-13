import React, { useState, useEffect } from 'react';
import type { GameState } from '../types/game';
import { TextDisplay } from './TextDisplay';

interface StoryDialogProps {
  history: GameState['history'];
  hideLatest?: boolean; // 是否隐藏最新的历史记录
}

export const StoryDialog: React.FC<StoryDialogProps> = ({ 
  history,
  hideLatest = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // 监听对话框打开状态，当打开时自动滚动到对话框内容
  useEffect(() => {
    if (isOpen) {
      // 等待内容渲染
      setTimeout(() => {
        const dialogContent = document.querySelector('.story-dialog-content');
        if (dialogContent) {
          dialogContent.scrollTop = 0; // 滚动到对话历史顶部
        }
      }, 100);
    }
  }, [isOpen]);

  if (history.length === 0) return null;

  // 如果需要隐藏最新记录且有历史记录，则显示除了最后一条以外的所有记录
  const displayHistory = hideLatest && history.length > 0 
    ? history.slice(0, -1)
    : history;

  // 如果没有可显示的历史记录（只有一条且被隐藏），则返回null
  if (displayHistory.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-10 bg-white shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-2 flex justify-between items-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 rounded-md px-2 py-1"
        >
          <span>{isOpen ? '隐藏故事' : '查看故事历程'}</span>
          <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20">
            {isOpen ? (
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            )}
          </svg>
        </button>
        <div className="flex items-center">
          <span className="text-gray-600 mr-1">当前年龄:</span>
          <span className="text-lg font-bold text-blue-700">{displayHistory[displayHistory.length - 1]?.age || 0}岁</span>
        </div>
      </div>
      
      {isOpen && (
        <div className="max-w-3xl mx-auto px-4 py-4 bg-white shadow-md border-t border-gray-200 max-h-[60vh] overflow-y-auto story-dialog-content">
          <h2 className="text-xl font-semibold mb-4 text-center sm:text-left">成长历程</h2>
          <div className="space-y-6">
            {displayHistory.map((entry, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <div className="flex items-start sm:items-center mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="text-lg sm:text-xl font-bold text-blue-700">{entry.age}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-base sm:text-lg text-gray-900">
                      <TextDisplay text={entry.question} />
                    </h3>
                  </div>
                </div>
                <div className="pl-4 sm:pl-[60px]">
                  <div className="mb-2 py-1 px-3 bg-blue-50 text-blue-700 inline-block rounded-full text-sm">
                    <span className="font-medium">选择: </span>
                    <TextDisplay 
                      text={entry.choice}
                      className="inline" 
                    />
                  </div>
                  <div className="mt-2 text-gray-700">
                    <TextDisplay 
                      text={entry.outcome}
                      paragraphClassName="text-sm sm:text-base" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 
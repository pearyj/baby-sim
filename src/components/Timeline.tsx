import React, { useState } from 'react';
import type { GameState } from '../types/game';
import clsx from 'clsx';

interface TimelineProps {
  history: GameState['history'];
  currentAge: number;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  history, 
  currentAge
}) => {
  const [selectedAges, setSelectedAges] = useState<number[]>([]);
  const sortedEvents = history.filter(event => event.question && event.question.trim() !== '').sort((a, b) => a.age - b.age);
  
  const handleAgeSelection = (age: number) => {
    setSelectedAges(prevSelectedAges => 
      prevSelectedAges.includes(age)
        ? prevSelectedAges.filter(selected => selected !== age)
        : [...prevSelectedAges, age]
    );
  };
  
  // Helper function to get a clean display text from outcome
  const getDisplayText = (text: string, maxLength: number): string => {
    if (!text) return "...";
    const firstSentence = text.split(/[.!?][\s\n]/)[0];
    if (firstSentence.length > maxLength) {
      return firstSentence.substring(0, maxLength) + "...";
    }
    return firstSentence + (firstSentence.match(/[.!?]$/) ? '' : '...');
  };
  
  return (
    <>
      {/* content panel */}
      <div className="flex-1 p-4 overflow-auto space-y-3 bg-gray-50">
        {sortedEvents.length === 0 ? (
          <div className="text-center text-gray-500 italic py-8">
            <p>辛勤养娃的一点一滴都会被记录下来。</p>
          </div>
        ) : (
          sortedEvents.map((event, index) => {
            const isSelected = selectedAges.includes(event.age);
            const isCurrent = event.age === currentAge;
            return (
              <div 
                key={`content-${event.age}-${index}`}
                className={clsx(
                  "rounded-lg border-l-4 cursor-pointer transition-all duration-200 p-3",
                  isCurrent
                    ? "bg-blue-50 border-blue-500 shadow-sm"
                    : isSelected
                      ? "bg-indigo-50 border-indigo-500 shadow-sm"
                      : "bg-white border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
                )}
                onClick={() => handleAgeSelection(event.age)}
              >
                {/* Render Details if selected, otherwise render Summary */}
                {isSelected ? (
                  // Detailed View (when selected)
                  <div className="text-sm text-gray-700">
                    <h3 className="font-bold mb-2 text-gray-800">{event.age}岁</h3>
                    
                    <div className="text-xs text-gray-500 space-y-1 border-t pt-2 mt-2">
                      <p><span className="font-medium">状况: </span>{event.question}</p>
                      <p className="whitespace-pre-wrap mb-3">{event.outcome}</p>
                    </div>
                  </div>
                ) : (
                  // Summary View (when not selected)
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline overflow-hidden">
                      <span className="font-bold text-gray-700 text-sm flex-shrink-0">{event.age}岁: </span>
                      {/* Single line preview with truncation */}
                      <span className="ml-2 text-gray-600 text-sm truncate whitespace-nowrap">
                        {getDisplayText(event.outcome, 60)} 
                      </span>
                    </div>
                    {/* Indicate expandability */}
                    <span className="text-indigo-500 text-xs ml-2 flex-shrink-0">
                      ▼
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}; 
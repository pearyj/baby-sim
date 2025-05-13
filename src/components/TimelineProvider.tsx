import React from 'react';
import { Timeline } from './Timeline';
import type { GameState } from '../types/game';

interface TimelineProviderProps {
  history: GameState['history'];
  currentAge: number;
  isVisible: boolean;
  hideLatest?: boolean;
}

export const TimelineProvider: React.FC<TimelineProviderProps> = ({
  history,
  currentAge,
  isVisible,
  hideLatest = false
}) => {
  if (!isVisible) return null;
  
  // Filter history if hideLatest is true
  const displayHistory = hideLatest && history.length > 0
    ? history.filter(item => item.age !== currentAge)
    : history;
  
  return (
    <div className="flex flex-row h-full">
      <Timeline 
        history={displayHistory}
        currentAge={currentAge}
      />
    </div>
  );
}; 
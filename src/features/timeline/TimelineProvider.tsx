import React from 'react';
import { Timeline } from './Timeline';
import type { GameState } from '../../types/game';

interface TimelineProviderProps {
  history: GameState['history'];
  currentAge: number;
  childGender: 'male' | 'female';
  isVisible: boolean;
  hideLatest?: boolean;
}

export const TimelineProvider: React.FC<TimelineProviderProps> = ({
  history,
  currentAge,
  childGender,
  isVisible,
  hideLatest = false
}) => {
  if (!isVisible) return null;
  
  // Filter history if hideLatest is true
  const displayHistory = hideLatest && history.length > 0
    ? history.filter(item => item.age !== currentAge)
    : history;
  
  return (
    <Timeline 
      history={displayHistory}
      currentAge={currentAge}
      childGender={childGender}
    />
  );
}; 
export interface Option {
  id: string;
  text: string;
  cost: number;
}

export interface Question {
  id?: string;
  question: string;
  options: Option[];
  isExtremeEvent: boolean;
}

// Define and export Player interface
export interface Player {
  gender: 'male' | 'female';
  age: number;
  [key: string]: any; // Consider making this more specific if possible
}

// Define and export Child interface
export interface Child {
  name: string;
  gender: 'male' | 'female';
  age: number;
  [key: string]: any; // Consider making this more specific if possible
}

export interface GameState {
  player: Player; // Use the exported Player interface
  child: Child;   // Use the exported Child interface
  history: {
    age: number;
    question: string;
    choice: string;
    outcome: string;
  }[];
  playerDescription: string;
  childDescription: string;
  wealthTier: 'poor' | 'middle' | 'wealthy';
  financialBurden: number;
  isBankrupt: boolean;
  pendingChoice?: {
    questionId?: string;
    optionId: string;
    questionText: string;
    optionText: string;
  } | null;
  currentQuestion: Question | null;
  feedbackText: string | null;
  endingSummaryText: string | null;
}

// Add HistoryEntry interface
export interface HistoryEntry {
  age: number; 
  question: string; 
  choice: string; 
  outcome: string; 
}

//   

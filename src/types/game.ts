export interface Option {
  id: string;
  text: string;
  cost?: number; // Keep for backward compatibility during transition
  financeDelta?: number; // New: impact on finance (-10 to +10)
  maritalDelta?: number; // New: impact on marital relationship (-10 to +10)
}

export interface Question {
  id?: string;
  question: string;
  options: Option[];
  isExtremeEvent: boolean;
}

// Define and export Player interface
export interface Player {
  gender: 'male' | 'female' | 'nonBinary';
  age: number;
  [key: string]: any; // Consider making this more specific if possible
}

// Define and export Child interface
export interface Child {
  name: string;
  gender: 'male' | 'female'; // Children remain binary for now
  age: number;
  haircolor: string;
  race: string;
  [key: string]: any; // Consider making this more specific if possible
}

// Add HistoryEntry interface
export interface HistoryEntry {
  age: number; 
  question: string; 
  choice: string; 
  outcome: string;
  imageUrl?: string; // Generated image URL
  imageBase64?: string; // Generated image base64 data
}

export interface GameState {
  player: Player; // Use the exported Player interface
  child: Child;   // Use the exported Child interface
  history: HistoryEntry[];
  playerDescription: string;
  childDescription: string;
  finance: number; // Finance level 0-10 (0=bankrupt, 10=wealthy)
  marital: number; // Marital relationship level 0-10 (0=partner left, 10=excellent)
  isSingleParent: boolean; // Single parent status
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

//

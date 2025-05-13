import type { Question } from '../types/game'; // Import Question type

const CHILD_SIM_GAME_STATE_KEY = 'childSimGameState';
const CURRENT_STORAGE_VERSION = 1;

// Placeholder types - replace with actual types from src/types/
interface ChildProfile {
  name: string;
  gender: 'male' | 'female';
  age: number; // Child's biological age
  description: string;
}

interface PlayerProfile { // Changed from ParentProfile
  gender: 'male' | 'female';
  age: number;
  description: string;
}

interface HistoryEntry {
  age: number; // Changed from year to age for consistency with App.tsx
  question: string; // The question text presented
  choice: string; // The user's chosen option
  outcome: string; // The resulting state changes or outcomes
}

export interface GameStateToStore { // Renamed from GameState
  player: PlayerProfile;
  child: ChildProfile;
  history: HistoryEntry[];
  currentYear: number; // Pointer to the current game position (App.tsx currentAge)
  activeQuestion: Question | null; // Added to store the current question
}

interface StoredState {
  version: number;
  data: GameStateToStore; // Updated to GameStateToStore
}

const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__testLocalStorage__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

export const saveState = (state: GameStateToStore): void => { // Updated parameter type
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Game state will not be saved.');
    return;
  }

  try {
    const stateToStore: StoredState = {
      version: CURRENT_STORAGE_VERSION,
      data: state,
    };
    const serializedState = JSON.stringify(stateToStore);
    localStorage.setItem(CHILD_SIM_GAME_STATE_KEY, serializedState);
  } catch (error) {
    console.error('Error saving state to localStorage:', error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded. Cannot save game state.');
      // Optionally, notify the user or try to clear some less critical old data if applicable
    }
  }
};

export const loadState = (): GameStateToStore | null => { // Updated return type
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Cannot load game state.');
    return null;
  }

  try {
    const serializedState = localStorage.getItem(CHILD_SIM_GAME_STATE_KEY);
    if (serializedState === null) {
      return null; // No state saved previously
    }

    const storedState: StoredState = JSON.parse(serializedState);

    if (storedState.version !== CURRENT_STORAGE_VERSION) {
      console.warn(
        `Stored data version (${storedState.version}) does not match current version (${CURRENT_STORAGE_VERSION}). Resetting state.`,
      );
      clearState(); // Clear the outdated state
      return null;
    }

    return storedState.data;
  } catch (error) {
    console.error('Error loading state from localStorage:', error);
    // If parsing fails or any other error, clear the potentially corrupted state
    clearState();
    return null;
  }
};

export const clearState = (): void => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Cannot clear game state.');
    return;
  }

  try {
    localStorage.removeItem(CHILD_SIM_GAME_STATE_KEY);
  } catch (error) {
    console.error('Error clearing state from localStorage:', error);
  }
}; 
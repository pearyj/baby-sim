import type { Question } from '../types/game'; // Import Question type
import logger from '../utils/logger';

const CHILD_SIM_GAME_STATE_KEY = 'childSimGameState';
const CURRENT_STORAGE_VERSION = 1;

// Define interfaces for the structure of the state to be stored
interface ChildProfile {
  name: string;
  gender: 'male' | 'female';
  age: number; // Child's biological age
  description: string;
}

interface PlayerProfile { 
  gender: 'male' | 'female';
  age: number;
  description: string;
}

interface HistoryEntry {
  age: number; 
  question: string; 
  choice: string; 
  outcome: string; 
}

export interface GameStateToStore {
  player: PlayerProfile;
  child: ChildProfile;
  history: HistoryEntry[];
  currentYear: number; 
  activeQuestion: Question | null; 
  finance: number; // Finance level 0-10 (0=bankrupt, 10=wealthy)
  marital: number; // Marital relationship level 0-10 (0=partner left, 10=excellent)
  isSingleParent: boolean; // Single parent status
  pendingChoice?: {
    questionId?: string;
    optionId: string;
    questionText: string;
    optionText: string;
  } | null;
}

interface StoredState {
  version: number;
  data: GameStateToStore; 
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

export const saveState = (state: GameStateToStore): void => {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available. Game state will not be saved.');
    return;
  }

  try {
    const stateToStore: StoredState = {
      version: CURRENT_STORAGE_VERSION,
      data: state,
    };
    const serializedState = JSON.stringify(stateToStore);
    localStorage.setItem(CHILD_SIM_GAME_STATE_KEY, serializedState);
    logger.debug('Game state saved successfully');
  } catch (error) {
    logger.error('Error saving game state:', error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error('LocalStorage quota exceeded. Cannot save game state.');
    }
  }
};

export const loadState = (): GameStateToStore | null => {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available. Cannot load game state.');
    return null;
  }

  try {
    const serializedState = localStorage.getItem(CHILD_SIM_GAME_STATE_KEY);
    if (serializedState === null) {
      logger.debug('No saved game state found');
      return null;
    }

    logger.debug(`Found saved state in localStorage (${serializedState.length} bytes)`);
    const storedState: StoredState = JSON.parse(serializedState);

    if (storedState.version !== CURRENT_STORAGE_VERSION) {
      logger.warn(
        `Stored data version (${storedState.version}) does not match current version (${CURRENT_STORAGE_VERSION}). Resetting state.`,
      );
      clearState(); 
      return null;
    }

    logger.debug('Game state loaded successfully');
    return storedState.data;
  } catch (error) {
    logger.error('Error loading game state:', error);
    clearState();
    return null;
  }
};

export const clearState = (): void => {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available. Cannot clear game state.');
    return;
  }

  try {
    localStorage.removeItem(CHILD_SIM_GAME_STATE_KEY);
    logger.debug('Game state cleared successfully');
  } catch (error) {
    logger.error('Error clearing game state:', error);
  }
}; 
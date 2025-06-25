import { useEffect } from 'react';
import useGameStore from '../stores/useGameStore';

/**
 * Custom hook to manage the overall game flow, initialization, 
 * and potentially persistence or other side effects related to game progression.
 */
export const useGameFlow = () => {
  const { 
    gamePhase, 
    player, 
    child,
    history
  } = useGameStore(state => ({ 
    gamePhase: state.gamePhase,
    player: state.player,
    child: state.child,
    history: state.history,
  }));

  useEffect(() => {
    // The storage-related logic has been moved directly into the useGameStore
    // We don't need to trigger initializeGame here as it's now handled by user interaction
    // via the WelcomeScreen component, and the store itself attempts to load saved state
  }, [gamePhase, player, child, history]); 
}; 
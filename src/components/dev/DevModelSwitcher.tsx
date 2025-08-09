import React from 'react';
import ModelSwitcher from './ModelSwitcher';
import { isPremiumStyleActive } from '../../services/gptServiceUnified';

interface DevModelSwitcherProps {
  className?: string;
}

/**
 * A wrapper around ModelSwitcher that only renders in development mode
 */
const DevModelSwitcher: React.FC<DevModelSwitcherProps> = ({ className }) => {
  // Only render in development mode
  if (!import.meta.env.DEV) {
    return null;
  }
  // Hide entirely when ultra style is active (locked to GPT-5)
  if (isPremiumStyleActive()) {
    return null;
  }
  
  return <ModelSwitcher className={className} />;
};

// Named export for compatibility with "{ DevModelSwitcher }" import style
export { DevModelSwitcher };

export default DevModelSwitcher; 
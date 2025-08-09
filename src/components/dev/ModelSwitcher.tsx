import React, { useState, useEffect } from 'react';
import { getCurrentModel, switchProvider, isPremiumStyleActive } from '../../services/gptServiceUnified';

interface ModelSwitcherProps {
  className?: string;
}

const ModelSwitcher: React.FC<ModelSwitcherProps> = ({ className = '' }) => {
  // Do not render at all when ultra style is active
  if (isPremiumStyleActive()) {
    return null;
  }
  const [currentModel, setCurrentModel] = useState<string>('');
  
  useEffect(() => {
    // Get the initial model on component mount
    setCurrentModel(getCurrentModel());
    
    // Listen for provider changes triggered elsewhere (e.g., ultra mode forcing GPT-5)
    const handleExternalChange = () => {
      setCurrentModel(getCurrentModel());
    };
    window.addEventListener('model-provider-changed', handleExternalChange as EventListener);
    window.addEventListener('game-style-changed', handleExternalChange as EventListener);
    return () => {
      window.removeEventListener('model-provider-changed', handleExternalChange as EventListener);
      window.removeEventListener('game-style-changed', handleExternalChange as EventListener);
    };
  }, []);
  
  const handleSwitchModel = () => {
    switchProvider();
    setCurrentModel(getCurrentModel());
  };
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-500">Model:</span>
      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
        {currentModel}
      </span>
      <button 
        onClick={handleSwitchModel}
        className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
      >
        Switch
      </button>
    </div>
  );
};

export default ModelSwitcher; 
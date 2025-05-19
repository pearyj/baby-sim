import React, { useState, useEffect } from 'react';
import { getCurrentModel, switchProvider } from '../services/gptService';

interface ModelSwitcherProps {
  className?: string;
}

const ModelSwitcher: React.FC<ModelSwitcherProps> = ({ className = '' }) => {
  const [currentModel, setCurrentModel] = useState<string>('');
  
  useEffect(() => {
    // Get the initial model on component mount
    setCurrentModel(getCurrentModel());
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
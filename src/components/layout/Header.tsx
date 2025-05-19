import React from 'react';
import DevModelSwitcher from '../../components/DevModelSwitcher';

export const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-4 relative">
        {/* Model switcher - only appears in dev mode */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <DevModelSwitcher />
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-white">
          <span className="relative inline-block">
            养娃模拟器
            <span className="absolute -bottom-1 left-0 right-0 h-1 bg-white opacity-30 rounded-full"></span>
          </span>
        </h1>
      </div>
    </header>
  );
}; 
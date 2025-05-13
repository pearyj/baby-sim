import React, { useState, useEffect } from 'react';

interface TextDisplayProps {
  text: string;
  className?: string;
  paragraphClassName?: string;
  animated?: boolean;
  delay?: number; // 延迟时间，单位毫秒
}

/**
 * 统一的文本显示组件，支持换行、响应式布局和动画
 */
export const TextDisplay: React.FC<TextDisplayProps> = ({
  text,
  className = '',
  paragraphClassName = '',
  animated = false,
  delay = 100,
}) => {
  const [isVisible, setIsVisible] = useState(!animated);
  
  // 如果启用动画，在组件挂载后设置可见性
  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animated]);
  
  if (!text) return null;
  
  // 将文本按段落分割
  const paragraphs = text.split('\n').filter(p => p.trim() !== '');
  
  return (
    <div className={`text-display ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p 
          key={index} 
          className={`
            text-gray-800 
            leading-relaxed 
            break-words 
            hyphens-auto 
            whitespace-pre-wrap 
            ${index > 0 ? 'mt-4' : ''} 
            ${animated ? 'transition-opacity duration-500 ease-in-out animated' : ''}
            ${paragraphClassName}
          `}
          style={animated ? { 
            opacity: isVisible ? 1 : 0, 
            transitionDelay: `${index * delay}ms`,
            animationDelay: `${index * delay}ms`
          } : undefined}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}; 
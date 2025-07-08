/**
 * Language detection utility for the Baby Raising Simulator
 * Implements the requirement: "Defaults to the system language of the user for both the prompt and the interface. 
 * If the user uses a different language from supported languages, default to EN."
 */

import logger from './logger';

export type SupportedLanguage = 'zh' | 'en' | 'ja' | 'es';

/**
 * Get the user's system language and apply fallback logic
 * @returns The language code to use ('zh', 'en', 'ja', or 'es')
 */
export const detectSystemLanguage = (): SupportedLanguage => {
  try {
    // Get the user's system language
    const systemLanguage = navigator.language || navigator.languages?.[0] || 'en';
    
    logger.info(`System language detected: ${systemLanguage}`);
    
    // Normalize the language code (remove region codes like 'en-US' -> 'en')
    const normalizedLanguage = systemLanguage.toLowerCase().split('-')[0];
    
    // Check if the system language is Chinese
    if (normalizedLanguage === 'zh' || systemLanguage.toLowerCase().includes('zh')) {
      logger.info('Using Chinese (zh) based on system language');
      return 'zh';
    }
    
    // Check if the system language is Japanese
    if (normalizedLanguage === 'ja' || systemLanguage.toLowerCase().includes('ja')) {
      logger.info('Using Japanese (ja) based on system language');
      return 'ja';
    }
    
    // Check if the system language is Spanish
    if (normalizedLanguage === 'es' || systemLanguage.toLowerCase().includes('es')) {
      logger.info('Using Spanish (es) based on system language');
      return 'es';
    }
    
    // Check if the system language is English
    if (normalizedLanguage === 'en' || systemLanguage.toLowerCase().includes('en')) {
      logger.info('Using English (en) based on system language');
      return 'en';
    }
    
    // For any other language, default to English as specified in requirements
    logger.info(`System language '${systemLanguage}' is not supported. Defaulting to English (en)`);
    return 'en';
    
  } catch (error) {
    logger.error('Error detecting system language:', error);
    // Fallback to English if detection fails
    return 'en';
  }
};

/**
 * Get the preferred language with fallback logic
 * Priority: localStorage > system language > English
 * @returns The language code to use ('zh', 'en', 'ja', or 'es')
 */
export const getPreferredLanguage = (): SupportedLanguage => {
  try {
    // First check if user has a saved preference
    const savedLanguage = localStorage.getItem('i18nextLng');
    if (savedLanguage && (savedLanguage === 'zh' || savedLanguage === 'en' || savedLanguage === 'ja' || savedLanguage === 'es')) {
      logger.info(`Using saved language preference: ${savedLanguage}`);
      return savedLanguage as SupportedLanguage;
    }
    
    // If no saved preference, detect system language
    return detectSystemLanguage();
    
  } catch (error) {
    logger.error('Error getting preferred language:', error);
    return 'en';
  }
};

/**
 * Check if a language code is supported
 * @param language The language code to check
 * @returns True if the language is supported
 */
export const isSupportedLanguage = (language: string): language is SupportedLanguage => {
  return language === 'zh' || language === 'en' || language === 'ja' || language === 'es';
};

/**
 * Get language display name
 * @param language The language code
 * @returns The display name of the language
 */
export const getLanguageDisplayName = (language: SupportedLanguage): string => {
  switch (language) {
    case 'zh':
      return '中文';
    case 'en':
      return 'English';
    case 'ja':
      return '日本語';
    case 'es':
      return 'Español';
    default:
      return 'English';
  }
};

/**
 * Get language flag emoji
 * @param language The language code
 * @returns The flag emoji for the language
 */
export const getLanguageFlag = (language: SupportedLanguage): string => {
  switch (language) {
    case 'zh':
      return '🇨🇳';
    case 'en':
      return '🇺🇸';
    case 'ja':
      return '🇯🇵';
    case 'es':
      return '🇪🇸';
    default:
      return '🇺🇸';
  }
}; 
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getPreferredLanguage, detectSystemLanguage } from '../utils/languageDetection';
import logger from '../utils/logger';

// Import translation files
import enTranslations from './locales/en.json';
import zhTranslations from './locales/zh.json';
import enPrompts from './prompts/en.json';
import zhPrompts from './prompts/zh.json';

const resources = {
  en: {
    translation: enTranslations,
    prompts: enPrompts
  },
  zh: {
    translation: zhTranslations,
    prompts: zhPrompts
  }
};

// Custom language detector that implements our specific requirements
const customLanguageDetector = {
  name: 'customDetector',
  lookup() {
    // Use our custom language detection logic
    return getPreferredLanguage();
  },
  cacheUserLanguage(lng: string) {
    // Cache the language preference in localStorage
    try {
      localStorage.setItem('i18nextLng', lng);
    } catch (error) {
      console.warn('Failed to cache language preference:', error);
    }
  }
};

// Create a language detector instance and add our custom detector
const languageDetector = new LanguageDetector();
languageDetector.addDetector(customLanguageDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Set fallback to English as per requirements
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      // Use our custom detector first, then fallback to standard detectors
      order: ['customDetector', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },
  });

// Log the detected language for debugging
if (process.env.NODE_ENV === 'development') {
  const systemLang = detectSystemLanguage();
  const finalLang = i18n.language;
  console.log(`🌐 Language Detection Summary:
    System Language: ${navigator.language || 'unknown'}
    Detected Language: ${systemLang}
    Final Language: ${finalLang}
  `);
}

export const detectLanguage = () => {
  const browserLang = navigator.language;
  logger.debug(`🌐 Language Detection Summary:
    Browser Language: ${browserLang}
    Detected Language: ${browserLang.startsWith('zh') ? 'zh' : 'en'}
    Using Language: ${i18n.language}`);
  return browserLang.startsWith('zh') ? 'zh' : 'en';
};

export default i18n; 
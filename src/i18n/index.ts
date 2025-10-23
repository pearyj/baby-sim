import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getPreferredLanguage, detectSystemLanguage } from '../utils/languageDetection';
import logger from '../utils/logger';

// Import translation files
import enTranslations from './locales/en.json';
import zhTranslations from './locales/zh.json';
import jaTranslations from './locales/ja.json';
import esTranslations from './locales/es.json';
import enPrompts from './prompts/en.json';
import zhPrompts from './prompts/zh.json';
import jaPrompts from './prompts/ja.json';
import esPrompts from './prompts/es.json';

const resources = {
  en: {
    translation: enTranslations,
    prompts: enPrompts
  },
  zh: {
    translation: zhTranslations,
    prompts: zhPrompts
  },
  ja: {
    translation: jaTranslations,
    prompts: jaPrompts
  },
  es: {
    translation: esTranslations,
    prompts: esPrompts
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
      if (import.meta.env.DEV) {
    console.warn('Failed to cache language preference:', error);
  }
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

// Keep <html lang="..."> in sync with i18n
try {
  const setLang = (lng: string) => {
    const base = (lng || 'en').split('-')[0];
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', base);
    }
  };
  setLang(i18n.language);
  i18n.on('languageChanged', setLang);
} catch (_) {
  // noop in non-DOM environments
}

// Log the detected language for debugging
if (process.env.NODE_ENV === 'development') {
  const systemLang = detectSystemLanguage();
  const finalLang = i18n.language;
  if (import.meta.env.DEV) {
    console.log(`🌐 Language Detection Summary:
    System Language: ${navigator.language || 'unknown'}
    Detected Language: ${systemLang}
    Final Language: ${finalLang}
  `);
  }
}

export const detectLanguage = () => {
  const browserLang = navigator.language;
  logger.debug(`🌐 Language Detection Summary:
    Browser Language: ${browserLang}
    Detected Language: ${browserLang.startsWith('zh') ? 'zh' : browserLang.startsWith('ja') ? 'ja' : browserLang.startsWith('es') ? 'es' : 'en'}
    Using Language: ${i18n.language}`);
  
  if (browserLang.startsWith('zh')) return 'zh';
  if (browserLang.startsWith('ja')) return 'ja';
  if (browserLang.startsWith('es')) return 'es';
  return 'en';
};

export default i18n; 

import i18n from '../i18n';
import logger from '../utils/logger';
import { isSupportedLanguage, type SupportedLanguage } from '../utils/languageDetection';

export type LangKey = SupportedLanguage;

// Memoized prompt lookup across modules
const cache = new Map<string, string>();

export const getCurrentLanguage = (): SupportedLanguage => {
  const currentLang = i18n.language;
  if (isSupportedLanguage(currentLang)) return currentLang;
  logger.warn(`Unsupported language '${currentLang}' detected, falling back to English`);
  return 'en';
};

export const getPromptByPath = (obj: any, path: string): string | null => {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) current = current[key];
    else return null;
  }
  return typeof current === 'string' ? current : null;
};

export const makePromptGetter = (resources: Record<SupportedLanguage, any>) => {
  return (keyPath: string): string => {
    const lang = getCurrentLanguage();
    const cacheKey = `${lang}:${keyPath}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    let prompt = getPromptByPath(resources[lang], keyPath);
    if (!prompt && lang !== 'en') {
      prompt = getPromptByPath(resources['en'], keyPath);
      if (prompt) logger.warn(`Prompt '${keyPath}' not found in ${lang}, using English fallback`);
    }
    if (!prompt && lang !== 'zh') {
      prompt = getPromptByPath(resources['zh'], keyPath);
      if (prompt) logger.warn(`Prompt '${keyPath}' not found in ${lang} or English, using Chinese fallback`);
    }
    if (!prompt) {
      logger.error(`Prompt '${keyPath}' not found in any language`);
      prompt = `[Missing prompt: ${keyPath}]`;
    }
    cache.set(cacheKey, prompt);
    return prompt;
  };
};

export const interpolatePrompt = (template: string, variables: Record<string, any>): string => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
};



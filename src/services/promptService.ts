import i18n from '../i18n';
import type { GameState } from '../types/game';
import logger from '../utils/logger';
import { isSupportedLanguage, type SupportedLanguage } from '../utils/languageDetection';

// Import prompt files
import zhPrompts from '../i18n/prompts/zh.json';
import enPrompts from '../i18n/prompts/en.json';

type PromptResources = {
  [key in SupportedLanguage]: any;
};

const promptResources: PromptResources = {
  zh: zhPrompts,
  en: enPrompts
};

/**
 * Get the current language from i18n with proper fallback
 */
const getCurrentLanguage = (): SupportedLanguage => {
  const currentLang = i18n.language;
  
  // Ensure we have a supported language, fallback to English (as per requirements)
  if (isSupportedLanguage(currentLang)) {
    return currentLang;
  }
  
  logger.warn(`Unsupported language '${currentLang}' detected, falling back to English`);
  return 'en';
};

/**
 * Get a prompt by key path with fallback to English then Chinese
 */
const getPrompt = (keyPath: string): string => {
  const currentLang = getCurrentLanguage();
  
  // Try current language first
  let prompt = getPromptByPath(promptResources[currentLang], keyPath);
  
  // Fallback to English if not found and current language is not English
  if (!prompt && currentLang !== 'en') {
    prompt = getPromptByPath(promptResources['en'], keyPath);
    if (prompt) {
      logger.warn(`Prompt '${keyPath}' not found in ${currentLang}, using English fallback`);
    }
  }
  
  // Fallback to Chinese if still not found and current language is not Chinese
  if (!prompt && currentLang !== 'zh') {
    prompt = getPromptByPath(promptResources['zh'], keyPath);
    if (prompt) {
      logger.warn(`Prompt '${keyPath}' not found in ${currentLang} or English, using Chinese fallback`);
    }
  }
  
  if (!prompt) {
    logger.error(`Prompt '${keyPath}' not found in any language`);
    return `[Missing prompt: ${keyPath}]`;
  }
  
  return prompt;
};

/**
 * Helper function to get nested property by dot notation path
 */
const getPromptByPath = (obj: any, path: string): string | null => {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }
  
  return typeof current === 'string' ? current : null;
};

/**
 * Interpolate variables in a prompt template
 */
const interpolatePrompt = (template: string, variables: Record<string, any>): string => {
  let result = template;
  
  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
};

/**
 * Generate system prompt
 */
export const generateSystemPrompt = (): string => {
  logger.info("📝 Generating system prompt");
  return getPrompt('system.main');
};

/**
 * Generate question prompt
 */
export const generateQuestionPrompt = (gameState: GameState, includeDetailedRequirements: boolean = true): string => {
  logger.info(`📝 Generating question prompt for child age ${gameState.child.age}`);
  
  const nextAge = gameState.child.age;
  
  // Prepare financial header
  let financialHeader = "";
  if (typeof gameState.financialBurden === 'number') {
    const headerTemplate = getPrompt('variables.financialHeader');
    financialHeader = interpolatePrompt(headerTemplate, { financialBurden: gameState.financialBurden });
    logger.info(`Prepending financial header: ${financialHeader.trim()}`);
  }
  
  // Prepare history context
  let historyContext = "";
  if (gameState.history.length > 0) {
    const historyPrefix = getPrompt('question.historyPrefix');
    const historyItemTemplate = getPrompt('question.historyItem');
    
    // Only include the most recent 5 entries to prevent exceeding character limit
    const recentHistory = gameState.history.slice(-5);
    
    const historyItems = recentHistory.map(h => 
      interpolatePrompt(historyItemTemplate, {
        age: h.age,
        question: h.question,
        choice: h.choice,
        outcome: h.outcome
      })
    ).join('\n\n');
    
    historyContext = historyPrefix + historyItems;
  }
  
  // Get gender translations
  const playerGender = getPrompt(`question.playerGender.${gameState.player.gender}`);
  const childGender = getPrompt(`question.childGender.${gameState.child.gender}`);
  
  // Prepare conditional requirements
  const detailedRequirements = includeDetailedRequirements ? getPrompt('question.detailedRequirements') : '';
  const costRequirements = includeDetailedRequirements ? getPrompt('question.costRequirements') : '';
  const continuityRequirements = includeDetailedRequirements ? getPrompt('question.continuityRequirements') : '';
  const extremeEventNote = !includeDetailedRequirements ? getPrompt('question.extremeEventNote') : '';
  
  // Get base prompt and interpolate
  const baseTemplate = getPrompt('question.base');
  const basePrompt = interpolatePrompt(baseTemplate, {
    financialHeader,
    playerGender,
    playerAge: gameState.player.age,
    playerDescription: gameState.playerDescription,
    childName: gameState.child.name,
    childGender,
    childAge: gameState.child.age,
    childDescription: gameState.childDescription,
    historyContext,
    nextAge,
    detailedRequirements,
    costRequirements,
    continuityRequirements,
    extremeEventNote
  });
  
  // Get format section
  const formatSection = includeDetailedRequirements 
    ? getPrompt('question.formatDetailed')
    : getPrompt('question.formatSimple');
  
  return `${basePrompt}\n\n${formatSection}`;
};

/**
 * Generate outcome and next question prompt
 */
export const generateOutcomeAndNextQuestionPrompt = (
  gameState: GameState,
  question: string,
  choice: string,
  shouldGenerateNextQuestion: boolean
): string => {
  logger.info(`📝 Generating outcome${shouldGenerateNextQuestion ? ' and next question' : ''} prompt for child age ${gameState.child.age}`);
  
  // Prepare financial header
  let financialHeader = "";
  if (typeof gameState.financialBurden === 'number') {
    const headerTemplate = getPrompt('variables.financialHeader');
    financialHeader = interpolatePrompt(headerTemplate, { financialBurden: gameState.financialBurden });
  }
  
  // Handle bankruptcy case
  if (gameState.isBankrupt) {
    logger.info("🚨 Bankruptcy detected! Generating bankruptcy-specific prompt.");
    const bankruptcyTemplate = getPrompt('outcome.bankruptcy');
    const childGender = getPrompt(`question.childGender.${gameState.child.gender}`);
    
    return interpolatePrompt(bankruptcyTemplate, {
      financialHeader,
      childName: gameState.child.name,
      childAge: gameState.child.age,
      childGender,
      question,
      choice
    });
  }
  
  // Prepare history context
  let historyContext = "";
  if (gameState.history.length > 0) {
    const historyPrefix = getPrompt('question.historyPrefix');
    const historyItemTemplate = getPrompt('question.historyItem');
    
    // Only include the most recent 5 entries to prevent exceeding character limit
    const recentHistory = gameState.history.slice(-5);
    
    const historyItems = recentHistory.map(h => 
      interpolatePrompt(historyItemTemplate, {
        age: h.age,
        question: h.question,
        choice: h.choice,
        outcome: h.outcome
      })
    ).join('\n\n');
    
    historyContext = historyPrefix + historyItems;
  }
  
  // Get gender translations
  const playerGender = getPrompt(`question.playerGender.${gameState.player.gender}`);
  const childGender = getPrompt(`question.childGender.${gameState.child.gender}`);
  
  // Get base prompt and interpolate
  const baseTemplate = getPrompt('outcome.base');
  const basePrompt = interpolatePrompt(baseTemplate, {
    financialHeader,
    playerGender,
    playerAge: gameState.player.age,
    playerDescription: gameState.playerDescription,
    childName: gameState.child.name,
    childGender,
    childAge: gameState.child.age,
    childDescription: gameState.childDescription,
    historyContext,
    question,
    choice
  });
  
  // Add format section based on whether next question is needed
  let formatSection: string;
  if (shouldGenerateNextQuestion) {
    const nextAge = gameState.child.age + 2;
    const template = getPrompt('outcome.withNextQuestion');
    formatSection = interpolatePrompt(template, { nextAge });
  } else {
    formatSection = getPrompt('outcome.withoutNextQuestion');
  }
  
  return basePrompt + formatSection;
};

/**
 * Generate initial state prompt
 */
export const generateInitialStatePrompt = (specialRequirements?: string): string => {
  logger.info("📝 Generating initial state prompt" + (specialRequirements ? " with special requirements" : ""));
  
  const baseTemplate = getPrompt('initialState.base');
  let prompt = baseTemplate;
  
  if (specialRequirements) {
    const requirementsTemplate = getPrompt('initialState.withRequirements');
    const requirementsSection = interpolatePrompt(requirementsTemplate, { specialRequirements });
    prompt += requirementsSection;
  }
  
  const formatSection = getPrompt('initialState.format');
  return prompt + formatSection;
};

/**
 * Generate ending prompt
 */
export const generateEndingPrompt = (gameState: GameState): string => {
  logger.info("📝 Generating ending prompt");
  
  // Prepare history context
  let historyContext = "";
  if (gameState.history.length > 0) {
    const historyPrefix = getPrompt('question.historyPrefix');
    const historyItemTemplate = getPrompt('question.historyItem');
    
    // Get all history entries for questions and choices
    const allHistory = gameState.history;
    
    // Get the last 5 entries for detailed outcomes
    const recentHistory = gameState.history.slice(-5);
    const recentAges = new Set(recentHistory.map(h => h.age));
    
    const historyItems = allHistory.map(h => {
      // For recent entries (last 5 years), include full details
      if (recentAges.has(h.age)) {
        return interpolatePrompt(historyItemTemplate, {
          age: h.age,
          question: h.question,
          choice: h.choice,
          outcome: h.outcome
        });
      }
      // For older entries, only include question and choice
      return interpolatePrompt(historyItemTemplate, {
        age: h.age,
        question: h.question,
        choice: h.choice,
        outcome: "..." // Placeholder for older outcomes
      });
    }).join('\n\n');
    
    historyContext = historyPrefix + historyItems;
  }
  
  // Get gender translations
  const playerGender = getPrompt(`question.playerGender.${gameState.player.gender}`);
  const childGender = getPrompt(`question.childGender.${gameState.child.gender}`);
  
  // Get base template and interpolate
  const baseTemplate = getPrompt('ending.base');
  return interpolatePrompt(baseTemplate, {
    playerGender,
    playerAge: gameState.player.age,
    playerDescription: gameState.playerDescription,
    childName: gameState.child.name,
    childGender,
    childDescription: gameState.childDescription,
    historyContext
  });
};

/**
 * Format ending result
 */
export const formatEndingResult = (result: any): string => {
  const template = getPrompt('ending.formatPrefix');
  return interpolatePrompt(template, {
    childStatus: result.child_status_at_18,
    parentEvaluation: result.parent_evaluation,
    futureOutlook: result.future_outlook
  });
};

/**
 * Check for missing prompts in a language
 */
export const checkMissingPrompts = (targetLang: SupportedLanguage = 'en'): string[] => {
  const missing: string[] = [];
  const referenceLang: SupportedLanguage = targetLang === 'zh' ? 'en' : 'zh';
  
  const checkObject = (obj: any, refObj: any, path: string = '') => {
    for (const key in refObj) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof refObj[key] === 'object' && refObj[key] !== null) {
        if (!obj[key] || typeof obj[key] !== 'object') {
          missing.push(currentPath);
        } else {
          checkObject(obj[key], refObj[key], currentPath);
        }
      } else if (typeof refObj[key] === 'string') {
        if (!obj[key] || typeof obj[key] !== 'string') {
          missing.push(currentPath);
        }
      }
    }
  };
  
  if (promptResources[targetLang] && promptResources[referenceLang]) {
    checkObject(promptResources[targetLang], promptResources[referenceLang]);
  }
  
  return missing;
};

export default {
  generateSystemPrompt,
  generateQuestionPrompt,
  generateOutcomeAndNextQuestionPrompt,
  generateInitialStatePrompt,
  generateEndingPrompt,
  formatEndingResult,
  checkMissingPrompts,
  getCurrentLanguage
}; 
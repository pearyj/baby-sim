import i18n from '../i18n';
import type { GameState } from '../types/game';
import logger from '../utils/logger';
import { isSupportedLanguage, type SupportedLanguage } from '../utils/languageDetection';

// Import prompt files
import zhPrompts from '../i18n/prompts/zh.json';
import enPrompts from '../i18n/prompts/en.json';

// Import activeGameStyle from gptServiceUnified
let activeGameStyle: GameStyle = 'realistic';

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

export type GameStyle = 'realistic' | 'fantasy' | 'cool';

// Mapping of internal style keys to translations per language
const styleTranslations: Record<GameStyle, { zh: string; en: string }> = {
  realistic: { zh: '真实', en: 'realistic' },
  fantasy: { zh: '魔幻', en: 'fantasy' },
  cool: { zh: '爽', en: 'thrilling' },
};

export const generateSystemPrompt = (gameStyle: GameStyle = 'realistic', specialRequirements?: string): string => {
  logger.info(`📝 Generating system prompt with style ${gameStyle}` + (specialRequirements ? ' and special requirements' : ''));

  const template = getPrompt('system.main');

  const currentLang = getCurrentLanguage();
  const styleDesc = styleTranslations[gameStyle]?.[currentLang] || gameStyle;

  // Base prompt with style filled in
  let systemPrompt = interpolatePrompt(template, { gameStyle: styleDesc });

  // If there are special requirements from the user, append a note so the LLM keeps them in mind
  if (specialRequirements && specialRequirements.trim().length > 0) {
    const customizationTemplates: Record<SupportedLanguage, string> = {
      en: 'The user requested before the child\'s birth: "{{specialRequirements}}". Please ensure the story respects this request.',
      zh: '用户在孩子出生前提出了要求：「{{specialRequirements}}」。请确保故事遵循这一要求。',
    } as const;

    const noteTemplate = customizationTemplates[currentLang] || customizationTemplates['en'];
    const note = interpolatePrompt(noteTemplate, { specialRequirements });

    systemPrompt += `\n\n${note}`;
  }

  return systemPrompt;
};

/**
 * Generate question prompt
 */
export const generateQuestionPrompt = (gameState: GameState, includeDetailedRequirements: boolean = true): string => {
  logger.info(`📝 Generating question prompt for child age ${gameState.child.age}`);
  
  const nextAge = gameState.child.age;
  
  // Prepare numerical header with both finance and relationship status
  let numericalHeader = "";
  if (typeof gameState.finance === 'number' && typeof gameState.isSingleParent === 'boolean') {
    const headerTemplate = getPrompt('variables.numericalHeader');
    numericalHeader = interpolatePrompt(headerTemplate, { 
      finance: gameState.finance, 
      marital: gameState.isSingleParent ? 0 : 5 // Convert boolean to marital number for template compatibility
    });
    logger.info(`Prepending numerical header: ${numericalHeader.trim()}`);
  } else {
    // Fallback to old financial header for backward compatibility
    if (typeof gameState.finance === 'number') {
      const headerTemplate = getPrompt('variables.financialHeader');
      numericalHeader = interpolatePrompt(headerTemplate, { financialBurden: gameState.finance });
      logger.info(`Fallback: Prepending financial header: ${numericalHeader.trim()}`);
    }
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
  
  // Get game style translation
  const currentLang = getCurrentLanguage();
  const gameStyleDesc = styleTranslations[activeGameStyle]?.[currentLang] || activeGameStyle;
  
  // Get base prompt and interpolate
  const baseTemplate = getPrompt('question.base');
  const basePrompt = interpolatePrompt(baseTemplate, {
    numericalHeader,
    gameStyle: gameStyleDesc,
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
  
  // Prepare numerical header with both finance and relationship status
  let numericalHeader = "";
  if (typeof gameState.finance === 'number' && typeof gameState.isSingleParent === 'boolean') {
    const headerTemplate = getPrompt('variables.numericalHeader');
    numericalHeader = interpolatePrompt(headerTemplate, { 
      finance: gameState.finance, 
      marital: gameState.isSingleParent ? 0 : 5 // Convert boolean to marital number for template compatibility
    });
  } else {
    // Fallback to old financial header for backward compatibility
    if (typeof gameState.finance === 'number') {
      const headerTemplate = getPrompt('variables.financialHeader');
      numericalHeader = interpolatePrompt(headerTemplate, { financialBurden: gameState.finance });
    }
  }
  
  // Handle crisis scenarios separately
  if (gameState.finance === 0 && gameState.isSingleParent) {
    // Both crises - prioritize financial crisis but mention single parent situation
    logger.info("🚨 Double crisis detected! Generating bankruptcy prompt with single parent context.");
    const bankruptcyTemplate = getPrompt('outcome.bankruptcy');
    const childGender = getPrompt(`question.childGender.${gameState.child.gender}`);
    
    return interpolatePrompt(bankruptcyTemplate, {
      numericalHeader,
      childName: gameState.child.name,
      childAge: gameState.child.age,
      childGender,
      question,
      choice
    });
  } else if (gameState.finance === 0) {
    // Financial crisis only
    logger.info("🚨 Financial crisis detected! Generating bankruptcy prompt.");
    const bankruptcyTemplate = getPrompt('outcome.bankruptcy');
    const childGender = getPrompt(`question.childGender.${gameState.child.gender}`);
    
    return interpolatePrompt(bankruptcyTemplate, {
      numericalHeader,
      childName: gameState.child.name,
      childAge: gameState.child.age,
      childGender,
      question,
      choice
    });
  } else if (gameState.isSingleParent) {
    // Single parent situation - but not crisis since they remain single parent permanently
    logger.info("📝 Single parent context noted for outcome generation.");
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
  
  // Get game style translation
  const currentLang = getCurrentLanguage();
  const gameStyleDesc = styleTranslations[activeGameStyle]?.[currentLang] || activeGameStyle;
  
  // Get base prompt and interpolate
  const baseTemplate = getPrompt('outcome.base');
  const basePrompt = interpolatePrompt(baseTemplate, {
    numericalHeader,
    gameStyle: gameStyleDesc,
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
  const promptBase = interpolatePrompt(baseTemplate, {
    playerGender,
    playerAge: gameState.player.age,
    playerDescription: gameState.playerDescription,
    childName: gameState.child.name,
    childGender,
    childDescription: gameState.childDescription,
    historyContext
  });
  
  // Instruct the LLM to provide an additional field "story_style" describing an illustrative art style (max 40 chars)
  const styleInstruction = `\n\nPlease also provide a field \"story_style\" (string, <=40 characters) summarizing an appropriate visual art style that matches the overall tone of the story (e.g., \"watercolor pastel\", \"cyberpunk neon\", \"童话插画\"). Return all fields in JSON format.`;
  
  return promptBase + styleInstruction;
};

/**
 * Format ending result
 */
export const formatEndingResult = (result: any): string => {
  const template = getPrompt('ending.formatPrefix');
  const summaryMarkdown = interpolatePrompt(template, {
    childStatus: result.child_status_at_18,
    parentEvaluation: result.parent_evaluation,
    futureOutlook: result.future_outlook
  });

  // If the model provided a recommended art style, embed it in an HTML comment so it is hidden in markdown
  if (result.story_style && typeof result.story_style === 'string') {
    return `${summaryMarkdown}\n\n<!-- story_style: ${result.story_style.trim()} -->`;
  }

  return summaryMarkdown;
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

// Function to set the active game style (called from gptServiceUnified)
export const setActiveGameStyle = (style: GameStyle) => {
  activeGameStyle = style;
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
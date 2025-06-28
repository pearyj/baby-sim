import { API_CONFIG } from '../config/api';
import type { GameState } from '../types/game';
import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { isSupportedLanguage, type SupportedLanguage } from '../utils/languageDetection';
import i18n from '../i18n';

// Import prompt files
import zhPrompts from '../i18n/prompts/zh.json';
import enPrompts from '../i18n/prompts/en.json';

// Security: Maximum length for custom art style to prevent jailbreaking (language-specific)
const getMaxCustomArtStyleLength = (language: SupportedLanguage): number => {
  return language === 'zh' ? 30 : 60; // 30 for Chinese, 60 for English
};

type PromptResources = {
  [key in SupportedLanguage]: any;
};

const promptResources: PromptResources = {
  zh: zhPrompts,
  en: enPrompts
};

// Image generation interfaces
export interface ImageGenerationOptions {
  /**
   * Optional free-form art style description supplied by the user (e.g., "Watercolor", "Oil painting", "赛博朋克").
   * When provided it will be appended to the prompt as "Style: {customArtStyle}.".
   */
  customArtStyle?: string;
  size?: '512x512' | '768x768' | '1024x1024';
  quality?: 'standard' | 'hd';
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

/**
 * Get the current language from i18n with proper fallback
 */
const getCurrentLanguage = (): SupportedLanguage => {
  const currentLang = i18n.language;
  
  // Ensure we have a supported language, fallback to English
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
      logger.warn(`Image prompt '${keyPath}' not found in ${currentLang}, using English fallback`);
    }
  }
  
  // Fallback to Chinese if still not found and current language is not Chinese
  if (!prompt && currentLang !== 'zh') {
    prompt = getPromptByPath(promptResources['zh'], keyPath);
    if (prompt) {
      logger.warn(`Image prompt '${keyPath}' not found in ${currentLang} or English, using Chinese fallback`);
    }
  }
  
  if (!prompt) {
    logger.error(`Image prompt '${keyPath}' not found in any language`);
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
 * Validate and sanitize custom art style input
 */
const validateAndSanitizeCustomArtStyle = (customArtStyle?: string): string | undefined => {
  if (!customArtStyle) return undefined;
  
  // Trim whitespace
  const trimmed = customArtStyle.trim();
  
  // Check length limit
  const maxLength = getMaxCustomArtStyleLength(getCurrentLanguage());
  if (trimmed.length > maxLength) {
    logger.warn(`Custom art style too long (${trimmed.length} chars), truncating to ${maxLength}`);
    return trimmed.substring(0, maxLength);
  }
  
  // Basic sanitization - remove potentially dangerous characters
  const sanitized = trimmed.replace(/[<>{}]/g, '');
  
  if (sanitized.length === 0) {
    logger.warn('Custom art style is empty after sanitization');
    return undefined;
  }
  
  return sanitized;
};

/**
 * Generate image prompt based on game state and ending summary
 */
const generateImagePrompt = (
  gameState: GameState, 
  endingSummary: string,
  options: ImageGenerationOptions = {}
): string => {
  const { customArtStyle } = options;
  
  // Get current language from i18n
  const lang = getCurrentLanguage();
  
  // Extract key information from game state using i18n labels
  const childGender = gameState.child.gender === 'male' 
    ? getPrompt('image.genderLabels.childMale') 
    : getPrompt('image.genderLabels.childFemale');
  const parentGender = gameState.player.gender === 'male'
    ? getPrompt('image.genderLabels.parentMale')
    : gameState.player.gender === 'female'
      ? getPrompt('image.genderLabels.parentFemale')
      : getPrompt('image.genderLabels.parentNonBinary');
  
  // Analyze ending summary to extract relationship dynamic and child's status at 18
  const relationshipDynamic = analyzeRelationshipFromSummary(endingSummary);
  const childStatusAt18 = extractChildStatusFromSummary(endingSummary);
  
  // Debug log the extracted sections
  logger.debug("🔍 Extracted relationship dynamic:", relationshipDynamic.substring(0, 100) + (relationshipDynamic.length > 100 ? "..." : ""));
  logger.debug("🔍 Extracted child status at 18:", childStatusAt18.substring(0, 100) + (childStatusAt18.length > 100 ? "..." : ""));
  
  // Get template from i18n (only future_vision template now)
  const template = getPrompt('image.templates.future_vision');
  
  // Validate and sanitize custom art style
  let resolvedArtStyle = validateAndSanitizeCustomArtStyle(customArtStyle);
  if (!resolvedArtStyle || resolvedArtStyle.length === 0) {
    resolvedArtStyle = getPrompt('image.defaultArtStyle');
  }
  
  // Build a richer child description using the ending-card field when available
  const rawChildDescription = (gameState.childDescription ?? '').trim();
  // Fallback to the child's name if the rich description is absent
  const childDescriptionForPrompt = rawChildDescription.length > 0 ? rawChildDescription : gameState.child.name;
  // Truncate extremely long descriptions to keep the prompt concise
  // English: 160 chars (more verbose), Chinese: 120 chars (more information-dense)
  const maxLength = lang === 'zh' ? 120 : 160;
  const truncatedChildDescription = childDescriptionForPrompt.length > maxLength
    ? `${childDescriptionForPrompt.slice(0, maxLength)}...`
    : childDescriptionForPrompt;
  
  // Use child status at 18 if available, otherwise fall back to gameState.childDescription
  const childStatusForImage = childStatusAt18 || truncatedChildDescription;
  
  return (
    template
      .replace('{childGender}', childGender)
      .replace('{parentGender}', parentGender)
      .replace('{relationshipDynamic}', relationshipDynamic)
      .replace('{childStatusforImage}', childStatusForImage) // Keep for backward compatibility with existing templates
    + ` Style: ${resolvedArtStyle}.`);
};

/**
 * Extract parent evaluation content from ending summary for more specific image generation
 * Falls back to generic descriptions if extraction fails
 */
const analyzeRelationshipFromSummary = (summary: string): string => {
  const lang = getCurrentLanguage();
  
  let parentEvaluationSection = '';
  
  if (lang === 'zh') {
    // Look for the Chinese "对你养育方式的评价：" section
    const parentEvalMatch = summary.match(/\*\*对你养育方式的评价：?\*\*\s*([\s\S]*?)(?=\*\*|$)/);
    if (parentEvalMatch) {
      parentEvaluationSection = parentEvalMatch[1].trim();
    }
  } else {
    // Look for the English "Parent Evaluation:" section
    const parentEvalMatch = summary.match(/\*\*Parent Evaluation:?\*\*\s*([\s\S]*?)(?=\*\*|$)/);
    if (parentEvalMatch) {
      parentEvaluationSection = parentEvalMatch[1].trim();
    }
  }
  
  // If we found the actual parent evaluation section, extract key relationship insights
  if (parentEvaluationSection) {
    // Truncate if too long to keep the image prompt manageable
    // English: 200 chars, Chinese: 150 chars
    const maxLength = lang === 'zh' ? 150 : 200;
    if (parentEvaluationSection.length > maxLength) {
      parentEvaluationSection = parentEvaluationSection.slice(0, maxLength) + '...';
    }
    return parentEvaluationSection;
  }
  
  // Fallback to generic descriptions only if we couldn't extract the actual content
  logger.warn('Could not extract parent evaluation section from ending summary, using generic fallback');
  
  if (lang === 'zh') {
    if (summary.includes('亲密') || summary.includes('和谐')) {
      return getPrompt('image.relationshipDynamics.close');
    }
    if (summary.includes('理解') || summary.includes('支持')) {
      return getPrompt('image.relationshipDynamics.understanding');
    }
  } else {
    if (summary.includes('close') || summary.includes('strong bond')) {
      return getPrompt('image.relationshipDynamics.close');
    }
    if (summary.includes('understanding') || summary.includes('supportive')) {
      return getPrompt('image.relationshipDynamics.understanding');
    }
  }
  
  return getPrompt('image.relationshipDynamics.default');
};

/**
 * Extract child's status at 18 from ending summary for more specific image generation
 * Falls back to gameState.childDescription if extraction fails
 */
const extractChildStatusFromSummary = (summary: string): string => {
  const lang = getCurrentLanguage();
  
  let childStatusSection = '';
  
  if (lang === 'zh') {
    // Look for the Chinese "孩子18岁时的状况：" section
    const childStatusMatch = summary.match(/\*\*孩子18岁时的状况：?\*\*\s*([\s\S]*?)(?=\*\*|$)/);
    if (childStatusMatch) {
      childStatusSection = childStatusMatch[1].trim();
    }
  } else {
    // Look for the English "Child's Status at 18:" section
    const childStatusMatch = summary.match(/\*\*Child'?s Status at 18:?\*\*\s*([\s\S]*?)(?=\*\*|$)/);
    if (childStatusMatch) {
      childStatusSection = childStatusMatch[1].trim();
    }
  }
  
  // If we found the actual child status section, use it (truncated if too long)
  if (childStatusSection) {
    // Truncate if too long to keep the image prompt manageable
    // English: 300 chars, Chinese: 200 chars (Chinese is more information-dense)
    const maxLength = lang === 'zh' ? 200 : 300;
    if (childStatusSection.length > maxLength) {
      childStatusSection = childStatusSection.slice(0, maxLength) + '...';
    }
    return childStatusSection;
  }
  
  // Fallback: return empty string, will be handled by the calling function
  logger.warn('Could not extract child status at 18 section from ending summary');
  return '';
};

/**
 * Make image generation API request to Volcano Engine
 */
const makeImageGenerationRequest = async (
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> => {
  const { size = '768x768', quality = 'standard' } = options;
  
  // Debug log when sending request to API
  logger.debug("🚀 Sending image generation request to API with prompt:", prompt.substring(0, 100) + "...");
  
  // Check if we should use direct API mode (for development)
  const useDirectAPI = API_CONFIG.DIRECT_API_MODE;
  
  if (useDirectAPI) {
    // Direct API call to Volcano Engine (for development)
    const volcengineApiKey = import.meta.env.VITE_VOLCENGINE_VISUAL_API_KEY;
    if (!volcengineApiKey) {
      throw new Error('Volcano Engine API key not found for direct mode');
    }
    
    return makeDirectImageRequest(prompt, options);
  }
  
  // Use serverless function
  try {
    const requestBody = {
      prompt,
      size,
      quality,
      provider: 'volcengine'
    };
    
    // Debug log the full request payload
    logger.debug("📤 API Request payload:", requestBody);
    
    const response = await fetch(API_CONFIG.SERVERLESS_API_URL.replace('/chat', '/image'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Image Generation Serverless API Error:`, response.status, errorText);
      return {
        success: false,
        error: `Failed to generate image: ${response.statusText || errorText}`
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      imageUrl: data.imageUrl,
      imageBase64: data.imageBase64
    };
  } catch (error) {
    logger.error(`❌ Exception in image generation API call:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Direct API call to Volcano Engine for image generation (development only)
 */
const makeDirectImageRequest = async (
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> => {
  const apiKey = import.meta.env.VITE_VOLCENGINE_VISUAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('Volcano Engine API key not configured for development mode');
  }

  // In development, we'll use the serverless function anyway
  // since the SDK is only available in the API directory
  return makeImageGenerationRequest(prompt, options);
};

/**
 * Main function to generate ending card image
 */
export const generateEndingImage = async (
  gameState: GameState,
  endingSummary: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> => {
  logger.info("🎨 Starting image generation for ending card");
  
  return performanceMonitor.timeAsync('generateEndingImage', 'api', async () => {
    try {
      // Validate options first
      if (!validateImageGenerationOptions(options)) {
        logger.error("❌ Invalid image generation options provided");
        return {
          success: false,
          error: 'Invalid image generation options'
        };
      }
      
      // Generate the image prompt
      const prompt = generateImagePrompt(gameState, endingSummary, options);
      
      // Debug log the full prompt for debugging purposes
      logger.debugImagePrompt(prompt, options);
      
      // Regular info log with truncated prompt for normal logging
      logger.info("📝 Generated image prompt:", prompt.substring(0, 200) + "...");
      
      // Make the API request
      const result = await makeImageGenerationRequest(prompt, options);
      
      if (result.success) {
        logger.info("✅ Image generation successful");
      } else {
        logger.error("❌ Image generation failed:", result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('❌ Error in generateEndingImage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });
};

/**
 * Validate image generation options
 */
export const validateImageGenerationOptions = (options: ImageGenerationOptions): boolean => {
  const validSizes = ['512x512', '768x768', '1024x1024'];
  const validQualities = ['standard', 'hd'];
  
  if (options.size && !validSizes.includes(options.size)) {
    logger.warn('Invalid image size provided:', options.size);
    return false;
  }
  
  if (options.quality && !validQualities.includes(options.quality)) {
    logger.warn('Invalid image quality provided:', options.quality);
    return false;
  }
  
  // Validate custom art style
  if (options.customArtStyle) {
    const trimmed = options.customArtStyle.trim();
    
    // Check length limit
    const maxLength = getMaxCustomArtStyleLength(getCurrentLanguage());
    if (trimmed.length > maxLength) {
      logger.warn(`Custom art style too long (${trimmed.length} chars), exceeds limit of ${maxLength}`);
      return false;
    }
    
    // Check for potentially dangerous characters
    const dangerousChars = /[<>{}]/;
    if (dangerousChars.test(trimmed)) {
      logger.warn('Custom art style contains potentially dangerous characters');
      return false;
    }
  }
  
  return true;
}; 
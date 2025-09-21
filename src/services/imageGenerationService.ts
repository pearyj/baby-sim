import { API_CONFIG } from '../config/api';
import type { GameState } from '../types/game';
import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import type { SupportedLanguage } from '../utils/languageDetection';
import { makePromptGetter, getCurrentLanguage as getLangUtil } from './promptUtils';
import useGameStore from '../stores/useGameStore';
import { processAndStoreImage } from './imageStorageService';
import i18n from '../i18n';

// Import prompt files
import zhPrompts from '../i18n/prompts/zh.json';
import enPrompts from '../i18n/prompts/en.json';
import jaPrompts from '../i18n/prompts/ja.json';
import esPrompts from '../i18n/prompts/es.json';

// Security: Maximum length for custom art style to prevent jailbreaking (language-specific)
const getMaxCustomArtStyleLength = (language: SupportedLanguage): number => {
  return language === 'zh' ? 30 : 60; // 30 for Chinese, 60 for others
};

type PromptResources = {
  [key in SupportedLanguage]: any;
};

const promptResources: PromptResources = {
  zh: zhPrompts,
  en: enPrompts,
  ja: jaPrompts,
  es: esPrompts
};

// Image generation interfaces
export interface ImageGenerationOptions {
  /**
   * Optional free-form art style description supplied by the user (e.g., "Watercolor", "Oil painting", "赛博朋克").
   * When provided it will be appended to the prompt as "Style: {customArtStyle}.".
   */
  customArtStyle?: string;
  size?: '512x512' | '768x768' | '1024x1024' | '1920x640';
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
const getCurrentLanguage = (): SupportedLanguage => getLangUtil();

/**
 * Get a prompt by key path with fallback to English then Chinese
 */
const getPrompt = makePromptGetter(promptResources as any);

/**
 * Helper function to get nested property by dot notation path
 */
// Note: prompt path resolution handled by promptUtils via makePromptGetter

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
 * Make a simple API request to summarize text
 */
const makeSimpleAPIRequest = async (messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>): Promise<string> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        provider: 'volcengine',
        streaming: false
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    logger.error('❌ Error in API request:', error);
    throw error;
  }
};

/**
 * Summarize outcome text using AI model for image generation
 * Returns 50 characters for Chinese/Japanese, 100 characters for other languages
 */
const summarizeOutcome = async (outcome: string): Promise<string> => {
  if (!outcome || outcome.trim().length === 0) {
    return '快乐成长的场景';
  }
  
  const currentLanguage = getCurrentLanguage();
  const targetLength = (currentLanguage === 'zh' || currentLanguage === 'ja') ? 50 : 100;
  
  try {
    const messages = [
      {
        role: 'system' as const,
        content: `你是一个专业的文本总结助手。请将用户提供的文本总结为适合图像生成的简洁描述。

要求：
- 如果是中文或日文，总结为${targetLength}字左右
- 如果是其他语言，总结为${targetLength}个字符左右
- 保持核心情景和情感
- 适合作为图像生成的提示词
- 不要添加引号或其他格式符号
- 直接返回总结内容`
      },
      {
        role: 'user' as const,
        content: `请总结以下文本：\n\n${outcome}`
      }
    ];
    
    const summary = await makeSimpleAPIRequest(messages);
    
    // Fallback to ensure length constraints
    if (summary.length > targetLength * 1.5) {
      return summary.substring(0, targetLength) + '...';
    }
    
    return summary;
  } catch (error) {
    logger.error('❌ Error summarizing outcome with AI:', error);
    
    // Fallback to simple truncation
    const cleaned = outcome.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= targetLength) {
      return cleaned;
    }
    
    const truncated = cleaned.substring(0, targetLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > targetLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
};

/**
 * Generate image prompt based on game state and ending summary
 */
const generateImagePrompt = async (
  gameState: GameState, 
  endingSummary: string,
  options: ImageGenerationOptions = {},
  aiGeneratedText?: string // AI generated text from chat API
): Promise<string> => {
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
  
  // Extract first three sentences from AI generated text if provided
  let aiTextContext = '';
  
  
  // Get template from i18n (only future_vision template now)
  const template = getPrompt('image.templates.current_age_vision');
  
  // Validate and sanitize custom art style
  let resolvedArtStyle = validateAndSanitizeCustomArtStyle(customArtStyle);
  if (!resolvedArtStyle || resolvedArtStyle.length === 0) {
    resolvedArtStyle = getPrompt('image.defaultArtStyle');
  }
  
  // Build a richer child description using the ending-card field when available
  const rawChildDescription = (gameState.childDescription ?? '').trim();
  
  // Find the outcome for the current age from history
  const currentAge = gameState.child.age;
  const currentAgeHistory = gameState.history.find(h => h.age === (currentAge -1 ));
  const rawChildCurAgeDescription = currentAgeHistory?.outcome || '';
  
  // Fallback to the child's name if the rich description is absent
  const childDescriptionForPrompt = rawChildDescription.length > 0 ? rawChildDescription : gameState.child.name;
  // Truncate extremely long descriptions to keep the prompt concise
  // English: 160 chars (more verbose), Chinese: 120 chars (more information-dense)
  const maxLength = lang === 'zh' ? 120 : 160;
  const truncatedChildDescription = childDescriptionForPrompt.length > maxLength
    ? `${childDescriptionForPrompt.slice(0, maxLength)}...`
    : childDescriptionForPrompt;

  const truncatedCurAgeDescription = rawChildCurAgeDescription.length > maxLength
    ? `${rawChildCurAgeDescription.slice(0, maxLength)}...`
    : rawChildCurAgeDescription;
  
  // Use child status at 18 if available, otherwise fall back to gameState.childDescription
  const childStatusForImage = childStatusAt18 || truncatedChildDescription;
  const childCurAgeStatusForImage = await summarizeOutcome(truncatedCurAgeDescription);
  console.log("childCurAgeStatusForImage", childCurAgeStatusForImage)

  // Add randomization elements to increase image diversity
  const randomElements = [
    'warm lighting', 'soft natural light', 'golden hour lighting', 'studio lighting',
    'close-up perspective', 'medium shot', 'environmental portrait', 'candid moment',
    'serene atmosphere', 'joyful mood', 'contemplative scene', 'peaceful setting',
    'detailed background', 'blurred background', 'indoor setting', 'outdoor scene'
  ];
  
  // Select 2-3 random elements to add variety
  const selectedElements = [];
  const numElements = Math.floor(Math.random() * 2) + 2; // 2-3 elements
  const shuffled = [...randomElements].sort(() => Math.random() - 0.5);
  for (let i = 0; i < numElements && i < shuffled.length; i++) {
    selectedElements.push(shuffled[i]);
  }
  
  const randomModifiers = selectedElements.join(', ');
  const childHairColor = i18n.t(`game.${gameState.child.haircolor}`);
  console.log("relationshipDynamic", relationshipDynamic)
  return (
    template
      .replace('{childGender}', childGender)
      .replace('{parentGender}', parentGender)
      .replace('{childAge}', (gameState.child.age - 1).toString())
      .replace('{relationshipDynamic}', relationshipDynamic)
      .replace('{aiOutcome}', childCurAgeStatusForImage)
      .replace('{childHairColor}', childHairColor)
      .replace('{childRace}', gameState.child.race)
      .replace('{childEnv}', aiTextContext) // Keep for backward compatibility with existing templates
      .replace('{childStatusforImage}', childCurAgeStatusForImage) // Keep for future_vision template compatibility
    + ` ${randomModifiers}`
  );
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
    // Direct API call to Doubao (for development)
    const doubaoApiKey = import.meta.env.VITE_VOLCENGINE_LLM_API_KEY || import.meta.env.VITE_VOLCENGINE_VISUAL_API_KEY;
    if (!doubaoApiKey) {
      throw new Error('Doubao API key not found for direct mode');
    }
    
    return makeDirectImageRequest(prompt, options);
  }
  
  // Use serverless function
  try {
    const requestBody = {
      prompt,
      size,
      quality,
      provider: 'doubao'
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
    console.log('🌐 imageData API Response data:', data);
    console.log('🔗 imageData API returned imageUrl?', !!data.imageUrl);
    console.log('📸 imageData API returned imageBase64?', !!data.imageBase64);
    
    const result = {
      success: true,
      imageUrl: data.imageUrl,
      imageBase64: data.imageBase64
    };
    console.log('✅ imageData Final result from makeImageGenerationRequest:', result);
    
    return result;
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
  options: ImageGenerationOptions = {},
  aiGeneratedText?: string // AI generated text from chat API
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
      const prompt = await generateImagePrompt(gameState, endingSummary, options, aiGeneratedText);
      
      // Debug log the full prompt for debugging purposes
      logger.debugImagePrompt(prompt, options);
      
      // Regular info log with truncated prompt for normal logging
      logger.info("📝 Generated image prompt:", prompt.substring(0, 200) + "...");
      
      // Make the API request
      const result = await makeImageGenerationRequest(prompt, options);
      
      if (result.success) {
        logger.info("✅ Image generation successful");
        
        // Store the generated image using new image storage service
        if (result.imageBase64) {
          console.log('💾 imageGenerationService processing and storing image for age:', gameState.child.age);
          
          // 使用新的图片存储服务：上传到Supabase并存储URL
          const kidId = gameState.child.name || 'unknown';
          const storageResult = await processAndStoreImage(
            result.imageBase64,
            gameState.child.age,
            kidId
          );
          
          if (storageResult.success && storageResult.imageUrl) {
            const { addGeneratedImage } = useGameStore.getState();
            addGeneratedImage(gameState.child.age, {
              imageUrl: storageResult.imageUrl,
              // 保留base64用于立即显示，但不存储到localStorage
              imageBase64: result.imageBase64
            });
            console.log('✅ imageGenerationService image uploaded and URL stored successfully');
          } else {
            console.warn('⚠️ imageGenerationService: Failed to upload image, falling back to base64 storage');
            // 如果上传失败，仍然存储base64作为备选方案
            const { addGeneratedImage } = useGameStore.getState();
            addGeneratedImage(gameState.child.age, {
              imageBase64: result.imageBase64
            });
          }
        } else {
          console.warn('⚠️ imageGenerationService: No imageBase64 data, skipping storage');
        }
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
  const validSizes = ['512x512', '768x768', '1024x1024', '1920x640'];
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
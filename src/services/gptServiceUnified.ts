import { API_CONFIG } from '../config/api';
import i18n from '../i18n';
import { isSupportedLanguage } from '../utils/languageDetection';
import { throttledFetch } from '../utils/throttledFetch';
import type { Question, GameState } from '../types/game';
import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { makeStreamingJSONRequest } from './streamingService';
import { getOrCreateAnonymousId, consumeCreditAPI } from './paymentService';
import { usePaymentStore } from '../stores/usePaymentStore';
import {
  generateSystemPrompt as generateSystemPromptI18n,
  type GameStyle,
  setActiveGameStyle,
  generateQuestionPrompt as generateQuestionPromptI18n,
  generateOutcomeAndNextQuestionPrompt as generateOutcomeAndNextQuestionPromptI18n,
  generateInitialStatePrompt as generateInitialStatePromptI18n,
  generateEndingPrompt as generateEndingPromptI18n,
  generateRecentHistoryContext as generateRecentHistoryContextI18n,
  generateEndingHistoryContext as generateEndingHistoryContextI18n,
  generateOutcomeUserLines as generateOutcomeUserLinesI18n,
  getGpt5UltraGuardrails as getGpt5UltraGuardrailsI18n,
  formatEndingResult
} from './promptService';

// Shared interfaces
export interface ModelProvider {
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role?: string;
    };
    index: number;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  id?: string;
  model?: string;
  created?: number;
}

interface TokenUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  apiCalls: number;
  estimatedCost: number;
}

// Global token usage tracking
let globalTokenUsage: TokenUsageStats = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  apiCalls: 0,
  estimatedCost: 0
};

// Provider management functions
export const getActiveProvider = (): ModelProvider => {
  const provider = API_CONFIG.ACTIVE_PROVIDER;
  return getProviderByKey(provider);
};

export const getProviderByKey = (
  key: 'openai' | 'gpt5' | 'deepseek' | 'volcengine'
): ModelProvider => {
  // Helper to read provider keys from Vite env ─ only needed for DIRECT_API_MODE=true.
  const env = import.meta.env;

  const providers: Record<string, ModelProvider> = {
    openai: {
      name: 'openai',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: env.VITE_OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
    },
    gpt5: {
      name: 'openai',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: env.VITE_OPENAI_API_KEY || '',
      model: 'gpt-5-mini-2025-08-07',
    },
    deepseek: {
      name: 'deepseek',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: env.VITE_DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
    },
    volcengine: {
      name: 'volcengine',
      apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      apiKey: env.VITE_VOLCENGINE_LLM_API_KEY || '',
      model: 'deepseek-v3-250324',
    }
  };

  return providers[key] || providers.volcengine;
};

// Development-only: expose a helper to print current model and masked key prefix
export const debugPrintActiveModel = (): void => {
  try {
    if (!import.meta.env.DEV) return;
    const provider = getActiveProvider();
    // Only reveal key prefix when DIRECT_API_MODE is enabled (key is in browser env)
    const showKey = API_CONFIG.DIRECT_API_MODE;
    const keyPrefix = showKey && provider.apiKey ? `${provider.apiKey.slice(0, 6)}...` : '(hidden)';
    // eslint-disable-next-line no-console
    console.log(
      `🤖 Active provider: ${provider.name} | model: ${provider.model} | key: ${keyPrefix} | direct=${API_CONFIG.DIRECT_API_MODE}`
    );
  } catch (_) {
    // ignore
  }
};

export const switchProvider = (): ModelProvider => {
  const providers = ['openai', 'gpt5', 'deepseek', 'volcengine'] as const;
  const currentIndex = providers.indexOf(API_CONFIG.ACTIVE_PROVIDER as any);
  const nextIndex = (currentIndex + 1) % providers.length;
  
  API_CONFIG.ACTIVE_PROVIDER = providers[nextIndex];
  logger.info(`🔄 Switched to ${API_CONFIG.ACTIVE_PROVIDER} model provider`);
  try {
    window.dispatchEvent(new CustomEvent('model-provider-changed'));
  } catch (_) {}
  return getActiveProvider();
};

export const getCurrentModel = (): string => {
  const provider = getActiveProvider();
  return `${provider.name} - ${provider.model}`;
};

// Token usage management
export const getTokenUsageStats = (): TokenUsageStats => {
  return { ...globalTokenUsage };
};

export const resetTokenUsageStats = (): void => {
  globalTokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    apiCalls: 0,
    estimatedCost: 0
  };
  logger.info('🔄 Token usage statistics have been reset');
};

// ─────────────────────────────────────────────────────────────
// Game Style Handling
// ─────────────────────────────────────────────────────────────

// Local persistence helpers (scoped here to avoid cross-module coupling)
const GAME_STYLE_STORAGE_KEY = 'childSimGameStyle';
const PROVIDER_OVERRIDE_STORAGE_KEY = 'childSimProvider'; // allowed: 'deepseek' | 'gpt5'
const isLocalStorageAvailableForStyle = (): boolean => {
  try {
    const testKey = '__styleLocalStorageTest__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
};

const readPersistedGameStyle = (): GameStyle | null => {
  if (!isLocalStorageAvailableForStyle()) return null;
  try {
    const raw = localStorage.getItem(GAME_STYLE_STORAGE_KEY);
    if (raw === 'realistic' || raw === 'fantasy' || raw === 'cool' || raw === 'ultra') {
      return raw as GameStyle;
    }
    return null;
  } catch (_) {
    return null;
  }
};

const writePersistedGameStyle = (style: GameStyle): void => {
  if (!isLocalStorageAvailableForStyle()) return;
  try {
    localStorage.setItem(GAME_STYLE_STORAGE_KEY, style);
  } catch (_) {
    // ignore persistence failures
  }
};

type ProviderOverrideKey = 'volcengine' | 'deepseek' | 'gpt5' | null;

const readPersistedProviderOverride = (): ProviderOverrideKey => {
  if (!isLocalStorageAvailableForStyle()) return null;
  try {
    const raw = localStorage.getItem(PROVIDER_OVERRIDE_STORAGE_KEY);
    if (raw === 'volcengine' || raw === 'gpt5') return raw;
    return null;
  } catch (_) {
    return null;
  }
};

const writePersistedProviderOverride = (key: ProviderOverrideKey): void => {
  if (!isLocalStorageAvailableForStyle()) return;
  try {
    if (!key) localStorage.removeItem(PROVIDER_OVERRIDE_STORAGE_KEY);
    else localStorage.setItem(PROVIDER_OVERRIDE_STORAGE_KEY, key);
  } catch (_) {
    // ignore
  }
};

// Default to ultra for non-Chinese languages, realistic for Chinese
const initialLang = (() => {
  const lang = i18n.language;
  return isSupportedLanguage(lang) ? lang : 'en';
})();
// Prefer persisted style if available, otherwise default by language
const persistedStyle = readPersistedGameStyle();
let activeGameStyle: GameStyle = persistedStyle ?? (initialLang === 'zh' ? 'realistic' : 'ultra');
let providerOverride: ProviderOverrideKey = readPersistedProviderOverride();
// Keep promptService in sync with the resolved style at startup
setActiveGameStyle(activeGameStyle);
// Initialize provider by style. If ultra, ignore persisted overrides and lock to GPT-5
if (activeGameStyle === 'ultra') {
  (API_CONFIG as any).ACTIVE_PROVIDER = 'gpt5';
  providerOverride = null; // lock mode: overrides disabled in ultra
} else if (providerOverride) {
  (API_CONFIG as any).ACTIVE_PROVIDER = providerOverride;
} else {
  // Default to Volcengine DeepSeek variant in non-ultra mode
  (API_CONFIG as any).ACTIVE_PROVIDER = 'volcengine';
}
try {
  window.dispatchEvent(new CustomEvent('model-provider-changed'));
  window.dispatchEvent(new CustomEvent('game-style-changed', { detail: { style: activeGameStyle } }));
} catch (_) {}
// Store current special requirements to ensure they are passed to every system prompt
let currentSpecialRequirements: string | undefined = undefined;

export const setSpecialRequirements = (requirements?: string) => {
  currentSpecialRequirements = requirements?.trim() || undefined;
  if (currentSpecialRequirements) {
    logger.info(`📌 Stored special requirements for prompts: ${currentSpecialRequirements}`);
  } else {
    logger.info('📌 Cleared special requirements for prompts');
  }
};

export const setGameStyle = (style: GameStyle) => {
  activeGameStyle = style;
  setActiveGameStyle(style);
  logger.info(`🎨 Game style set to ${style}`);
  // Persist selection so it survives page refreshes
  writePersistedGameStyle(style);
  // Enforce provider policy per style
  if (style === 'ultra') {
    // Lock to GPT-5 and clear any override
    providerOverride = null;
    (API_CONFIG as any).ACTIVE_PROVIDER = 'gpt5';
    logger.info('🔒 Ultra mode: locking to GPT-5 and disabling overrides');
  } else {
    // Non-ultra: default Volcengine unless user has an override
    (API_CONFIG as any).ACTIVE_PROVIDER = providerOverride || 'volcengine';
    logger.info(`🎯 Non‑ultra mode: ACTIVE_PROVIDER ${API_CONFIG.ACTIVE_PROVIDER}`);
  }
  try {
    window.dispatchEvent(new CustomEvent('model-provider-changed'));
  } catch (_) {}
  try {
    window.dispatchEvent(new CustomEvent('game-style-changed', { detail: { style } }));
  } catch (_) {}
};

export const isPremiumStyleActive = (): boolean => activeGameStyle === 'ultra';

export const getProviderOverride = (): ProviderOverrideKey => providerOverride;

export const setProviderOverride = (key: ProviderOverrideKey): void => {
  // If ultra is active, ignore overrides and keep GPT-5
  if (activeGameStyle === 'ultra') {
    providerOverride = null;
    (API_CONFIG as any).ACTIVE_PROVIDER = 'gpt5';
    writePersistedProviderOverride(providerOverride);
    try { window.dispatchEvent(new CustomEvent('model-provider-changed')); } catch (_) {}
    return;
  }
  providerOverride = key;
  // If user explicitly chooses a provider, apply immediately; if cleared, fall back to Volcengine
  (API_CONFIG as any).ACTIVE_PROVIDER = key || 'volcengine';
  writePersistedProviderOverride(providerOverride);
  try {
    window.dispatchEvent(new CustomEvent('model-provider-changed'));
  } catch (_) {}
};

export const getEffectiveProviderKey = (): 'openai' | 'volcengine' | 'gpt5' | 'deepseek' => {
  // Ultra style is locked to GPT-5
  if (activeGameStyle === 'ultra') return 'gpt5';
  // Otherwise respect explicit override, fallback to Volcengine
  if (providerOverride === 'volcengine' || providerOverride === 'gpt5') return providerOverride;
  return 'volcengine';
};

// Shared prompt generation functions (now using i18n)
export const generateSystemPrompt = (): string => {
  return generateSystemPromptI18n(activeGameStyle, currentSpecialRequirements);
};

export const generateQuestionPrompt = (
  gameState: GameState,
  includeDetailedRequirements: boolean = true,
  includeHistoryContext: boolean = true
): string => {
  return generateQuestionPromptI18n(gameState, includeDetailedRequirements, includeHistoryContext);
};

export const generateOutcomeAndNextQuestionPrompt = (
  gameState: GameState,
  question: string,
  choice: string,
  shouldGenerateNextQuestion: boolean,
  includeHistoryContext: boolean = true,
  includeChoiceLines: boolean = true
): string => {
  return generateOutcomeAndNextQuestionPromptI18n(
    gameState,
    question,
    choice,
    shouldGenerateNextQuestion,
    includeHistoryContext,
    includeChoiceLines
  );
};

export const generateInitialStatePrompt = (
  specialRequirements?: string,
  includeRequirements: boolean = true
): string => {
  return generateInitialStatePromptI18n(specialRequirements, includeRequirements);
};

export const generateEndingPrompt = (gameState: GameState, includeHistoryContext: boolean = true): string => {
  return generateEndingPromptI18n(gameState, includeHistoryContext);
};

// Unified service interface
export interface GPTServiceOptions {
  streaming?: boolean;
  onProgress?: (partialContent: string) => void;
}

// Helper function to safely parse JSON from API responses
const safeJsonParse = (content: string): any => {
  logger.info("🔍 Parsing JSON response");
  
  // Remove any markdown code block markers if present
  let jsonContent = content
    .replace(/```(json)?/g, '') // Remove ```json or ``` markers
    .replace(/```/g, '')        // Remove closing ``` markers
    .trim();                     // Remove extra whitespace
  
  try {
    // More aggressive JSON content cleaning
    jsonContent = jsonContent
      // Remove illegal control characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      // Fix common escape sequence issues
      .replace(/\\u0000|\\u0001|\\u0002|\\u0003|\\u0004|\\u0005|\\u0006|\\u0007|\\b|\\v|\\f|\\u000e|\\u000f/g, '')
      .replace(/\\u0010|\\u0011|\\u0012|\\u0013|\\u0014|\\u0015|\\u0016|\\u0017/g, '')
      .replace(/\\u0018|\\u0019|\\u001a|\\u001b|\\u001c|\\u001d|\\u001e|\\u001f/g, '')
      // Fix malformed escape sequences in strings
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\') // Fix invalid escape sequences
      // Fix unescaped quotes within strings (this is tricky, but we'll try a basic approach)
      .replace(/"([^"\\]*)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})([^"]*?)"/g, '"$1\\\\$2"')
      // Remove any trailing incomplete structures
      .replace(/,\s*$/, '') // Remove trailing commas
      .replace(/\]\s*$/g, '}'); // Fix incomplete arrays/objects
    
    logger.info("🧹 Cleaned JSON content for parsing");
    
    const parsed = JSON.parse(jsonContent);
    logger.info("✅ JSON parsed successfully:", JSON.stringify(parsed, null, 2).substring(0, 500) + (JSON.stringify(parsed, null, 2).length > 500 ? "..." : ""));
    return parsed;
  } catch (error) {
    logger.error('❌ JSON parsing error:', error);
    logger.error('Original content:', content.substring(0, 1000));
    logger.error('Cleaned content:', jsonContent.substring(0, 1000));
    
    // Try a fallback approach - extract JSON manually if possible
    try {
      // Look for JSON-like structure in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const fallbackJson = jsonMatch[0]
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
          .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\')
          .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas before closing
        
        logger.info("🔧 Attempting fallback JSON parsing");
        const fallbackParsed = JSON.parse(fallbackJson);
        logger.info("✅ Fallback JSON parsing successful");
        return fallbackParsed;
      }
    } catch (fallbackError) {
      logger.error('❌ Fallback JSON parsing also failed:', fallbackError);
    }
    
    throw error;
  }
};

// Helper to charge credits for premium GPT-5 interactions
const chargePremiumInteraction = async (): Promise<void> => {
  // Charge only when GPT-5 is the effective provider
  const effectiveKey = getEffectiveProviderKey();
  if (effectiveKey !== 'gpt5') return;

  const anonId = getOrCreateAnonymousId();
  // Prefer charging against email balance first to avoid "no_credits" on anon_id
  const email = (() => {
    try {
      return usePaymentStore.getState().email || undefined;
    } catch (_) {
      return undefined;
    }
  })();

  try {
    const result = await consumeCreditAPI(anonId, email, 0.05);
    // Update local store with remaining balance
    try {
      usePaymentStore.setState({ credits: result.remaining });
    } catch (_) {
      /* ignore state update errors */
    }
  } catch (error: any) {
    // Propagate explicit no_credits errors so that caller can trigger paywall
    if (error instanceof Error && error.message === 'no_credits') {
      throw error;
    }
    // Silently ignore other failures (network, etc.) to avoid blocking gameplay
  }
};

// Helper function to make API requests with the (possibly overridden) provider
const makeModelRequest = async (messages: ChatMessage[]): Promise<OpenAIResponse> => {
  const effectiveProviderKey = getEffectiveProviderKey();
  const activeProvider = getActiveProvider();
  const provider = getProviderByKey(effectiveProviderKey);
  logger.info(
    `📤 Sending API request with provider key ${effectiveProviderKey} (effective=${provider.name}/${provider.model}, active=${activeProvider.name}/${activeProvider.model})`
  );
  
  // ─────────────────────────────────────────────────────────────
  // FULL PROMPT LOGGING - Log complete messages array
  // ─────────────────────────────────────────────────────────────
  logger.info("📋 FULL PROMPT BEING SENT TO API:");
  messages.forEach((message, index) => {
    logger.info(`  [${index}] ${message.role.toUpperCase()}:`);
    logger.info(message.content);
  });
  logger.info("─────────────────────────────────────────────────────────────");

  // Dev-only: console group with full messages for easier manual inspection
  try {
    if (import.meta.env && import.meta.env.DEV) {
      console.group('🔍 FULL MESSAGES ARRAY (Non-Streaming)');
      messages.forEach((m, i) => {
        console.log(`[${i}] role=${m.role}`);
        console.log(m.content);
      });
      console.groupEnd();
    }
  } catch (_) {}
  
  performanceMonitor.startTiming(`API-${provider.name}-request`, 'api', {
    provider: provider.name,
    model: provider.model,
    messageCount: messages.length
  });
  
  const cleanedMessages = JSON.parse(JSON.stringify(messages));
  
  // Check if we should use direct API mode (for development)
  const useDirectAPI = API_CONFIG.DIRECT_API_MODE;
  
  if (useDirectAPI) {
    // Legacy direct API call (for development only) - use effective provider
    return makeDirectAPIRequest(messages, provider);
  }
  
  // Use serverless function
  try {
    const response = await throttledFetch(API_CONFIG.SERVERLESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: cleanedMessages,
        provider: effectiveProviderKey as any,
        streaming: false
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      performanceMonitor.endTiming(`API-${provider.name}-request`);
      logger.error(`❌ Serverless API Error:`, response.status, responseText);
      throw new Error(`Failed serverless request: ${response.statusText || responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      performanceMonitor.endTiming(`API-${provider.name}-request`);
      logger.error(`Failed to parse serverless response as JSON: ${responseText}`);
      throw new Error(`Serverless function returned invalid JSON: ${e}`);
    }
    
    performanceMonitor.endTiming(`API-${provider.name}-request`);

    return data as OpenAIResponse;
  } catch (error) {
    performanceMonitor.endTiming(`API-${provider.name}-request`);
    logger.error(`❌ Exception in serverless API call:`, error);
    throw error;
  }
};

// Legacy direct API function (for development only)
const makeDirectAPIRequest = async (messages: ChatMessage[], provider: ModelProvider): Promise<OpenAIResponse> => {
  // ─────────────────────────────────────────────────────────────
  // FULL PROMPT LOGGING - Log complete messages array (Direct API)
  // ─────────────────────────────────────────────────────────────
  logger.info("📋 FULL PROMPT BEING SENT TO DIRECT API:");
  messages.forEach((message, index) => {
    logger.info(`  [${index}] ${message.role.toUpperCase()}:`);
    logger.info(message.content);
  });
  logger.info("─────────────────────────────────────────────────────────────");

  // Dev-only: console group with full messages for easier manual inspection
  try {
    if (import.meta.env && import.meta.env.DEV) {
      console.group('🔍 FULL MESSAGES ARRAY (Direct API)');
      messages.forEach((m, i) => {
        console.log(`[${i}] role=${m.role}`);
        console.log(m.content);
      });
      console.groupEnd();
    }
  } catch (_) {}
  
  let requestBody: any = {
    model: provider.model,
    messages: messages,
  };
  
  const isGpt5 = (provider.model || '').startsWith('gpt-5');
  if (provider.name === 'deepseek') {
    requestBody = {
      ...requestBody,
      max_tokens: 2048,
      stream: false,
      top_p: 0.8,
      frequency_penalty: 0,
      presence_penalty: 0,
    };
  } else if (!isGpt5) {
    // Only include temperature for non-GPT-5 models
    requestBody = {
      ...requestBody,
      temperature: 0.7,
    };
  }
  
  const response = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  if (!response.ok) {
    logger.error(`❌ Direct API Error from ${provider.name}:`, response.status, responseText);
    throw new Error(`Failed direct API request to ${provider.name}: ${response.statusText || responseText}`);
  }

  return JSON.parse(responseText) as OpenAIResponse;
};

const logTokenUsage = (functionName: string, data: OpenAIResponse): void => {
  if (data.usage) {
    const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
    
    globalTokenUsage.promptTokens += prompt_tokens;
    globalTokenUsage.completionTokens += completion_tokens;
    globalTokenUsage.totalTokens += total_tokens;
    globalTokenUsage.apiCalls += 1;
    
    const provider = getActiveProvider();
    let costPer1kTokens = 0;
    
    if (provider.name === 'openai') {
      costPer1kTokens = 0.002; // Approximate cost for GPT-3.5-turbo
    } else if (provider.name === 'deepseek') {
      costPer1kTokens = 0.0014; // DeepSeek pricing
    }
    
    const estimatedCost = (total_tokens / 1000) * costPer1kTokens;
    globalTokenUsage.estimatedCost += estimatedCost;
    
    logger.info(`📊 Token usage for ${functionName}:`, {
      prompt_tokens,
      completion_tokens,
      total_tokens,
      estimated_cost: estimatedCost.toFixed(4),
      provider: provider.name
    });
  }
};

// Unified service interface
export interface GPTServiceOptions {
  streaming?: boolean;
  onProgress?: (partialContent: string) => void;
}

export interface InitialStateType {
  player: {
    gender: 'male' | 'female' | 'nonBinary';
    age: number;
  };
  child: {
    name: string;
    gender: 'male' | 'female';
    age: number;
    haircolor?: string;
    race?: string;
  };
  playerDescription: string;
  childDescription: string;
  finance?: number;
  marital?: number;
  isSingleParent: boolean;
}

interface GenerateInitialStateOptions {
  specialRequirements?: string;
  preloadedState?: InitialStateType;
}

// Unified service functions
export const generateQuestion = async (
  gameState: GameState, 
  options: GPTServiceOptions = {}
): Promise<Question & { isExtremeEvent: boolean }> => {
  const { streaming = false, onProgress } = options;
  
  if (streaming && onProgress) {
    return generateQuestionStreaming(gameState, onProgress);
  } else {
    return generateQuestionSync(gameState);
  }
};

export const generateOutcomeAndNextQuestion = async (
  gameState: GameState,
  question: string,
  choice: string,
  options: GPTServiceOptions = {}
): Promise<{
  outcome: string;
  nextQuestion?: Question & { isExtremeEvent: boolean };
  isEnding?: boolean;
}> => {
  const { streaming = false, onProgress } = options;
  
  if (streaming && onProgress) {
    return generateOutcomeAndNextQuestionStreaming(gameState, question, choice, onProgress);
  } else {
    return generateOutcomeAndNextQuestionSync(gameState, question, choice);
  }
};

export const generateInitialState = async (
  options?: GenerateInitialStateOptions
): Promise<GameState> => {
  const { specialRequirements, preloadedState } = options || {};
  
  if (preloadedState) {
    return performanceMonitor.timeSync('generateInitialState-preloaded', 'local', () => {
      logger.info("🔄 Using preloaded initial state:", preloadedState);
      return {
        ...preloadedState,
        child: {
          ...preloadedState.child,
          haircolor: preloadedState.child.haircolor || 'black',
          race: preloadedState.child.race || '汉族'
        },
        history: [],
        currentQuestion: null,
        feedbackText: null,
        endingSummaryText: null,
        finance: preloadedState.finance || 5,
        isSingleParent: preloadedState.isSingleParent || false,
      } as GameState;
    });
  }
  
  return generateInitialStateSync(specialRequirements);
};

export const generateEnding = async (
  gameState: GameState,
  options: GPTServiceOptions = {}
): Promise<string> => {
  const { streaming = false, onProgress } = options;
  
  if (streaming && onProgress) {
    return generateEndingStreaming(gameState, onProgress);
  } else {
    return generateEndingSync(gameState);
  }
};



// Synchronous implementations
const generateQuestionSync = async (gameState: GameState): Promise<Question & { isExtremeEvent: boolean }> => {
  logger.info(`🚀 Function called: generateQuestion(child.age=${gameState.child.age})`);
  
  return performanceMonitor.timeAsync('generateQuestion', 'api', async () => {
    const systemPrompt = generateSystemPrompt();
    const assistantHistory = generateRecentHistoryContextI18n(gameState);
  const systemQuestionPrompt = generateQuestionPrompt(gameState, true, false);
    
    // 🐛 COMPREHENSIVE LOGGING - FULL PROMPTS (development only)
    if (import.meta.env.DEV) {
      console.log('\n🔍 ===== GENERATE QUESTION DEBUG =====');
      console.log('🎯 SYSTEM PROMPT (FULL):');
      console.log(systemPrompt);
      console.log('\n📝 SYSTEM QUESTION PROMPT (FULL):');
      console.log(systemQuestionPrompt);
      console.log('\n📊 GAME STATE SENT TO LLM:');
      console.log(JSON.stringify(gameState, null, 2));
    }
    
    const conciseNote = (getEffectiveProviderKey() === 'gpt5') ? getGpt5UltraGuardrailsI18n() : '';
    const combinedSystem = `${systemPrompt}\n\n${systemQuestionPrompt}${conciseNote ? `\n\n${conciseNote}` : ''}`;
    const messages: ChatMessage[] = [
      { role: 'system', content: combinedSystem },
      ...(assistantHistory ? [{ role: 'assistant', content: assistantHistory }] as ChatMessage[] : [])
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for question');
      
      logTokenUsage('generateQuestion', data);
      
      const content = data.choices[0].message.content;
      
      // 🐛 COMPREHENSIVE LOGGING - FULL RESPONSE (development only)
      if (import.meta.env.DEV) {
        console.log('\n📦 LLM RESPONSE (FULL):');
        console.log(content);
        console.log('\n🔄 PARSING RESPONSE...');
      }
      
      logger.info('📄 API response content (question):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      const result = performanceMonitor.timeSync('safeJsonParse-question', 'local', () => {
        return safeJsonParse(content);
      });
      
      // 🐛 LOG PARSED RESULT (development only)
      if (import.meta.env.DEV) {
        console.log('\n✅ PARSED RESULT:');
        console.log(JSON.stringify(result, null, 2));
        console.log('\n📋 EXTRACTED OPTIONS WITH DELTAS:');
        if (result.options) {
          result.options.forEach((opt: any, index: number) => {
            console.log(`Option ${index + 1}: ${opt.text}`);
            console.log(`  - financeDelta: ${opt.financeDelta || 0}`);
            console.log(`  - maritalDelta: ${opt.maritalDelta || 0}`);
            console.log(`  - cost (legacy): ${opt.cost || 0}`);
          });
        }
        console.log('🔍 ===== END GENERATE QUESTION DEBUG =====\n');
      }
      
      const question: Question & { isExtremeEvent: boolean } = {
        id: `q_${Date.now()}`,
        question: result.question,
        options: result.options,
        isExtremeEvent: result.isExtremeEvent || false
      };
      // Charge premium credit per interaction (post-success), excluding initialization
      await chargePremiumInteraction();

      return question;
    } catch (error) {
      logger.error('❌ Error generating question:', error);
      throw error;
    }
  });
};

const generateOutcomeAndNextQuestionSync = async (
  gameState: GameState,
  question: string,
  choice: string
): Promise<{
  outcome: string;
  nextQuestion?: Question & { isExtremeEvent: boolean };
  isEnding?: boolean;
}> => {
  logger.info(`🚀 Function called: generateOutcomeAndNextQuestion(child.age=${gameState.child.age})`);
  
  const shouldGenerateNextQuestion = gameState.child.age < 17;
  
  return performanceMonitor.timeAsync('generateOutcomeAndNextQuestion', 'api', async () => {
    const systemPrompt = generateSystemPrompt();
    const assistantHistory = generateRecentHistoryContextI18n(gameState);
    const systemOutcomePrompt = generateOutcomeAndNextQuestionPrompt(
      gameState,
      question,
      choice,
      shouldGenerateNextQuestion,
      false,
      true
    );
    const userChoiceLines = generateOutcomeUserLinesI18n(question, choice);
    
    // 🐛 COMPREHENSIVE LOGGING - FULL PROMPTS (development only)
    if (import.meta.env.DEV) {
      console.log('\n🔍 ===== GENERATE OUTCOME DEBUG =====');
      console.log('🎯 SYSTEM PROMPT (FULL):');
      console.log(systemPrompt);
      console.log('\n📝 SYSTEM OUTCOME PROMPT (FULL):');
      console.log(systemOutcomePrompt);
      console.log('\n📊 GAME STATE SENT TO LLM:');
      console.log(JSON.stringify(gameState, null, 2));
      console.log('\n🎯 SELECTED CHOICE:');
      console.log(`Question: ${question}`);
      console.log(`Choice: ${choice}`);
      console.log(`Should generate next question: ${shouldGenerateNextQuestion}`);
    }
    
    // Append concise note whenever effective provider is GPT-5
    const conciseNote = (getEffectiveProviderKey() === 'gpt5') ? getGpt5UltraGuardrailsI18n() : '';
    const combinedSystem = `${systemPrompt}\n\n${systemOutcomePrompt}${conciseNote ? `\n\n${conciseNote}` : ''}`;
    const messages: ChatMessage[] = [
      { role: 'system', content: combinedSystem },
      ...(assistantHistory ? [{ role: 'assistant', content: assistantHistory }] as ChatMessage[] : []),
      { role: 'user', content: userChoiceLines }
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for outcome and next question');
      
      logTokenUsage('generateOutcomeAndNextQuestion', data);
      
      const content = data.choices[0].message.content;
      
      // 🐛 COMPREHENSIVE LOGGING - FULL RESPONSE (development only)
      if (import.meta.env.DEV) {
        console.log('\n📦 LLM RESPONSE (FULL):');
        console.log(content);
        console.log('\n🔄 PARSING RESPONSE...');
      }
      
      logger.info('📄 API response content (outcome):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      const result = performanceMonitor.timeSync('safeJsonParse-outcome', 'local', () => {
        return safeJsonParse(content);
      });
      
      // 🐛 LOG PARSED RESULT (development only)
      if (import.meta.env.DEV) {
        console.log('\n✅ PARSED RESULT:');
        console.log(JSON.stringify(result, null, 2));
        console.log('\n📋 NEXT QUESTION OPTIONS (if any):');
        if (result.nextQuestion && result.nextQuestion.options) {
          result.nextQuestion.options.forEach((opt: any, index: number) => {
            console.log(`Option ${index + 1}: ${opt.text}`);
            console.log(`  - financeDelta: ${opt.financeDelta || 0}`);
            console.log(`  - maritalDelta: ${opt.maritalDelta || 0}`);
            console.log(`  - cost (legacy): ${opt.cost || 0}`);
          });
        }
        console.log('🔍 ===== END GENERATE OUTCOME DEBUG =====\n');
      }
      
      const response: {
        outcome: string;
        nextQuestion?: Question & { isExtremeEvent: boolean };
        isEnding?: boolean;
      } = {
        outcome: result.outcome
      };
      
      if (result.nextQuestion && shouldGenerateNextQuestion) {
        response.nextQuestion = {
          id: `q_${Date.now()}`,
          question: result.nextQuestion.question,
          options: result.nextQuestion.options,
          isExtremeEvent: result.nextQuestion.isExtremeEvent || false
        };
      } else if (!shouldGenerateNextQuestion) {
        response.isEnding = true;
      }
      // Charge premium credit per interaction (post-success), excluding initialization
      await chargePremiumInteraction();

      return response;
    } catch (error) {
      logger.error('❌ Error generating outcome and next question:', error);
      throw error;
    }
  });
};

const generateInitialStateSync = async (specialRequirements?: string): Promise<GameState> => {
  logger.info("🚀 Function called: generateInitialState()" + (specialRequirements ? " with special requirements" : ""));
  
  // Store the special requirements so subsequent prompts include them
  setSpecialRequirements(specialRequirements);
  
  return performanceMonitor.timeAsync('generateInitialState-full', 'api', async () => {
    const systemPrompt = generateSystemPrompt();
    const systemInitPrompt = generateInitialStatePrompt(specialRequirements, false);
    const conciseNote = (getEffectiveProviderKey() === 'gpt5') ? getGpt5UltraGuardrailsI18n() : '';
    const combinedSystem = `${systemPrompt}\n\n${systemInitPrompt}${conciseNote ? `\n\n${conciseNote}` : ''}`;
    const messages: ChatMessage[] = [
      { role: 'system', content: combinedSystem }
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for initial state');
      
      logTokenUsage('generateInitialState', data);
      
      const content = data.choices[0].message.content;
      logger.info('📄 API response content (initial state):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      return performanceMonitor.timeSync('safeJsonParse-initialState', 'local', () => {
        return safeJsonParse(content);
      });
    } catch (error) {
      logger.error('❌ Error generating initial state:', error);
      throw error;
    }
  });
};

const generateEndingSync = async (gameState: GameState): Promise<string> => {
  logger.info("🚀 Function called: generateEnding()");
  
  return performanceMonitor.timeAsync('generateEnding', 'api', async () => {
    const systemPrompt = generateSystemPrompt();
    const systemEndingPrompt = generateEndingPrompt(gameState, false);
    const assistantHistory = generateEndingHistoryContextI18n(gameState);
    const combinedSystem = `${systemPrompt}\n\n${systemEndingPrompt}`;
    const messages: ChatMessage[] = [
      { role: 'system', content: combinedSystem },
      ...(assistantHistory ? [{ role: 'assistant', content: assistantHistory }] as ChatMessage[] : [])
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for ending');
      
      logTokenUsage('generateEnding', data);
      
      const content = data.choices[0].message.content;
      logger.info('📄 API response content (ending):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      const result = performanceMonitor.timeSync('safeJsonParse-ending', 'local', () => {
        return safeJsonParse(content);
      });
      
      const formatted = formatEndingResult(result);
      // Charge premium credit per interaction (post-success), excluding initialization
      await chargePremiumInteraction();
      return formatted;
    } catch (error) {
      logger.error('❌ Error generating ending:', error);
      throw error;
    }
  });
};



// Streaming implementations

const generateQuestionStreaming = async (
  gameState: GameState,
  onProgress: (partialContent: string) => void
): Promise<Question & { isExtremeEvent: boolean }> => {
  logger.info(`🚀 Streaming function called: generateQuestion(child.age=${gameState.child.age})`);
  
  const systemPrompt = generateSystemPrompt();
  const systemQuestionPrompt = generateQuestionPrompt(gameState, false, false);
  const assistantHistory = generateRecentHistoryContextI18n(gameState);
  const streamingGuardrails = (getEffectiveProviderKey() === 'gpt5') ? getGpt5UltraGuardrailsI18n() : '';
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: systemQuestionPrompt + (streamingGuardrails ? `\n\n${streamingGuardrails}` : '') },
    ...(assistantHistory ? [{ role: 'assistant', content: assistantHistory }] as ChatMessage[] : [])
  ];

  return new Promise((resolve, reject) => {
    makeStreamingJSONRequest(messages, {
      onProgress: (partialContent) => {
        onProgress(partialContent);
      },
      onComplete: (result, usage) => {
        logger.info('📥 Received streaming question response');
        
        if (usage) {
          logger.info('Token usage for generateQuestion:', usage);
        }
        
        try {
          if (!result.question || !result.options || !Array.isArray(result.options)) {
            throw new Error('Invalid question format received from API');
          }
          
          const question: Question & { isExtremeEvent: boolean } = {
            id: `q_${Date.now()}`,
            question: result.question,
            options: result.options,
            isExtremeEvent: result.isExtremeEvent || false
          };
          
          resolve(question);
        } catch (error) {
          logger.error('❌ Error processing streaming question result:', error);
          reject(error);
        }
      },
      onError: (error) => {
        logger.error('❌ Error in streaming generateQuestion:', error);
        reject(error);
      }
    });
  });
};

const generateOutcomeAndNextQuestionStreaming = async (
  gameState: GameState,
  question: string,
  choice: string,
  onProgress: (partialContent: string) => void
): Promise<{
  outcome: string;
  nextQuestion?: Question & { isExtremeEvent: boolean };
  isEnding?: boolean;
}> => {
  logger.info(`🚀 Streaming function called: generateOutcomeAndNextQuestion(child.age=${gameState.child.age})`);
  
  const shouldGenerateNextQuestion = gameState.child.age < 17;
  
  const systemPrompt = generateSystemPrompt();
  const systemOutcomePrompt = generateOutcomeAndNextQuestionPrompt(
    gameState,
    question,
    choice,
    shouldGenerateNextQuestion,
    false,
    true
  );
  const assistantHistory = generateRecentHistoryContextI18n(gameState);
  const userChoiceLines = generateOutcomeUserLinesI18n(question, choice);
  const streamingGuardrails2 = (getEffectiveProviderKey() === 'gpt5') ? getGpt5UltraGuardrailsI18n() : '';
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: systemOutcomePrompt + (streamingGuardrails2 ? `\n\n${streamingGuardrails2}` : '') },
    ...(assistantHistory ? [{ role: 'assistant', content: assistantHistory }] as ChatMessage[] : []),
    { role: 'user', content: userChoiceLines }
  ];

  return new Promise((resolve, reject) => {
    makeStreamingJSONRequest(messages, {
      onProgress: (partialContent) => {
        onProgress(partialContent);
      },
      onComplete: (result, usage) => {
        logger.info('📥 Received streaming outcome and next question response');
        
        if (usage) {
          logger.info('Token usage for generateOutcomeAndNextQuestion:', usage);
        }
        
        try {
          const response: {
            outcome: string;
            nextQuestion?: Question & { isExtremeEvent: boolean };
            isEnding?: boolean;
          } = {
            outcome: result.outcome
          };
          
          if (result.nextQuestion && shouldGenerateNextQuestion) {
            response.nextQuestion = {
              id: `q_${Date.now()}`,
              question: result.nextQuestion.question,
              options: result.nextQuestion.options,
              isExtremeEvent: result.nextQuestion.isExtremeEvent || false
            };
          } else if (!shouldGenerateNextQuestion) {
            response.isEnding = true;
          }
          
          resolve(response);
        } catch (error) {
          logger.error('❌ Error processing streaming outcome result:', error);
          reject(error);
        }
      },
      onError: (error) => {
        logger.error('❌ Error in streaming generateOutcomeAndNextQuestion:', error);
        reject(error);
      }
    });
  });
};

const generateEndingStreaming = async (
  gameState: GameState,
  onProgress: (partialContent: string) => void
): Promise<string> => {
  logger.info("🚀 Streaming function called: generateEnding()");
  
  const systemPrompt2 = generateSystemPrompt();
  const systemEndingPrompt = generateEndingPrompt(gameState, false);
  const assistantHistory2 = generateEndingHistoryContextI18n(gameState);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt2 },
    { role: 'system', content: systemEndingPrompt },
    ...(assistantHistory2 ? [{ role: 'assistant', content: assistantHistory2 }] as ChatMessage[] : [])
  ];

  return new Promise((resolve, reject) => {
    makeStreamingJSONRequest(messages, {
      onProgress: (partialContent) => {
        onProgress(partialContent);
      },
      onComplete: (result, usage) => {
        logger.info('📥 Received streaming ending response');
        
        if (usage) {
          logger.info('Token usage for generateEnding:', usage);
        }
        
        try {
          const formattedEnding = formatEndingResult(result);
          resolve(formattedEnding);
        } catch (error) {
          logger.error('❌ Error processing streaming ending result:', error);
          reject(error);
        }
      },
      onError: (error) => {
        logger.error('❌ Error in streaming generateEnding:', error);
        reject(error);
      }
    });
  });
};

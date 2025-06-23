import { API_CONFIG } from '../config/api';
import type { Question, GameState } from '../types/game';
import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { makeStreamingJSONRequest } from './streamingService';
import {
  generateSystemPrompt as generateSystemPromptI18n,
  generateQuestionPrompt as generateQuestionPromptI18n,
  generateOutcomeAndNextQuestionPrompt as generateOutcomeAndNextQuestionPromptI18n,
  generateInitialStatePrompt as generateInitialStatePromptI18n,
  generateEndingPrompt as generateEndingPromptI18n,
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
  // Debug: Log client-side Volcano Engine env vars (development only)
  if (import.meta.env.DEV) {
    console.log('🔍 CLIENT ENV DEBUG - Volcano Engine Keys:');
    console.log('  VITE_VOLCENGINE_LLM_API_KEY:', import.meta.env.VITE_VOLCENGINE_LLM_API_KEY?.substring(0, 8) + '...' || 'MISSING');
    console.log('  VITE_VOLCENGINE_VISUAL_API_KEY:', import.meta.env.VITE_VOLCENGINE_VISUAL_API_KEY?.substring(0, 8) + '...' || 'MISSING');
  }

  const provider = API_CONFIG.ACTIVE_PROVIDER;
  
  // Helper to read provider keys from Vite env ─ only needed for DIRECT_API_MODE=true.
  const env = import.meta.env;

  const providers: Record<string, ModelProvider> = {
    openai: {
      name: 'openai',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: env.VITE_OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
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

  return providers[provider] || providers.volcengine;
};

export const switchProvider = (): ModelProvider => {
  const providers = ['openai', 'deepseek', 'volcengine'] as const;
  const currentIndex = providers.indexOf(API_CONFIG.ACTIVE_PROVIDER as any);
  const nextIndex = (currentIndex + 1) % providers.length;
  
  API_CONFIG.ACTIVE_PROVIDER = providers[nextIndex];
  logger.info(`🔄 Switched to ${API_CONFIG.ACTIVE_PROVIDER} model provider`);
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

// Shared prompt generation functions (now using i18n)
export const generateSystemPrompt = (): string => {
  return generateSystemPromptI18n();
};

export const generateQuestionPrompt = (gameState: GameState, includeDetailedRequirements: boolean = true): string => {
  return generateQuestionPromptI18n(gameState, includeDetailedRequirements);
};

export const generateOutcomeAndNextQuestionPrompt = (
  gameState: GameState,
  question: string,
  choice: string,
  shouldGenerateNextQuestion: boolean
): string => {
  return generateOutcomeAndNextQuestionPromptI18n(gameState, question, choice, shouldGenerateNextQuestion);
};

export const generateInitialStatePrompt = (specialRequirements?: string): string => {
  return generateInitialStatePromptI18n(specialRequirements);
};

export const generateEndingPrompt = (gameState: GameState): string => {
  return generateEndingPromptI18n(gameState);
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

// Helper function to make API requests with the active provider
const makeModelRequest = async (messages: ChatMessage[]): Promise<OpenAIResponse> => {
  const provider = getActiveProvider();
  logger.info(`📤 Sending API request to ${provider.name} provider using ${provider.model}`);
  
  performanceMonitor.startTiming(`API-${provider.name}-request`, 'api', {
    provider: provider.name,
    model: provider.model,
    messageCount: messages.length
  });
  
  const cleanedMessages = JSON.parse(JSON.stringify(messages));
  
  // Check if we should use direct API mode (for development)
  const useDirectAPI = API_CONFIG.DIRECT_API_MODE;
  
  if (useDirectAPI) {
    // Legacy direct API call (for development only)
    return makeDirectAPIRequest(messages, provider);
  }
  
  // Use serverless function
  try {
    const response = await fetch(API_CONFIG.SERVERLESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: cleanedMessages,
        provider: API_CONFIG.ACTIVE_PROVIDER,
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
  let requestBody: any = {
    model: provider.model,
    messages: messages,
    temperature: 0.7,
  };
  
  if (provider.name === 'deepseek') {
    requestBody = {
      ...requestBody,
      max_tokens: 2048,
      stream: false,
      top_p: 0.8,
      frequency_penalty: 0,
      presence_penalty: 0,
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
    gender: 'male' | 'female';
    age: number;
  };
  child: {
    name: string;
    gender: 'male' | 'female';
    age: number;
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
    const userPrompt = generateQuestionPrompt(gameState, true);
    
    // 🐛 COMPREHENSIVE LOGGING - FULL PROMPTS (development only)
    if (import.meta.env.DEV) {
      console.log('\n🔍 ===== GENERATE QUESTION DEBUG =====');
      console.log('🎯 SYSTEM PROMPT (FULL):');
      console.log(systemPrompt);
      console.log('\n📝 USER PROMPT (FULL):');
      console.log(userPrompt);
      console.log('\n📊 GAME STATE SENT TO LLM:');
      console.log(JSON.stringify(gameState, null, 2));
    }
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
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
    const userPrompt = generateOutcomeAndNextQuestionPrompt(gameState, question, choice, shouldGenerateNextQuestion);
    
    // 🐛 COMPREHENSIVE LOGGING - FULL PROMPTS (development only)
    if (import.meta.env.DEV) {
      console.log('\n🔍 ===== GENERATE OUTCOME DEBUG =====');
      console.log('🎯 SYSTEM PROMPT (FULL):');
      console.log(systemPrompt);
      console.log('\n📝 USER PROMPT (FULL):');
      console.log(userPrompt);
      console.log('\n📊 GAME STATE SENT TO LLM:');
      console.log(JSON.stringify(gameState, null, 2));
      console.log('\n🎯 SELECTED CHOICE:');
      console.log(`Question: ${question}`);
      console.log(`Choice: ${choice}`);
      console.log(`Should generate next question: ${shouldGenerateNextQuestion}`);
    }
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
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
      
      return response;
    } catch (error) {
      logger.error('❌ Error generating outcome and next question:', error);
      throw error;
    }
  });
};

const generateInitialStateSync = async (specialRequirements?: string): Promise<GameState> => {
  logger.info("🚀 Function called: generateInitialState()" + (specialRequirements ? " with special requirements" : ""));
  
  return performanceMonitor.timeAsync('generateInitialState-full', 'api', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: generateSystemPrompt() },
      { role: 'user', content: generateInitialStatePrompt(specialRequirements) }
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
    const messages: ChatMessage[] = [
      { role: 'system', content: generateSystemPrompt() },
      { role: 'user', content: generateEndingPrompt(gameState) }
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
      
      return formatEndingResult(result);
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
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateQuestionPrompt(gameState, false) }
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
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateOutcomeAndNextQuestionPrompt(gameState, question, choice, shouldGenerateNextQuestion) }
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
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateEndingPrompt(gameState) }
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

import { API_CONFIG } from '../config/api';
import type { Question, GameState } from '../types/game';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { makeStreamingJSONRequest } from './streamingService';

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
  
  switch (provider) {
    case 'openai':
      return {
        name: 'openai',
        apiUrl: API_CONFIG.OPENAI_API_URL,
        apiKey: API_CONFIG.OPENAI_API_KEY,
        model: API_CONFIG.OPENAI_MODEL,
      };
    case 'deepseek':
      return {
        name: 'deepseek',
        apiUrl: API_CONFIG.DEEPSEEK_API_URL,
        apiKey: API_CONFIG.DEEPSEEK_API_KEY,
        model: API_CONFIG.DEEPSEEK_MODEL,
      };
    case 'volcengine':
      return {
        name: 'volcengine',
        apiUrl: API_CONFIG.VOLCENGINE_API_URL,
        apiKey: API_CONFIG.VOLCENGINE_API_KEY,
        model: API_CONFIG.VOLCENGINE_MODEL,
      };
    default:
      return {
        name: 'volcengine',
        apiUrl: API_CONFIG.VOLCENGINE_API_URL,
        apiKey: API_CONFIG.VOLCENGINE_API_KEY,
        model: API_CONFIG.VOLCENGINE_MODEL,
      };
  }
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

// Shared prompt generation functions
export const generateSystemPrompt = (): string => {
  logger.info("📝 Generating system prompt");
  return `你是一个叙事游戏"养娃模拟器"，要模拟玩家把一个娃从婴儿出生时养到18岁的时候所需要做出的各种选择和体验故事，目的是让玩家身临其境的体会养娃的酸甜苦辣，有深刻的感情体验和跌宕起伏，在结尾时爱上自己的孩子，反思自己的选择，为自己深思。
  
  你生成的语言简短宜都、现实、充满细节、不说教。

  直接返回有效且干净的JSON对象，规则：
  - 不要使用markdown格式（不要使用\`\`\`json或任何其他格式包装）
  - 不要在文本中包含任何控制字符或特殊字符
  - 确保所有引号(")都被正确转译(\\\")
`;
};

export const generateQuestionPrompt = (gameState: GameState, includeDetailedRequirements: boolean = true): string => {
  logger.info(`📝 Generating question prompt for child age ${gameState.child.age + 1}`);
  
  let promptHeader = "";
  if (typeof gameState.financialBurden === 'number') {
    promptHeader = `$F${gameState.financialBurden}\n\n`;
    logger.info(`Prepending financial header: ${promptHeader.trim()}`);
  }

  const historyContext = gameState.history.length > 0 
    ? `\n历史选择：\n${gameState.history.map(h => 
        `${h.age}岁时：${h.question}\n选择：${h.choice}\n结果：${h.outcome}`
      ).join('\n\n')}`
    : '';

  const basePrompt = `${promptHeader}基于以下信息：
玩家：${gameState.player.gender === 'male' ? '父亲' : '母亲'}（${gameState.player.age}岁）
玩家背景：${gameState.playerDescription}
孩子：${gameState.child.name}（${gameState.child.gender === 'male' ? '男孩' : '女孩'}，${gameState.child.age}岁）
孩子背景：${gameState.childDescription}

${historyContext}

请生成一个${gameState.child.age + 1}岁时的育儿问题。问题应该：
1. 反映这个年龄段可能遇到的真实挑战${includeDetailedRequirements ? '，挑战与之前遇到的挑战要有明显不同。' : ''}
2. 提供4个选项，每个选项都有其利弊，不要有明显的"正确"答案${includeDetailedRequirements ? '。每个选项都应包含一个整数的 "cost" 属性。如果选项有财务成本，则该成本应为1到10之间的整数。如果选项没有财务成本，则使用0。不要使用负数成本。' : ''}
3. 与之前的选择和结果有连贯性${includeDetailedRequirements ? '，考虑孩子的性格发展轨迹和家庭状况的变化' : ''}${!includeDetailedRequirements ? '\n4. 如果适当，包含突发状况或艰难的选择' : ''}`;

  const formatSection = includeDetailedRequirements 
    ? `返回格式必须严格遵循以下JSON结构：

{
  "question": "问题描述",
  "options": [
    {"id": "A", "text": "选项A", "cost": 0},
    {"id": "B", "text": "选项B", "cost": 5},
    {"id": "C", "text": "选项C", "cost": 10},
    {"id": "D", "text": "选项D", "cost": 1}
  ],
  "isExtremeEvent": true/false
}`
    : `返回格式：
{
  "question": "问题描述",
  "options": [
    {"id": "A", "text": "选项A", "cost": 0},
    {"id": "B", "text": "选项B", "cost": 3},
    {"id": "C", "text": "选项C", "cost": 8},
    {"id": "D", "text": "选项D", "cost": 10}
  ],
  "isExtremeEvent": true/false
}`;

  return `${basePrompt}\n\n${formatSection}`;
};

export const generateOutcomeAndNextQuestionPrompt = (
  gameState: GameState,
  question: string,
  choice: string,
  shouldGenerateNextQuestion: boolean
): string => {
  logger.info(`📝 Generating outcome${shouldGenerateNextQuestion ? ' and next question' : ''} prompt for child age ${gameState.child.age}`);
  
  const financialHeader = typeof gameState.financialBurden === 'number' ? `$F${gameState.financialBurden}\n\n` : "";

  if (gameState.isBankrupt) {
    logger.info("🚨 Bankruptcy detected! Generating bankruptcy-specific prompt.");
    return `${financialHeader}⚠️ 你的财务状况非常糟糕，你决策的重担已经变得令人窒息。

根据你目前的情况（孩子：${gameState.child.name}，${gameState.child.age}岁）以及你的选择（针对问题"${question}"选择了"${choice}"），描述你财务崩溃直接带来的毁灭性后果。这个结果应该具有冲击力，并反映破产的严重性。

面对这次财务崩溃，为玩家提供一个重要的恢复机会。这个选择应该以"nextQuestion"的形式呈现，包含一个特殊的恢复选项，允许玩家通过艰难的努力重新振作起来。

将整个回应格式化为JSON对象，包含"outcome"和"nextQuestion"（其中包含一个成本为0、带有特殊isRecovery标记的恢复选项）：

{
  "outcome": "关于财务崩溃及其直接影响的详细描述...",
  "nextQuestion": {
    "question": "面对这样的财务崩溃，你决定采取什么行动？",
    "options": [
      {"id": "A", "text": "承认困境，努力工作并寻找重新振作的方法。", "cost": 0, "isRecovery": true}
    ],
    "isExtremeEvent": true
  }
}`;
  }

  const historyContext = gameState.history.length > 0 
    ? `\n历史选择：\n${gameState.history.map(h => 
        `${h.age}岁时：${h.question}\n选择：${h.choice}\n结果：${h.outcome}`
      ).join('\n\n')}`
    : '';

  let prompt = `${financialHeader}基于以下信息：
玩家：${gameState.player.gender === 'male' ? '父亲' : '母亲'}（${gameState.player.age}岁）
玩家背景：${gameState.playerDescription}
孩子：${gameState.child.name}（${gameState.child.gender === 'male' ? '男孩' : '女孩'}，${gameState.child.age}岁）
孩子背景：${gameState.childDescription}

${historyContext}

当前状况："${question}"
玩家选择了："${choice}"

请生成这个选择的结果，描述对孩子成长和家庭的影响。`;

  if (shouldGenerateNextQuestion) {
    prompt += `
然后，请生成一个${gameState.child.age + 1}岁时的育儿问题。

返回格式：
{
  "outcome": "对当前选择的详细结果描述...",
  "nextQuestion": {
    "question": "下一个问题描述",
    "options": [
      {"id": "A", "text": "选项A", "cost": 0},
      {"id": "B", "text": "选项B", "cost": 3},
      {"id": "C", "text": "选项C", "cost": 8},
      {"id": "D", "text": "选项D", "cost": 10}
    ],
    "isExtremeEvent": true/false
  }
}`;
  } else {
    prompt += `
返回格式：
{
  "outcome": "对当前选择的详细结果描述..."
}`;
  }

  return prompt;
};

export const generateInitialStatePrompt = (specialRequirements?: string): string => {
  logger.info("📝 Generating initial state prompt" + (specialRequirements ? " with special requirements" : ""));
  
  const basePrompt = `你是一个沉浸式的养娃游戏。要模拟玩家"你"把一个娃从婴儿出生时养到18岁的时候所需要做出的各种选择。目的是让玩家身临其境的体会养娃的酸甜苦辣，并在结尾时可以爱自己的孩子，反思自己的选择，为自己深思。
  
请为游戏生成初始设定，包括两部分内容：

1. 玩家"你"的信息：性别、年龄以及完整详细的你的背景，包括财富水平、社会地位、职业、家庭状况、伴侣关系等一切和养娃相关信息

2. 婴儿信息：性别、名字，以及完整详细的婴儿背景，包括性格特点、健康状况等一切和ta未来成长相关的信息`;

  const promptWithRequirements = specialRequirements 
    ? `${basePrompt}\n\n请根据以下特殊要求生成初始设定：\n${specialRequirements}` 
    : basePrompt;

  return `${promptWithRequirements}\n\n按以下格式直接返回，使用文字描述而不是JSON格式：

{
  "player": {
    "gender": "male/female",
    "age": 数字
  },
  "child": {
    "name": "名字",
    "gender": "male/female",
    "age": 0
  },
  "playerDescription": "完整详细的玩家背景描述...",
  "childDescription": "完整详细的婴儿背景描述..."
}
`;
};

export const generateEndingPrompt = (gameState: GameState): string => {
  logger.info("📝 Generating ending prompt");
  
  const historyContext = gameState.history.length > 0 
    ? `\n历史选择：\n${gameState.history.map(h => 
        `${h.age}岁时：${h.question}\n选择：${h.choice}\n结果：${h.outcome}`
      ).join('\n\n')}`
    : '';

  return `基于以下信息：
玩家：${gameState.player.gender === 'male' ? '父亲' : '母亲'}（${gameState.player.age}岁）
玩家背景：${gameState.playerDescription}
孩子：${gameState.child.name}（${gameState.child.gender === 'male' ? '男孩' : '女孩'}，现在18岁）
孩子背景：${gameState.childDescription}

${historyContext}

请生成游戏结局，描述孩子18岁时的状况、对玩家养育方式的评价，以及对未来的展望。

返回格式：
{
  "child_status_at_18": "孩子18岁时的详细状况描述...",
  "parent_evaluation": "对玩家养育方式的评价...",
  "future_outlook": "对孩子和家庭未来的展望..."
}`;
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
    // Clean JSON content of illegal control characters
    jsonContent = jsonContent
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .replace(/\\u0000|\\u0001|\\u0002|\\u0003|\\u0004|\\u0005|\\u0006|\\u0007|\\b|\\v|\\f|\\u000e|\\u000f/g, '')
      .replace(/\\u0010|\\u0011|\\u0012|\\u0013|\\u0014|\\u0015|\\u0016|\\u0017/g, '')
      .replace(/\\u0018|\\u0019|\\u001a|\\u001b|\\u001c|\\u001d|\\u001e|\\u001f/g, '')
      .replace(/\]\s*$/g, '}');
    
    logger.info("🧹 Cleaned JSON content for parsing");
    
    const parsed = JSON.parse(jsonContent);
    logger.info("✅ JSON parsed successfully:", JSON.stringify(parsed, null, 2).substring(0, 500) + (JSON.stringify(parsed, null, 2).length > 500 ? "..." : ""));
    return parsed;
  } catch (error) {
    logger.error('❌ JSON parsing error:', error);
    logger.error('Attempted to parse content:', jsonContent);
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
  
  let requestBody: any = {
    model: provider.model,
    messages: cleanedMessages,
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
  
  try {
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
      performanceMonitor.endTiming(`API-${provider.name}-request`);
      logger.error(`❌ API Error from ${provider.name}:`, response.status, responseText);
      throw new Error(`Failed API request to ${provider.name}: ${response.statusText || responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      performanceMonitor.endTiming(`API-${provider.name}-request`);
      logger.error(`Failed to parse response as JSON: ${responseText}`);
      throw new Error(`${provider.name} returned invalid JSON: ${e}`);
    }
    
    const duration = performanceMonitor.endTiming(`API-${provider.name}-request`);
    logger.info(`✅ Successful ${provider.name} response received in ${duration?.toFixed(2)}ms`);
    
    return data as OpenAIResponse;
  } catch (error) {
    performanceMonitor.endTiming(`API-${provider.name}-request`);
    logger.error(`❌ Exception in API call to ${provider.name}:`, error);
    throw error;
  }
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
    age: 0;
  };
  playerDescription: string;
  childDescription: string;
  wealthTier: 'poor' | 'middle' | 'wealthy';
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
        wealthTier: preloadedState.wealthTier,
        financialBurden: 0,
        isBankrupt: false,
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
    const messages: ChatMessage[] = [
      { role: 'system', content: generateSystemPrompt() },
      { role: 'user', content: generateQuestionPrompt(gameState, true) }
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for question');
      
      logTokenUsage('generateQuestion', data);
      
      const content = data.choices[0].message.content;
      logger.info('📄 API response content (question):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      const result = performanceMonitor.timeSync('safeJsonParse-question', 'local', () => {
        return safeJsonParse(content);
      });
      
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
    const messages: ChatMessage[] = [
      { role: 'system', content: generateSystemPrompt() },
      { role: 'user', content: generateOutcomeAndNextQuestionPrompt(gameState, question, choice, shouldGenerateNextQuestion) }
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for outcome and next question');
      
      logTokenUsage('generateOutcomeAndNextQuestion', data);
      
      const content = data.choices[0].message.content;
      logger.info('📄 API response content (outcome):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      const result = performanceMonitor.timeSync('safeJsonParse-outcome', 'local', () => {
        return safeJsonParse(content);
      });
      
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
      
      return `**孩子18岁时的状况：**\n${result.child_status_at_18}\n\n**对你养育方式的评价：**\n${result.parent_evaluation}\n\n**未来展望：**\n${result.future_outlook}`;
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
          const formattedEnding = `**孩子18岁时的状况：**\n${result.child_status_at_18}\n\n**对你养育方式的评价：**\n${result.parent_evaluation}\n\n**未来展望：**\n${result.future_outlook}`;
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
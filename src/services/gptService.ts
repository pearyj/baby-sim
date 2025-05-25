import { API_CONFIG } from '../config/api';
import type { Question, GameState } from '../types/game';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';

// Add interface for model provider and selection functionality
export interface ModelProvider {
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
}

// Get the currently active provider
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
      // Fallback to volcengine if invalid provider
      return {
        name: 'volcengine',
        apiUrl: API_CONFIG.VOLCENGINE_API_URL,
        apiKey: API_CONFIG.VOLCENGINE_API_KEY,
        model: API_CONFIG.VOLCENGINE_MODEL,
      };
  }
};

// Switch between providers
export const switchProvider = (): ModelProvider => {
  // Cycle through the three providers
  const providers = ['openai', 'deepseek', 'volcengine'] as const;
  const currentIndex = providers.indexOf(API_CONFIG.ACTIVE_PROVIDER as any);
  const nextIndex = (currentIndex + 1) % providers.length;
  
  API_CONFIG.ACTIVE_PROVIDER = providers[nextIndex];
  logger.info(`🔄 Switched to ${API_CONFIG.ACTIVE_PROVIDER} model provider`);
  return getActiveProvider();
};

// Get current model information
export const getCurrentModel = (): string => {
  const provider = getActiveProvider();
  return `${provider.name} - ${provider.model}`;
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 在文件顶部添加API响应类型定义
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
  // Add DeepSeek-specific fields if they differ
  id?: string;
  model?: string;
  created?: number;
}

// 添加Token使用统计接口
interface TokenUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  apiCalls: number;
  estimatedCost: number;
}

// 全局变量跟踪总token使用情况
let globalTokenUsage: TokenUsageStats = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  apiCalls: 0,
  estimatedCost: 0
};

// 添加一个方法来获取当前的token使用统计
export const getTokenUsageStats = (): TokenUsageStats => {
  return { ...globalTokenUsage };
};

// 添加一个方法来重置token使用统计
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

// Helper function to safely parse JSON from API responses
const safeJsonParse = (content: string): any => {
  logger.info("🔍 Parsing JSON response");
  
  // Remove any markdown code block markers if present
  let jsonContent = content
    .replace(/```(json)?/g, '') // Remove ```json or ``` markers
    .replace(/```/g, '')        // Remove closing ``` markers
    .trim();                     // Remove extra whitespace
  
  try {
    // 清理JSON中的非法控制字符
    // 这些字符在JSON中是非法的，但可能会出现在API返回中
    jsonContent = jsonContent
      // 移除ASCII控制字符 (0-31)，除了制表符(9)、换行(10)和回车(13)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      // 替换转义的控制字符
      .replace(/\\u0000|\\u0001|\\u0002|\\u0003|\\u0004|\\u0005|\\u0006|\\u0007|\\b|\\v|\\f|\\u000e|\\u000f/g, '')
      .replace(/\\u0010|\\u0011|\\u0012|\\u0013|\\u0014|\\u0015|\\u0016|\\u0017/g, '')
      .replace(/\\u0018|\\u0019|\\u001a|\\u001b|\\u001c|\\u001d|\\u001e|\\u001f/g, '')
      // 修复错误的 JSON 结尾 (将错误的结尾 ] 替换为 })
      .replace(/\]\s*$/g, '}');
    
    logger.info("🧹 Cleaned JSON content for parsing");
    
    const parsed = JSON.parse(jsonContent);
    logger.info("✅ JSON parsed successfully:", JSON.stringify(parsed, null, 2).substring(0, 500) + (JSON.stringify(parsed, null, 2).length > 500 ? "..." : ""));
    return parsed;
  } catch (error) {
    logger.error('❌ JSON parsing error:', error);
    logger.error('Attempted to parse content:', jsonContent);
    
    // 尝试使用更激进的方式清理JSON
    try {
      logger.info("🔄 Attempting more aggressive JSON cleaning...");
      
      // 移除所有非ASCII字符并替换可能导致问题的字符
      let aggressiveCleaned = jsonContent
        .replace(/[^\x20-\x7E]/g, '')  // 只保留基本的ASCII可打印字符
        .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, ''); // 处理无效的转义字符
      
      // 检查并修复 JSON 格式错误
      if (aggressiveCleaned.endsWith(']')) {
        aggressiveCleaned = aggressiveCleaned.slice(0, -1) + '}';
      }
      
      const fallbackParsed = JSON.parse(aggressiveCleaned);
      logger.info("✅ JSON parsed successfully with aggressive cleaning:", JSON.stringify(fallbackParsed, null, 2).substring(0, 500) + (JSON.stringify(fallbackParsed, null, 2).length > 500 ? "..." : ""));
      return fallbackParsed;
    } catch (fallbackError) {
      logger.error('❌ Even aggressive JSON cleaning failed:', fallbackError);
      
      // 最后尝试手动提取outcome和nextQuestion
      try {
        logger.info("🔄 Attempting manual extraction of JSON data...");
        
        // 尝试提取对象内容，修复 JSON 格式
        const objectContent = content.match(/\{([^]*)\}/);
        if (objectContent) {
          try {
            const fixedJson = '{' + objectContent[1] + '}';
            return JSON.parse(fixedJson);
          } catch (e) {
            logger.error('Failed to parse extracted object content:', e);
          }
        }
        
        // 提取关键字段
        const playerGender = jsonContent.match(/"gender"\s*:\s*"([^"]+)"/);
        const playerAge = jsonContent.match(/"age"\s*:\s*(\d+)/);
        const childName = jsonContent.match(/"name"\s*:\s*"([^"]+)"/);
        const childGender = jsonContent.match(/"gender"\s*:\s*"([^"]+)"/g);
        const playerDesc = jsonContent.match(/"playerDescription"\s*:\s*"([^"]+)"/);
        const childDesc = jsonContent.match(/"childDescription"\s*:\s*"([^"]+)"/);

        // 构建一个最小可用的对象
        const fallbackResult = {
          player: {
            gender: playerGender && playerGender.length > 1 ? playerGender[1] : "female",
            age: playerAge && playerAge.length > 1 ? parseInt(playerAge[1]) : 30
          },
          child: {
            name: childName && childName.length > 1 ? childName[1] : "未命名",
            gender: childGender && childGender.length > 1 ? 
              (childGender[1].includes("female") ? "female" : "male") : "male",
            age: 0
          },
          playerDescription: playerDesc && playerDesc.length > 1 ? 
            playerDesc[1] : "一位年轻的家长，正在努力抚养孩子成长。",
          childDescription: childDesc && childDesc.length > 1 ? 
            childDesc[1] : "一个健康的婴儿，刚刚出生。",
          history: []
        };
        
        logger.info("⚠️ Returning manually extracted fallback data for initial state");
        return fallbackResult;
      } catch (extractError) {
        logger.error('❌ Manual extraction failed:', extractError);
        // 返回最基本的默认数据
        return {
          player: { gender: "female", age: 30 },
          child: { name: "小明", gender: "male", age: 0 },
          playerDescription: "一位年轻的家长，正在努力抚养孩子成长。",
          childDescription: "一个健康的婴儿，刚刚出生。",
          history: []
        };
      }
    }
  }
};

// Helper function to make API requests with the active provider
const makeModelRequest = async (messages: ChatMessage[]): Promise<OpenAIResponse> => {
  const provider = getActiveProvider();
  logger.info(`📤 Sending API request to ${provider.name} provider using ${provider.model}`);
  
  // Start timing the API request
  performanceMonitor.startTiming(`API-${provider.name}-request`, 'api', {
    provider: provider.name,
    model: provider.model,
    messageCount: messages.length
  });
  
  // Deep clone messages to avoid reference issues
  const cleanedMessages = JSON.parse(JSON.stringify(messages));
  
  // Create the request body based on provider
  let requestBody: any = {
    model: provider.model,
    messages: cleanedMessages,
    temperature: 0.7,
  };
  
  // Add provider-specific parameters
  if (provider.name === 'deepseek') {
    // DeepSeek specific adjustments
    requestBody = {
      ...requestBody,
      max_tokens: 2048,     // Required parameter for DeepSeek
      stream: false,        // Ensure streaming is disabled
      top_p: 0.8,           // Add top_p parameter
      frequency_penalty: 0, // Add frequency_penalty
      presence_penalty: 0,  // Add presence_penalty
    };
    
    logger.info("Using DeepSeek-specific request format with model: " + provider.model);
  }
  
  try {
    logger.info(`Making request to ${provider.apiUrl}`);
    
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
      logger.error('Request that caused error:', JSON.stringify({
        url: provider.apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer [REDACTED]'
        },
        body: {
          ...requestBody,
          messages: requestBody.messages.map((m: any) => ({ 
            role: m.role, 
            content: m.content?.substring(0, 100) + (m.content?.length > 100 ? "..." : "") 
          }))
        }
      }, null, 2));
      throw new Error(`Failed API request to ${provider.name}: ${response.statusText || responseText}`);
    }

    // Parse the response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      performanceMonitor.endTiming(`API-${provider.name}-request`);
      logger.error(`Failed to parse response as JSON: ${responseText}`);
      throw new Error(`${provider.name} returned invalid JSON: ${e}`);
    }
    
    // End timing the API request
    const duration = performanceMonitor.endTiming(`API-${provider.name}-request`);
    logger.info(`✅ Successful ${provider.name} response received in ${duration?.toFixed(2)}ms`);
    
    // Handle DeepSeek response format differences if needed
    if (provider.name === 'deepseek') {
      // Ensure the response matches OpenAI format for our code
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        logger.log('Unexpected DeepSeek response format:', data);
        throw new Error(`Unexpected ${provider.name} response format`);
      }
    }
    
    return data as OpenAIResponse;
  } catch (error) {
    performanceMonitor.endTiming(`API-${provider.name}-request`);
    logger.error(`❌ Exception in API call to ${provider.name}:`, error);
    if (error instanceof Error) {
      logger.error('Error stack:', error.stack);
    }
    throw error;
  }
};

const generateSystemPrompt = (): string => {
  logger.info("📝 Generating system prompt");
  return `你是一个叙事游戏"养娃模拟器"，要模拟玩家把一个娃从婴儿出生时养到18岁的时候所需要做出的各种选择和体验故事，目的是让玩家身临其境的体会养娃的酸甜苦辣，有深刻的感情体验和跌宕起伏，在结尾时爱上自己的孩子，反思自己的选择，为自己深思。
  
  你生成的语言简短宜都、现实、充满细节、不说教。

  直接返回有效且干净的JSON对象，规则：
  - 不要使用markdown格式（不要使用\`\`\`json或任何其他格式包装）
  - 不要在文本中包含任何控制字符或特殊字符
  - 确保所有引号(")都被正确转译(\\\")
`;
};

// Define the structure for the initial state
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

// Update the options type for generateInitialState
interface GenerateInitialStateOptions {
  specialRequirements?: string;
  preloadedState?: InitialStateType;
}

export const generateInitialState = async (options?: GenerateInitialStateOptions): Promise<GameState> => {
  const specialRequirements = options?.specialRequirements;
  const preloadedState = options?.preloadedState;

  logger.info("🚀 Function called: generateInitialState()" + 
    (specialRequirements ? " with special requirements" : "") +
    (preloadedState ? " with preloaded state" : "")
  );

  if (preloadedState) {
    return performanceMonitor.timeSync('generateInitialState-preloaded', 'local', () => {
      logger.info("🔄 Using preloaded initial state:", preloadedState);
      // Ensure the preloaded state is returned as a GameState
      return {
        ...preloadedState,
        history: [], // Add empty history
        currentQuestion: null, // Add null currentQuestion
        feedbackText: null, // Add null feedbackText
        endingSummaryText: null, // Add null endingSummaryText
        // Ensure wealthTier is present, defaulting if necessary (it's required on InitialStateType now)
        wealthTier: preloadedState.wealthTier, 
        financialBurden: 0, // Add default financialBurden for type compatibility
        isBankrupt: false, // Add default isBankrupt for type compatibility
      } as GameState;
    });
  }
  
  return performanceMonitor.timeAsync('generateInitialState-full', 'api', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: generateSystemPrompt() },
      { role: 'user', content: generateInitialStatePrompt(specialRequirements) }
    ];

    try {
      const data = await makeModelRequest(messages);
      logger.info('📥 Received API response for initial state');
      
      // 记录token使用情况
      logTokenUsage('generateInitialState', data);
      
      const content = data.choices[0].message.content;
      logger.info('📄 API response content (initial state):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
      
      // Use safe JSON parser with timing
      return performanceMonitor.timeSync('safeJsonParse-initialState', 'local', () => {
        return safeJsonParse(content);
      });
    } catch (error) {
      logger.error('❌ Error generating initial state:', error);
      throw error;
    }
  });
};

const generateInitialStatePrompt = (specialRequirements?: string): string => {
  logger.info("📝 Generating initial state prompt" + (specialRequirements ? " with special requirements" : ""));
  
  const basePrompt = `你是一个沉浸式的养娃游戏。要模拟玩家"你"把一个娃从婴儿出生时养到18岁的时候所需要做出的各种选择。目的是让玩家身临其境的体会养娃的酸甜苦辣，并在结尾时可以爱自己的孩子，反思自己的选择，为自己深思。
  
请为游戏生成初始设定，包括两部分内容：

1. 玩家"你"的信息：性别、年龄以及完整详细的你的背景，包括财富水平、社会地位、职业、家庭状况、伴侣关系等一切和养娃相关信息

2. 婴儿信息：性别、名字，以及完整详细的婴儿背景，包括性格特点、健康状况等一切和ta未来成长相关的信息`;

  // Add special requirements if provided
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

const generateQuestionPrompt = (gameState: GameState): string => {
  logger.info(`📝 Generating question prompt for child age ${gameState.child.age + 1}`);
  
  let promptHeader = "";
  // Always prepend financial header if financialBurden is available and is a number.
  if (typeof gameState.financialBurden === 'number') {
    promptHeader = `$F${gameState.financialBurden}\n\n`; // e.g., $F-10 or $F0 or $F50
    logger.info(`Prepending financial header: ${promptHeader.trim()}`);
  }

  const historyContext = gameState.history.length > 0 
    ? `\n历史选择：\n${gameState.history.map(h => 
        `${h.age}岁时：${h.question}\n选择：${h.choice}\n结果：${h.outcome}`
      ).join('\n\n')}`
    : '';

  return `${promptHeader}基于以下信息：
玩家：${gameState.player.gender === 'male' ? '父亲' : '母亲'}（${gameState.player.age}岁）
玩家背景：${gameState.playerDescription}
孩子：${gameState.child.name}（${gameState.child.gender === 'male' ? '男孩' : '女孩'}，${gameState.child.age}岁）
孩子背景：${gameState.childDescription}

${historyContext}

请生成一个${gameState.child.age + 1}岁时的育儿问题。问题应该：
1. 反映这个年龄段可能遇到的真实挑战，挑战与之前遇到的挑战要有明显不同。
2. 提供4个选项，每个选项都有其利弊，不要有明显的"正确"答案。每个选项都应包含一个整数的 "cost" 属性。如果选项有财务成本，则该成本应为1到10之间的整数。如果选项没有财务成本，则使用0。不要使用负数成本。
3. 与之前的选择和结果有连贯性，考虑孩子的性格发展轨迹和家庭状况的变化

返回格式必须严格遵循以下JSON结构：

{
  "question": "问题描述",
  "options": [
    {"id": "A", "text": "选项A", "cost": 0},
    {"id": "B", "text": "选项B", "cost": 5},
    {"id": "C", "text": "选项C", "cost": 10},
    {"id": "D", "text": "选项D", "cost": 1}
  ],
  "isExtremeEvent": true/false
}`;
};

const generateOutcomeAndNextQuestionPrompt = (
  gameState: GameState,
  question: string,
  choice: string,
  shouldGenerateNextQuestion: boolean
): string => {
  logger.info(`📝 Generating outcome${shouldGenerateNextQuestion ? ' and next question' : ''} prompt for child age ${gameState.child.age}. IsBankrupt: ${gameState.isBankrupt}. Financial Burden: ${gameState.financialBurden}`);
  
  const financialHeader = typeof gameState.financialBurden === 'number' ? `$F${gameState.financialBurden}\n\n` : "";

  if (gameState.isBankrupt) {
    logger.info("🚨 Bankruptcy detected! Generating bankruptcy-specific prompt.");
    // For bankruptcy, we generate a specific outcome and a very specific type of "next question" related to the dire situation.
    return `${financialHeader}⚠️ 你的财务状况非常糟糕，你决策的重担已经变得令人窒息。

根据你目前的情况（孩子：${gameState.child.name}，${gameState.child.age}岁）以及你的选择（针对问题"${question}"选择了"${choice}"），描述你财务崩溃直接带来的毁灭性后果。这个结果应该具有冲击力，并反映破产的严重性。

面对这次财务崩溃，为玩家提供一个唯一的、严峻的选择。这个选择应该以"nextQuestion"的形式呈现，包含一个单一选项，代表着一条艰难的前进道路或一个清算的时刻。

将整个回应格式化为JSON对象，包含"outcome"和"nextQuestion"（其中包含一个成本为0的单一选项）：

{
  "outcome": "关于财务崩溃及其直接影响的详细描述...",
  "nextQuestion": {
    "question": "面对这样的财务崩溃，你该怎么办？",
    "options": [
      {"id": "A", "text": "承认困境，努力寻找重新振作的方法。", "cost": 0}
    ],
    "isExtremeEvent": true
  }
}`;
  }

  // Original prompt logic if not bankrupt
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

当前状况：
"${question}"

玩家选择了：
"${choice}"

请作为故事的继续，考虑到现在孩子的岁数性格状况和家庭情况，生成故事的下文描述这个选择对孩子成长和小家庭的影响与后果。反馈应该与之前的选择和结果保持连贯性。分段以保持易读性。包括细节。
`;

  // 仅当需要生成下一问题时添加相关指令和格式
  if (shouldGenerateNextQuestion) {
    prompt += `
然后，请直接生成一个${gameState.child.age + 1}岁时的育儿问题。问题应该：
1. 反映这个年龄段可能遇到的真实挑战，挑战与之前遇到的挑战要有明显不同。
2. 提供4个选项，每个选项都有其利弊，不要有明显的"正确"答案。每个选项都应包含一个整数的 "cost" 属性。如果选项有财务成本，则该成本应为1到10之间的整数（含1和10）。如果选项没有财务成本，则使用0。不要使用负数成本。
3. 与之前的选择和结果有连贯性，考虑孩子的性格发展轨迹和家庭状况的变化
4. 如果这是故事的开头或中间，增加一个突发状况和很艰难的选择。

- 返回格式必须严格遵循以下JSON结构：
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
    // 如果不生成下一问题，只返回结果
    prompt += `
- 返回格式必须严格遵循以下JSON结构：
{
  "outcome": "对当前选择的详细结果描述..."
}`;
  }

  return prompt;
};

const generateEndingPrompt = (gameState: GameState): string => {
  logger.info("📝 Generating ending prompt for 18 year-old child");
  
  const historyContext = gameState.history.length > 0 
    ? `\n成长历程：\n${gameState.history.map(h => 
        `${h.age}岁时：${h.question}\n选择：${h.choice}\n结果：${h.outcome}`
      ).join('\n\n')}`
    : '';

  return `基于以下信息：
玩家背景：${gameState.playerDescription}
孩子：${gameState.child.name}（${gameState.child.gender === 'male' ? '男孩' : '女孩'}，18岁）
孩子背景：${gameState.childDescription}

${historyContext}

请针对玩家"你"，生成一个深刻又感人的结局总结。总结应包含以下几个方面：
1. 18岁时孩子的状况（性格、能力、成就、与你的关系等详细描述）。
2. 对玩家"你"作为父母的整体表现的评价与反思。
3. 对孩子未来的展望和寄语。

返回格式必须严格遵循以下JSON结构，不要添加任何markdown或其他包裹：
{
  "child_status_at_18": "关于孩子18岁状况的详细描述...",
  "parent_evaluation": "对玩家作为父母的评价与反思...",
  "future_outlook": "对孩子未来的展望和寄语...",
}`;
};

// 添加一个辅助函数来记录token使用情况
const logTokenUsage = (functionName: string, data: OpenAIResponse): void => {
  if (data.usage) {
    // 更新全局统计
    globalTokenUsage.promptTokens += data.usage.prompt_tokens;
    globalTokenUsage.completionTokens += data.usage.completion_tokens;
    globalTokenUsage.totalTokens += data.usage.total_tokens;
    globalTokenUsage.apiCalls += 1;
    
    // 计算估计成本（按照GPT-4的价格）
    const callCost = (data.usage.prompt_tokens * 0.0000010) + (data.usage.completion_tokens * 0.0000020);
    globalTokenUsage.estimatedCost += callCost;
    
    // 单次调用的日志
    logger.info(`📊 Token usage for ${functionName}:`);
    logger.info(`   Prompt tokens: ${data.usage.prompt_tokens}`);
    logger.info(`   Completion tokens: ${data.usage.completion_tokens}`);
    logger.info(`   Total tokens: ${data.usage.total_tokens}`);
    logger.info(`   Call cost: $${callCost.toFixed(6)} USD`);
    
    // 累计使用的日志
    logger.info(`📈 Cumulative token usage:`);
    logger.info(`   Total API calls: ${globalTokenUsage.apiCalls}`);
    logger.info(`   Total prompt tokens: ${globalTokenUsage.promptTokens}`);
    logger.info(`   Total completion tokens: ${globalTokenUsage.completionTokens}`);
    logger.info(`   Total tokens: ${globalTokenUsage.totalTokens}`);
    logger.info(`   Total cost: $${globalTokenUsage.estimatedCost.toFixed(6)} USD`);
  } else {
    logger.info(`⚠️ No token usage information available for ${functionName}`);
  }
};

// Improved error handling function - unused but kept for reference
/* 
const handleApiError = (error: any, functionName: string): never => {
  logger.error(`❌ ${functionName} error:`, error);
  
  // Extract useful information from different error types
  let errorMessage = "Unknown error";
  if (error instanceof Error) {
    errorMessage = error.message;
    logger.error('Error details:', error.stack);
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorMessage = JSON.stringify(error);
  }
  
  // Additional logging for network errors
  if (error.response) {
    logger.error('Response error status:', error.response.status);
    logger.error('Response data:', error.response.data);
  }
  
  throw new Error(`${functionName} failed: ${errorMessage}`);
};
*/

export const generateQuestion = async (gameState: GameState): Promise<Question & { isExtremeEvent: boolean }> => {
  logger.info(`🚀 Function called: generateQuestion(child.age=${gameState.child.age})`);
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateQuestionPrompt(gameState) }
  ];

  try {
    logger.info("📤 Sending API request for question generation");
    
    const data = await makeModelRequest(messages);
    logger.info('📥 Received API response for question generation');
    
    // 记录token使用情况
    logTokenUsage('generateQuestion', data);
    
    let content = data.choices[0].message.content;
    logger.info('📄 API response content (raw):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
    
    // 预处理API返回的内容，移除可能引起问题的字符
    logger.info('🧹 Pre-cleaning API response before JSON parsing');
    content = content
      // 移除所有控制字符，除了允许的换行、回车和制表符
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      // 替换非标准引号为标准引号
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // 移除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 移除Unicode控制字符
      .replace(/[\u2028\u2029]/g, '')
      // 修复损坏的转义序列
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
      
    logger.info('📄 Pre-cleaned content:', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
    
    // 解析API返回的JSON
    return safeJsonParse(content);
  } catch (error) {
    logger.error('❌ Error generating question:', error);
    
    // 出错时返回一个默认问题
    return {
      question: `${gameState.child.age + 1}岁了，你的孩子遇到了一个挑战（API错误恢复模式）`,
      options: [
        { id: "A", text: "选择方案A", cost: 0 },
        { id: "B", text: "选择方案B", cost: 0 },
        { id: "C", text: "选择方案C", cost: 0 },
        { id: "D", text: "选择方案D", cost: 0 }
      ],
      isExtremeEvent: false
    };
  }
};

export const generateOutcomeAndNextQuestion = async (
  gameState: GameState,
  question: string,
  choice: string
): Promise<{
  outcome: string;
  nextQuestion?: Question & { isExtremeEvent: boolean };
  isEnding?: boolean;
}> => {
  logger.info(`🚀 Function called: generateOutcomeAndNextQuestion(child.age=${gameState.child.age}, choice="${choice.substring(0, 20)}...")`);
  
  // 在程序中判断是否需要生成下一个问题
  // 如果当前年龄是17岁，则不生成下一个问题
  const shouldGenerateNextQuestion = gameState.child.age < 17;
  logger.info(`📌 Logic check: shouldGenerateNextQuestion=${shouldGenerateNextQuestion} (based on child.age=${gameState.child.age})`);
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateOutcomeAndNextQuestionPrompt(gameState, question, choice, shouldGenerateNextQuestion) }
  ];

  try {
    logger.info("📤 Sending API request for outcome" + (shouldGenerateNextQuestion ? " and next question" : ""));
    
    const data = await makeModelRequest(messages);
    logger.info('📥 Received API response for outcome' + (shouldGenerateNextQuestion ? " and next question" : ""));
    
    // 记录token使用情况
    logTokenUsage('generateOutcomeAndNextQuestion', data);
    
    let content = data.choices[0].message.content;
    logger.info('📄 API response content (raw):', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
    
    // 预处理API返回的内容，移除可能引起问题的字符
    logger.info('🧹 Pre-cleaning API response before JSON parsing');
    content = content
      // 移除所有控制字符，除了允许的换行、回车和制表符
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      // 替换非标准引号为标准引号
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // 移除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 移除Unicode控制字符
      .replace(/[\u2028\u2029]/g, '')
      // 修复损坏的转义序列
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
      
    logger.info('📄 Pre-cleaned content:', content.substring(0, 300) + (content.length > 300 ? "..." : ""));
    
    // 解析API返回的JSON
    const result = safeJsonParse(content);
    
    // 在程序中添加结局标记
    // 如果当前年龄是17岁，则标记为结局
    const isEnding = gameState.child.age >= 17;
    logger.info(`📌 Logic check: isEnding=${isEnding} (based on child.age=${gameState.child.age})`);
    
    return {
      outcome: result.outcome,
      nextQuestion: result.nextQuestion,
      isEnding: isEnding
    };
  } catch (error) {
    logger.error('❌ Error generating outcome and next question:', error);
    
    // 出错时返回一个友好的错误提示作为outcome
    return {
      outcome: `很抱歉，在处理您的选择时遇到了技术问题。这不会影响游戏的进度，您可以尝试重新选择或继续游戏。错误详情：${(error as Error).message}`,
      isEnding: gameState.child.age >= 17
    };
  }
};

export const generateEnding = async (gameState: GameState): Promise<string> => {
  logger.info(`🚀 Function called: generateEnding(child.age=${gameState.child.age})`);
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateEndingPrompt(gameState) }
  ];

  try {
    logger.info("📤 Sending API request for ending generation");
    
    const data = await makeModelRequest(messages);
    logger.info('📥 Received API response for ending generation');
    
    logTokenUsage('generateEnding', data);
    
    let content = data.choices[0].message.content;
    logger.info('📄 API response content (raw ending):', content.substring(0, 500) + (content.length > 500 ? "..." : ""));
    
    // Pre-cleaning API response, similar to other handlers
    logger.info('🧹 Pre-cleaning API response for ending before JSON parsing');
    content = content
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'")   // Normalize single quotes
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/[\u2028\u2029]/g, '') // Remove line/paragraph separators
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\'); // Fix bad escapes
    logger.info('📄 Pre-cleaned ending content:', content.substring(0, 500) + (content.length > 500 ? "..." : ""));

    const parsedEnding = safeJsonParse(content);

    interface EndingFormat {
      child_status_at_18: string;
      parent_evaluation: string;
      future_outlook: string;
    }

    if (parsedEnding && 
        typeof parsedEnding.child_status_at_18 === 'string' &&
        typeof parsedEnding.parent_evaluation === 'string' &&
        typeof parsedEnding.future_outlook === 'string') {
      const typedEnding = parsedEnding as EndingFormat;
      
      const formattedEnding = `
## 最终章：当 ${gameState.child.name} 长大成人

**十八岁的 ${gameState.child.name}：**
${typedEnding.child_status_at_18.replace(/\n/g, '\n\n')}

---

**为人父母的你：**
${typedEnding.parent_evaluation.replace(/\n/g, '\n\n')}

---

**未来的序曲：**
${typedEnding.future_outlook.replace(/\n/g, '\n\n')}

感谢你的养育，这段旅程就此告一段落。
`;
      logger.info('🎨 Formatted ending string generated.');
      return formattedEnding.trim();
    } else {
      logger.warn('⚠️ Ending JSON was not in the expected format or parsing failed. Attempting fallback rendering.');
      if (typeof parsedEnding === 'string') {
        return parsedEnding; // Return as is if it's just a string
      }
      // Attempt to construct a fallback from any available text fields
      let fallbackText = "";
      if (parsedEnding) {
        if (parsedEnding.child_status_at_18) fallbackText += "**孩子状况：**\n" + parsedEnding.child_status_at_18 + "\n\n";
        if (parsedEnding.parent_evaluation) fallbackText += "**父母评价：**\n" + parsedEnding.parent_evaluation + "\n\n";
        if (parsedEnding.future_outlook) fallbackText += "**未来展望：**\n" + parsedEnding.future_outlook + "\n\n";
        
        // Handle any other possible fields that might be returned
        if (parsedEnding.summary) fallbackText += parsedEnding.summary + "\n\n";
        if (parsedEnding.text) fallbackText += parsedEnding.text + "\n\n";
        if (parsedEnding.ending) fallbackText += parsedEnding.ending + "\n\n";
      }
      if (fallbackText.trim() !== "") {
        return `## 游戏结局\n\n${fallbackText.trim()}\n\n感谢您的游玩！结局内容可能未完全按预期格式展示。`;
      }
      // Final fallback if all else fails
      return content || `游戏结束，感谢您的游玩，${gameState.child.name}的故事已圆满落幕！(结局文本处理异常)`;
    }
  } catch (error) {
    logger.error('❌ Error generating or processing ending:', error);
    return `## 游戏结局\n\n养育 ${gameState.child.name} 的旅程已经结束。但在生成最终的结局篇章时，我们遇到了一些预料之外的小插曲。\n\n感谢您全程的投入与爱。\n\n(技术备注: ${(error instanceof Error ? error.message : String(error))})`;
  }
}; 
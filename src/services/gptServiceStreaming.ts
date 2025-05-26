import { makeStreamingJSONRequest } from './streamingService';
import { logger } from '../utils/logger';
import type { Question, GameState } from '../types/game';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Import prompt generators from the original service
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

const generateQuestionPrompt = (gameState: GameState): string => {
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

  return `${promptHeader}基于以下信息：
玩家：${gameState.player.gender === 'male' ? '父亲' : '母亲'}（${gameState.player.age}岁）
玩家背景：${gameState.playerDescription}
孩子：${gameState.child.name}（${gameState.child.gender === 'male' ? '男孩' : '女孩'}，${gameState.child.age}岁）
孩子背景：${gameState.childDescription}

${historyContext}

请生成一个${gameState.child.age + 1}岁时的育儿问题。问题应该：
1. 反映这个年龄段可能遇到的真实挑战
2. 提供4个选项，每个选项都有其利弊，不要有明显的"正确"答案
3. 与之前的选择和结果有连贯性
4. 如果适当，包含突发状况或艰难的选择

返回格式：
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
};

const generateOutcomeAndNextQuestionPrompt = (
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

// Streaming version of generateQuestion
export const generateQuestionStreaming = async (
  gameState: GameState,
  onProgress: (partialContent: string) => void
): Promise<Question & { isExtremeEvent: boolean }> => {
  logger.info(`🚀 Streaming function called: generateQuestion(child.age=${gameState.child.age})`);
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateQuestionPrompt(gameState) }
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
          // Validate the result structure
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

// Streaming version of generateOutcomeAndNextQuestion
export const generateOutcomeAndNextQuestionStreaming = async (
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
  logger.info(`📌 Logic check: shouldGenerateNextQuestion=${shouldGenerateNextQuestion}`);
  
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
        logger.info('📥 Received streaming outcome response');
        
        if (usage) {
          logger.info('Token usage for generateOutcomeAndNextQuestion:', usage);
        }
        
        try {
          const isEnding = gameState.child.age >= 17;
          logger.info(`📌 Logic check: isEnding=${isEnding}`);
          
          let nextQuestion = undefined;
          if (result.nextQuestion) {
            nextQuestion = {
              id: `q_${Date.now()}`,
              question: result.nextQuestion.question,
              options: result.nextQuestion.options,
              isExtremeEvent: result.nextQuestion.isExtremeEvent || false
            };
          }
          
          resolve({
            outcome: result.outcome,
            nextQuestion,
            isEnding
          });
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

// Streaming version for initial state generation
export const generateInitialStateStreaming = async (
  specialRequirements?: string,
  onProgress?: (partialContent: string) => void
): Promise<any> => {
  logger.info("🚀 Streaming function called: generateInitialState()");
  
  const generateInitialStatePrompt = (specialRequirements?: string): string => {
    const basePrompt = `你是一个沉浸式的养娃游戏。要模拟玩家"你"把一个娃从婴儿出生时养到18岁的时候所需要做出的各种选择。

请为游戏生成初始设定，包括：
1. 玩家"你"的信息：性别、年龄、背景、财富水平等
2. 新生儿的信息：姓名、性别、描述

${specialRequirements ? `特殊要求：${specialRequirements}` : ''}

返回格式：
{
  "player": {
    "gender": "male/female",
    "age": 数字
  },
  "child": {
    "name": "姓名",
    "gender": "male/female",
    "age": 0
  },
  "playerDescription": "详细背景描述",
  "childDescription": "新生儿描述",
  "wealthTier": "poor/middle/wealthy"
}`;
    
    return basePrompt;
  };
  
  const messages: ChatMessage[] = [
    { role: 'system', content: generateSystemPrompt() },
    { role: 'user', content: generateInitialStatePrompt(specialRequirements) }
  ];

  return new Promise((resolve, reject) => {
    makeStreamingJSONRequest(messages, {
      onProgress: (partialContent) => {
        if (onProgress) {
          onProgress(partialContent);
        }
      },
      onComplete: (result, usage) => {
        logger.info('📥 Received streaming initial state response');
        
        if (usage) {
          logger.info('Token usage for generateInitialState:', usage);
        }
        
        resolve(result);
      },
      onError: (error) => {
        logger.error('❌ Error in streaming generateInitialState:', error);
        reject(error);
      }
    });
  });
}; 
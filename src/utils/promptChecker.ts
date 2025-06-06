import promptService from '../services/promptService';
import logger from './logger';

/**
 * Check for missing prompts in all languages
 */
export const checkAllPrompts = (): void => {
  logger.info('🔍 Checking for missing prompts...');
  
  // Check English prompts against Chinese
  const missingInEnglish = promptService.checkMissingPrompts('en');
  if (missingInEnglish.length > 0) {
    logger.warn('❌ Missing prompts in English:', missingInEnglish);
  } else {
    logger.info('✅ All prompts present in English');
  }
  
  // Check Chinese prompts against English
  const missingInChinese = promptService.checkMissingPrompts('zh');
  if (missingInChinese.length > 0) {
    logger.warn('❌ Missing prompts in Chinese:', missingInChinese);
  } else {
    logger.info('✅ All prompts present in Chinese');
  }
  
  // Log current language
  const currentLang = promptService.getCurrentLanguage();
  logger.info(`🌐 Current language: ${currentLang}`);
};

/**
 * Test prompt generation with sample data
 */
export const testPromptGeneration = (): void => {
  logger.info('🧪 Testing prompt generation...');
  
  // Sample game state for testing
  const sampleGameState = {
    player: {
      gender: 'female' as const,
      age: 32,
    },
    child: {
      name: '小雨',
      gender: 'female' as const,
      age: 3,
    },
    playerDescription: '你是一名中学语文老师，温柔耐心，注重孩子的人文素养培养。',
    childDescription: '小雨是一个聪明好学的女孩，喜欢阅读和绘画。',
    finance: 5,
    marital: 6,
    isSingleParent: false,
    history: [
      {
        age: 1,
        question: '孩子总是哭闹，你会怎么办？',
        choice: '耐心安抚并寻找原因',
        outcome: '通过你的耐心，孩子逐渐安静下来，你们的关系更加亲密。'
      }
    ],
    currentQuestion: null,
    feedbackText: '这是一个样本反馈。',
    endingSummaryText: '这是样本结局。',
  };
  
  try {
    // Test system prompt
    const systemPrompt = promptService.generateSystemPrompt();
    logger.info('✅ System prompt generated successfully');
    logger.info('📝 System prompt preview:', systemPrompt.substring(0, 100) + '...');
    
    // Test question prompt
    const questionPrompt = promptService.generateQuestionPrompt(sampleGameState, true);
    logger.info('✅ Question prompt generated successfully');
    logger.info('📝 Question prompt preview:', questionPrompt.substring(0, 100) + '...');
    
    // Test outcome prompt
    const outcomePrompt = promptService.generateOutcomeAndNextQuestionPrompt(
      sampleGameState,
      'Should you enroll Emma in swimming lessons?',
      'Yes, enroll her in swimming lessons',
      true
    );
    logger.info('✅ Outcome prompt generated successfully');
    logger.info('📝 Outcome prompt preview:', outcomePrompt.substring(0, 100) + '...');
    
    // Test initial state prompt
    const initialPrompt = promptService.generateInitialStatePrompt('I want a creative child');
    logger.info('✅ Initial state prompt generated successfully');
    logger.info('📝 Initial state prompt preview:', initialPrompt.substring(0, 100) + '...');
    
    // Test ending prompt
    const endingPrompt = promptService.generateEndingPrompt({
      ...sampleGameState,
      child: { ...sampleGameState.child, age: 18 }
    });
    logger.info('✅ Ending prompt generated successfully');
    logger.info('📝 Ending prompt preview:', endingPrompt.substring(0, 100) + '...');
    
    // Test ending formatting
    const sampleEndingResult = {
      child_status_at_18: 'Emma has grown into a confident young woman...',
      parent_evaluation: 'You have been a supportive and caring parent...',
      future_outlook: 'Emma is ready to take on the world...'
    };
    const formattedEnding = promptService.formatEndingResult(sampleEndingResult);
    logger.info('✅ Ending formatting successful');
    logger.info('📝 Formatted ending preview:', formattedEnding.substring(0, 100) + '...');
    
  } catch (error) {
    logger.error('❌ Error testing prompt generation:', error);
  }
};

export default {
  checkAllPrompts,
  testPromptGeneration
}; 
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
      age: 30,
    },
    child: {
      name: 'Emma',
      gender: 'female' as const,
      age: 5,
      haircolor: 'brown',
      race: 'asian'
    },
    playerDescription: 'A caring mother who works as a teacher',
    childDescription: 'A curious and energetic 5-year-old girl',
    finance: 7,
    marital: 8,
    isSingleParent: false,
    history: [
      {
        age: 3,
        question: 'Should you enroll Emma in preschool?',
        choice: 'Yes, enroll her in a local preschool',
        outcome: 'Emma adapted well to preschool and made new friends.',
        finance: 6,
        marital: 8
      }
    ],
    currentQuestion: null,
    feedbackText: '',
    endingSummaryText: '',
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
      true,
      true,
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
      child: { 
        age: 18, 
        name: 'Emma', 
        gender: 'female' as const,
        haircolor: 'brown',
        race: 'asian'
      }
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
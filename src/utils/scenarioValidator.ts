import { logger } from './logger';

function validateScenarios(scenarios: any[]): boolean {
  logger.info('Validating scenarios...');
  
  if (!Array.isArray(scenarios)) {
    logger.error('Error: scenarios is not an array. Check pregenerated_states.json format.');
    return false;
  }
  
  const validWealthTiers = ['poor', 'middle', 'wealthy'];
  let allValid = true;
  
  for (let index = 0; index < scenarios.length; index++) {
    const scenario = scenarios[index];
    if (!validWealthTiers.includes(scenario.wealthTier)) {
      logger.error(`Error in scenario at index ${index}: Invalid wealthTier: "${scenario.wealthTier}"`);
      allValid = false;
    }
  }
  
  if (allValid) {
    logger.info('All scenarios have a valid wealthTier.');
  } else {
    logger.error('Some scenarios have invalid wealthTier values.');
  }
  
  return allValid;
}

export { validateScenarios }; 
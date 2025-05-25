export const API_CONFIG = {
  // OpenAI configuration
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  OPENAI_MODEL: 'gpt-4.1-mini',
  
  // DeepSeek configuration
  DEEPSEEK_API_KEY: import.meta.env.VITE_DEEPSEEK_API_KEY,
  DEEPSEEK_API_URL: 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-chat',  // DeepSeek V3 is accessed via this model name
  
  // Volcengine configuration
  VOLCENGINE_API_KEY: import.meta.env.VITE_VOLCENGINE_API_KEY,
  VOLCENGINE_API_URL: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  VOLCENGINE_MODEL: 'deepseek-v3-250324',  // DeepSeek V3 model on Volcengine
  
  // Current active model selection
  ACTIVE_PROVIDER: 'volcengine', // Options: 'openai', 'deepseek', or 'volcengine'
}; 
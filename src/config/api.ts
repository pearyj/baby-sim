export const API_CONFIG = {
  // Serverless function endpoint (will be your Vercel domain)
  SERVERLESS_API_URL: '/api/chat',
  
  // Current active model selection
  ACTIVE_PROVIDER: 'volcengine', // Options: 'openai', 'deepseek', or 'volcengine'
  
  // Force serverless mode for security - no direct API access
  DIRECT_API_MODE: false,
}; 
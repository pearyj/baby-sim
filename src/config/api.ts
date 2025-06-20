// Centralised runtime configuration for API access.
// Values can be overridden via Vite env variables so we do **not** need to change code
// when we switch between local-development and production deployments.
//
// ──  Available environment variables  ─────────────────────────────────────────
// VITE_SERVERLESS_API_URL   – full URL to your deployed Vercel Function. Falls back to "/api/chat".
// VITE_DIRECT_API_MODE      – "true" to enable direct calls to the model provider (development only).
// VITE_OPENAI_API_KEY       – Optional provider keys for local direct mode.
// VITE_DEEPSEEK_API_KEY     – 〃
// VITE_VOLCENGINE_LLM_API_KEY – LLM provider key
// VITE_ACTIVE_PROVIDER      – Force a provider (openai | deepseek | volcengine).
// ───────────────────────────────────────────────────────────────────────────────

export const API_CONFIG = {
  // Serverless fallback (production)
  SERVERLESS_API_URL: import.meta.env.VITE_SERVERLESS_API_URL || '/api/chat',

  // Model provider in use (can be switched in dev via DevModelSwitcher)
  ACTIVE_PROVIDER: (import.meta.env.VITE_ACTIVE_PROVIDER as 'openai' | 'deepseek' | 'volcengine') || 'volcengine',

  // Local direct-to-provider mode (only enable when explicitly set)
  DIRECT_API_MODE: import.meta.env.VITE_DIRECT_API_MODE === 'true',
}; 
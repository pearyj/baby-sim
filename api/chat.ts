import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, rateLimit } from './_utils';

// Allow up to ~2 minutes so volcengine's server-side queue (X-Ark-Max-Wait-Timeout-Ms,
// configured to 60s below) plus the actual model response time still fits.
export const config = { maxDuration: 120 };

// Volcengine Ark queue wait. When set, Ark queues the request server-side for up
// to this many ms instead of immediately returning 429 under TPM pressure.
// Keep this < maxDuration so the function still has time for the model response.
const VOLCENGINE_QUEUE_WAIT_MS = 60_000;

// Retry policy for volcengine 429s (modeled on the tenacity example in the Ark docs:
// wait_random_exponential(min=1, max=60), stop_after_attempt(6)). Caps adjusted so
// the total upper bound fits inside maxDuration alongside the queue wait.
const VOLCENGINE_MAX_ATTEMPTS = 3;
const VOLCENGINE_BACKOFF_BASE_MS = 1_000;
const VOLCENGINE_BACKOFF_CAP_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// wait_random_exponential analogue: random in [0, min(cap, base * 2^attempt)].
const computeBackoff = (attempt: number): number => {
  const ceiling = Math.min(VOLCENGINE_BACKOFF_CAP_MS, VOLCENGINE_BACKOFF_BASE_MS * Math.pow(2, attempt));
  return Math.random() * ceiling;
};

// Types
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ModelProvider {
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface RequestBody {
  messages: ChatMessage[];
  provider?: 'openai' | 'deepseek' | 'volcengine' | 'gemini-flash' | 'gemini-pro' | 'gpt5';
  streaming?: boolean;
}

// Provider configurations - using environment variables
const getProvider = (providerName: string): ModelProvider => {
  switch (providerName) {
    case 'openai':
      return {
        name: 'openai',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
        model: 'gpt-4o-mini',
      };
    case 'gpt5':
      return {
        name: 'openai',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
        model: 'gpt-5-mini-2025-08-07',
      };
    case 'deepseek':
      return {
        name: 'deepseek',
        apiUrl: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '',
        model: 'deepseek-chat',
      };
    case 'gemini-flash':
      return {
        name: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
        model: 'gemini-2.5-flash',
      };
    case 'gemini-pro':
    case 'gpt5': // legacy alias maps to Gemini 3.0 Pro
      return {
        name: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
        model: 'gemini-3.0-pro',
      };
    case 'volcengine':
      return {
        name: 'volcengine',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: process.env.ARK_API_KEY || process.env.VOLCENGINE_LLM_API_KEY || process.env.VITE_VOLCENGINE_LLM_API_KEY || '',
        // deepseek-v3-250324 was deprecated by volcengine; doubao-seed-2-0-lite is the
        // officially recommended replacement. We disable its built-in reasoning step
        // (latency ~28s/turn → ~6s/turn) and force JSON output, because the model
        // emits leading-plus integers like `"financeDelta": +1` without it.
        model: 'doubao-seed-2-0-lite-260215',
      };
    default:
      return {
        name: 'volcengine',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: process.env.VOLCENGINE_LLM_API_KEY || process.env.VITE_VOLCENGINE_LLM_API_KEY || '',
        model: 'doubao-pro-4k',
      };
  }
};

// CORS applied per request using applyCors

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS preflight
  if (handlePreflight(req, res)) return;



  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    applyCors(req, res);
    if (!rateLimit(req, res, 'chat', 60)) return; // ~60 req/min per IP
    const { messages, provider = 'volcengine', streaming = false }: RequestBody = req.body;

    // Input validation
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Validate messages structure and content
    if (messages.length === 0 || messages.length > 50) {
      return res.status(400).json({ error: 'Messages array must contain 1-50 messages' });
    }

    for (const message of messages) {
      if (!message.role || !message.content) {
        return res.status(400).json({ error: 'Each message must have role and content' });
      }
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        return res.status(400).json({ error: 'Invalid message role' });
      }
      if (typeof message.content !== 'string' || message.content.length > 20000) {
        return res.status(400).json({ error: 'Message content must be a string under 20000 characters' });
      }
    }

    // Validate provider (allow alias 'gpt5')
    if (!['openai', 'deepseek', 'volcengine', 'gemini-flash', 'gemini-pro', 'gpt5'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const normalizedProvider = provider === 'gpt5' ? 'gemini-pro' : provider;
    const providerConfig = getProvider(normalizedProvider);
    
    if (!providerConfig.apiKey) {
      return res.status(500).json({ error: `API key not configured for ${provider}` });
    }

    // Prepare request body
    const supportsTemperature = true;
    let requestBody: any = {
      model: providerConfig.model,
      messages: messages,
      ...(supportsTemperature ? { temperature: 0.7 } : {}),
      ...(streaming ? { stream: true } : {}),
    };

    // Add provider-specific parameters
    if (normalizedProvider === 'deepseek') {
      requestBody = {
        ...requestBody,
        max_tokens: 2048,
        top_p: 0.8,
        frequency_penalty: 0,
        presence_penalty: 0,
      };
    } else if (normalizedProvider === 'openai') {
      requestBody = {
        ...requestBody,
        max_tokens: 2048,
      };
    } else if (normalizedProvider === 'volcengine') {
      // doubao-seed-2-0-lite has a built-in reasoning step that adds ~20s/turn.
      // We disable it because game responses are short and don't benefit, and
      // we force json_object output because the model emits invalid `+1` integers
      // when reasoning is off.
      requestBody = {
        ...requestBody,
        max_tokens: 2048,
        top_p: 0.8,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
      };
    }

    const buildHeaders = (): Record<string, string> => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${providerConfig.apiKey}`,
      ...(providerConfig.name === 'gemini' ? { 'x-goog-api-key': providerConfig.apiKey } : {}),
      ...(streaming ? { 'Accept': 'text/event-stream' } : {}),
      // Volcengine Ark: queue server-side instead of returning 429 immediately.
      ...(providerConfig.name === 'volcengine'
        ? { 'X-Ark-Max-Wait-Timeout-Ms': String(VOLCENGINE_QUEUE_WAIT_MS) }
        : {}),
    });

    // Make request to AI provider (with volcengine-specific retry on 429).
    let response: Response;
    let lastErrorText = '';
    let lastErrorCode: string | undefined;
    const maxAttempts = providerConfig.name === 'volcengine' ? VOLCENGINE_MAX_ATTEMPTS : 1;
    let attempt = 0;

    while (true) {
      response = await fetch(providerConfig.apiUrl, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;

      // Read body once and try to extract a structured error code.
      lastErrorText = await response.text();
      lastErrorCode = undefined;
      try {
        const parsed = JSON.parse(lastErrorText);
        lastErrorCode =
          parsed?.error?.code ??
          parsed?.error?.type ??
          parsed?.code;
      } catch {
        // Body wasn't JSON — leave code undefined.
      }

      console.error(
        `API Error from ${normalizedProvider}:`,
        response.status,
        `code=${lastErrorCode ?? 'unknown'}`,
        `attempt=${attempt + 1}/${maxAttempts}`,
        lastErrorText,
      );

      // Retry only volcengine 429s, and only while attempts remain.
      const isRetryable =
        providerConfig.name === 'volcengine' &&
        response.status === 429 &&
        attempt < maxAttempts - 1;

      if (!isRetryable) break;

      const backoff = computeBackoff(attempt);
      attempt += 1;
      console.warn(
        `Retrying volcengine after ${Math.round(backoff)}ms (attempt ${attempt}/${maxAttempts}, code=${lastErrorCode ?? 'unknown'})`,
      );
      await sleep(backoff);
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed request to ${normalizedProvider}: ${response.statusText}`,
        code: lastErrorCode,
        details: lastErrorText.slice(0, 500),
      });
    }

    if (streaming) {
      // Handle streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      applyCors(req, res);

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
        } finally {
          reader.releaseLock();
        }
      }

      res.end();
    } else {
      // Handle regular response
      const data = await response.json();
      
      applyCors(req, res);
      
      res.status(200).json(data);
    }

  } catch (error) {
    console.error('Serverless function error:', error);
    
    // CORS headers for errors
    applyCors(req, res);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

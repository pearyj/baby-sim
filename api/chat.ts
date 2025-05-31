import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  provider?: 'openai' | 'deepseek' | 'volcengine';
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
    case 'deepseek':
      return {
        name: 'deepseek',
        apiUrl: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '',
        model: 'deepseek-chat',
      };
    case 'volcengine':
      return {
        name: 'volcengine',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: process.env.VOLCENGINE_API_KEY || process.env.VITE_VOLCENGINE_API_KEY || '',
        model: 'deepseek-v3-250324',
      };
    default:
      return {
        name: 'volcengine',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: process.env.VOLCENGINE_API_KEY || process.env.VITE_VOLCENGINE_API_KEY || '',
        model: 'deepseek-v3-250324',
      };
  }
};

// CORS headers - allow all origins for now (you should restrict this to your domain in production)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins for now
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({}).setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin'])
      .setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods'])
      .setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
      if (typeof message.content !== 'string' || message.content.length > 10000) {
        return res.status(400).json({ error: 'Message content must be a string under 10000 characters' });
      }
    }

    // Validate provider
    if (!['openai', 'deepseek', 'volcengine'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const providerConfig = getProvider(provider);
    
    if (!providerConfig.apiKey) {
      return res.status(500).json({ error: `API key not configured for ${provider}` });
    }

    // Prepare request body
    let requestBody: any = {
      model: providerConfig.model,
      messages: messages,
      temperature: 0.7,
      stream: streaming,
    };

    // Add provider-specific parameters
    if (provider === 'deepseek') {
      requestBody = {
        ...requestBody,
        max_tokens: 2048,
        top_p: 0.8,
        frequency_penalty: 0,
        presence_penalty: 0,
      };
    } else if (provider === 'openai') {
      requestBody = {
        ...requestBody,
        max_tokens: 2048,
      };
    }

    // Make request to AI provider
    const response = await fetch(providerConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        ...(streaming && { 'Accept': 'text/event-stream' }),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error from ${provider}:`, response.status, errorText);
      return res.status(response.status).json({ 
        error: `Failed request to ${provider}: ${response.statusText}` 
      });
    }

    if (streaming) {
      // Handle streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

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
      
      // Set CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      res.status(200).json(data);
    }

  } catch (error) {
    console.error('Serverless function error:', error);
    
    // Set CORS headers even for errors
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { getActiveProvider, getEffectiveProviderKey, getProviderByKey, type ModelProvider } from './gptServiceUnified';
import { getOrCreateAnonymousId, consumeCreditAPI } from './paymentService';
import { API_CONFIG } from '../config/api';
import { throttledFetch } from '../utils/throttledFetch';
import { usePaymentStore } from '../stores/usePaymentStore';

// Types for streaming
export interface StreamChunk {
  content: string;
  isComplete: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamOptions {
  onChunk: (chunk: StreamChunk) => void;
  onProgress: (partialContent: string) => void;
  onComplete: (fullContent: string, usage?: any) => void;
  onError: (error: Error) => void;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Make streaming request to the API
export const makeStreamingRequest = async (
  messages: ChatMessage[],
  options: StreamOptions
): Promise<void> => {
  const effectiveProviderKey = getEffectiveProviderKey();
  const activeProvider = getActiveProvider();
  const provider = getProviderByKey(effectiveProviderKey);
  logger.debug(`📤 makeStreamingRequest called! Effective Provider: ${provider.name}, Model: ${provider.model}`);
  logger.info(
    `📤 Sending streaming API request to ${provider.name} provider using ${provider.model} (active=${activeProvider.name}/${activeProvider.model})`
  );
  
  // Dev-only: print full messages array before streaming
  try {
    // Vite env is available in client; guard in case this is reused elsewhere
    if ((import.meta as any).env && (import.meta as any).env.DEV) {
      console.group('🔍 FULL MESSAGES ARRAY (Streaming)');
      messages.forEach((m, i) => {
        console.log(`[${i}] role=${m.role}`);
        console.log(m.content);
      });
      console.groupEnd();
    }
  } catch (_) {}
  
  // Start timing the API request
  performanceMonitor.startTiming(`Streaming-API-${provider.name}-request`, 'api', {
    provider: provider.name,
    model: provider.model,
    messageCount: messages.length
  });

  // Deep clone messages to avoid reference issues
  const cleanedMessages = JSON.parse(JSON.stringify(messages));
  
  // Check if we should use direct API mode (for development)
  const useDirectAPI = API_CONFIG.DIRECT_API_MODE;
  
  if (useDirectAPI) {
    // Legacy direct streaming API call (for development only) - use effective provider
    return makeDirectStreamingRequest(messages, provider, options);
  }
  
  // Use serverless function for streaming
  try {
    logger.info(`Making streaming request to serverless function`);
    
    const response = await throttledFetch(API_CONFIG.SERVERLESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: cleanedMessages,
        provider: effectiveProviderKey as any,
        streaming: true
      })
    });

    if (!response.ok) {
      performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
      const errorText = await response.text();
      logger.error(`❌ Streaming Serverless API Error:`, response.status, errorText);
      throw new Error(`Failed streaming serverless request: ${response.statusText || errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body available for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let usage: any = undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.usage) {
                usage = parsed.usage;
              }
              
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                fullContent += content;

                // Emit detailed chunk information if consumer needs it
                if (options.onChunk) {
                  options.onChunk({ content, isComplete: false });
                }

                // Still forward aggregated progress to listeners that only care about text so far
                options.onProgress(fullContent);
              }
            } catch (e) {
              logger.warn('Failed to parse streaming chunk:', data);
            }
          }
        }
      }
      
      performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
      
      // Notify listeners that the stream has finished
      if (options.onChunk) {
        options.onChunk({ content: '', isComplete: true, usage });
      }

      options.onComplete(fullContent, usage);

      // Charge fractional credit if using the premium Gemini model (ultra)
      try {
        const currentEffective = getEffectiveProviderKey();
        if (currentEffective === 'gemini-pro') {
          const anonId = getOrCreateAnonymousId();
          const email = (() => {
            try { return usePaymentStore.getState().email || undefined; } catch (_) { return undefined; }
          })();
          const result = await consumeCreditAPI(anonId, email, 0.05);
          try {
            usePaymentStore.setState({ credits: result.remaining });
          } catch (_) {}
        }
      } catch (_) {}
      
    } finally {
      reader.releaseLock();
    }
    
  } catch (error) {
    performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
    logger.error(`❌ Exception in streaming serverless API call:`, error);
    
    if (error instanceof Error) {
      options.onError(error);
    } else {
      options.onError(new Error('Unknown streaming error'));
    }
  }
};

// Legacy direct streaming function (for development only)
const makeDirectStreamingRequest = async (
  messages: ChatMessage[],
  provider: ModelProvider,
  options: StreamOptions
): Promise<void> => {
  // Create the request body based on provider
  const isPremiumGemini = provider.name === 'gemini' && provider.model.includes('pro');
  let requestBody: any = {
    model: provider.model,
    messages: messages,
    stream: true, // Enable streaming
  };
  if (!isPremiumGemini) {
    requestBody = {
      ...requestBody,
      temperature: 0.7,
    };
  }

  // Add provider-specific parameters
  if (provider.name === 'deepseek') {
    requestBody = {
      ...requestBody,
      max_tokens: 2048,
      top_p: 0.8,
      frequency_penalty: 0,
      presence_penalty: 0,
    };
    logger.info("Using DeepSeek-specific streaming request format");
  } else if (provider.name === 'openai') {
    requestBody = {
      ...requestBody,
      max_tokens: 2048,
    };
    logger.info("Using OpenAI streaming request format");
  }

  const response = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      ...(provider.name === 'gemini' ? { 'x-goog-api-key': provider.apiKey } : {}),
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`❌ Direct Streaming API Error from ${provider.name}:`, response.status, errorText);
    throw new Error(`Failed direct streaming request to ${provider.name}: ${response.statusText || errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body available for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';
  let usage: any = undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.usage) {
              usage = parsed.usage;
            }
            
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;

              // Emit detailed chunk information if consumer needs it
              if (options.onChunk) {
                options.onChunk({ content, isComplete: false });
              }

              // Still forward aggregated progress to listeners that only care about text so far
              options.onProgress(fullContent);
            }
          } catch (e) {
            logger.warn('Failed to parse streaming chunk:', data);
          }
        }
      }
    }
    
    // Notify listeners that the stream has finished
    if (options.onChunk) {
      options.onChunk({ content: '', isComplete: true, usage });
    }

    options.onComplete(fullContent, usage);
    
    // Charge fractional credit if using premium Gemini in direct mode
    try {
      const isPremium = provider.name === 'gemini' && provider.model.includes('pro');
      if (isPremium) {
        const anonId = getOrCreateAnonymousId();
        const result = await consumeCreditAPI(anonId, undefined, 0.05);
        try {
          usePaymentStore.setState({ credits: result.remaining });
        } catch (_) {}
      }
    } catch (_) {}
    
  } finally {
    reader.releaseLock();
  }
};

// Helper function to check if a JSON string is potentially complete enough to parse
const isJSONPotentiallyComplete = (jsonStr: string): boolean => {
  const trimmed = jsonStr.trim();
  if (!trimmed.startsWith('{')) return false;
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return true; // Found complete JSON object
        }
      }
    }
  }
  
  return false; // Incomplete JSON
};

// Helper function to clean content for JSON parsing
const cleanJSONContent = (content: string): string => {
  return content
    // Strip code-block delimiters
    .replace(/```(json)?/g, '')
    .replace(/```/g, '')
    // Remove ALL control chars 0x00-0x1F except tab (0x09) which JSON allows when escaped
    .replace(/[\u0000-\u0008\u000A-\u001F]/g, '')
    // Remove DEL & friends
    .replace(/[\u007F-\u009F]/g, '')
    // Remove zero-width chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Convert invalid \'+ sequences to plain single quotes
    .replace(/\\'/g, "'")
    .trim();
};

// Extract the first complete top-level JSON object {...} from arbitrary text.
// Handles strings and escapes to avoid counting braces inside strings.
const extractFirstCompleteJSONObject = (text: string): string | null => {
  const s = text;
  let inString = false;
  let escapeNext = false;
  let braceCount = 0;
  let startIndex = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === '\\') {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      if (braceCount === 0) {
        startIndex = i;
      }
      braceCount++;
    } else if (ch === '}') {
      if (braceCount > 0) {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          return s.slice(startIndex, i + 1);
        }
      }
    }
  }

  return null;
};

// Try to parse JSON from arbitrary text by extracting the first full JSON object
const tryParseJSONObjectFromText = (text: string): any | null => {
  const cleaned = cleanJSONContent(text);
  const candidate = extractFirstCompleteJSONObject(cleaned);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch (_) {
    return null;
  }
};

// Streaming wrapper for JSON responses (for structured data like questions and outcomes)
export const makeStreamingJSONRequest = async (
  messages: ChatMessage[],
  options: {
    onProgress: (partialContent: string) => void;
    onComplete: (parsedResult: any, usage?: any) => void;
    onError: (error: Error) => void;
  }
): Promise<void> => {
  let accumulatedContent = '';
  let lastValidJSON: any = null;
  
  await makeStreamingRequest(messages, {
    onChunk: (chunk) => {
      if (chunk.content) {
        accumulatedContent += chunk.content;
        
        // Always show progress with the accumulated content
        options.onProgress(accumulatedContent);
        
        // Try to parse JSON incrementally only if it looks potentially complete
        try {
          const cleanedContent = cleanJSONContent(accumulatedContent);
          
          // Only attempt parsing if the JSON might be complete
          if (isJSONPotentiallyComplete(cleanedContent)) {
            try {
              const parsed = JSON.parse(cleanedContent);
              lastValidJSON = parsed;
              logger.debug('Successfully parsed partial JSON during streaming');
            } catch (parseError) {
              // JSON not ready yet, but don't stop streaming
              logger.debug('JSON not ready for parsing yet, continuing stream...');
            }
          }
        } catch (error) {
          // Error in JSON handling, but continue streaming
          logger.warn('Error in JSON processing during stream:', error);
        }
      }
      
      if (chunk.isComplete) {
        // Stream completed, finalize
        if (lastValidJSON) {
          options.onComplete(lastValidJSON, chunk.usage);
        } else {
          // Try one final parse attempt
          try {
            const parsed = tryParseJSONObjectFromText(accumulatedContent);
            if (parsed == null) {
              throw new Error('No complete JSON object found in streamed content');
            }
            options.onComplete(parsed, chunk.usage);
          } catch (error) {
            logger.error('Failed to parse final JSON response:', error);
            logger.error('Content that failed to parse:', accumulatedContent);
            options.onError(new Error(`Failed to parse JSON response: ${error}`));
          }
        }
      }
    },
    onProgress: (partialContent) => {
      // Pass through progress updates
      options.onProgress(partialContent);
    },
    onComplete: (fullContent, usage) => {
      // This is a backup - should already be handled in onChunk when isComplete=true
      if (!lastValidJSON) {
        try {
          const parsed = tryParseJSONObjectFromText(fullContent);
          if (parsed == null) {
            throw new Error('No complete JSON object found in full content');
          }
          options.onComplete(parsed, usage);
        } catch (error) {
          logger.error('Failed to parse final JSON response in backup handler:', error);
          logger.error('Content that failed to parse:', fullContent);
          options.onError(new Error(`Failed to parse JSON response: ${error}`));
        }
      }
    },
    onError: options.onError
  });
};

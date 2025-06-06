import logger from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { getActiveProvider, type ModelProvider } from './gptServiceUnified';
import { API_CONFIG } from '../config/api';

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
  const provider = getActiveProvider();
  logger.debug(`📤 makeStreamingRequest called! Provider: ${provider.name}, Model: ${provider.model}`);
  logger.info(`📤 Sending streaming API request to ${provider.name} provider using ${provider.model}`);
  
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
    // Legacy direct streaming API call (for development only)
    return makeDirectStreamingRequest(messages, provider, options);
  }
  
  // Use serverless function for streaming
  try {
    logger.info(`Making streaming request to serverless function`);
    
    const response = await fetch(API_CONFIG.SERVERLESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: cleanedMessages,
        provider: API_CONFIG.ACTIVE_PROVIDER,
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
  let requestBody: any = {
    model: provider.model,
    messages: messages,
    temperature: 0.7,
    stream: true, // Enable streaming
  };

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
    .replace(/```(json)?/g, '')
    .replace(/```/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
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
            const cleanedContent = cleanJSONContent(accumulatedContent);
            const parsed = JSON.parse(cleanedContent);
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
          const cleanedContent = cleanJSONContent(fullContent);
          const parsed = JSON.parse(cleanedContent);
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
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';
import { getActiveProvider } from './gptServiceUnified';

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
  onComplete: (fullContent: string, usage?: any) => void;
  onError: (error: Error) => void;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamingResponse {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    index: number;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Parse Server-Sent Events data
const parseSSEData = (data: string): StreamingResponse | null => {
  try {
    if (data === '[DONE]') {
      return null; // End of stream
    }
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Failed to parse SSE data:', data, error);
    return null;
  }
};

// Make streaming request to the API
export const makeStreamingRequest = async (
  messages: ChatMessage[],
  options: StreamOptions
): Promise<void> => {
  const provider = getActiveProvider();
  console.log(`📤 makeStreamingRequest called! Provider: ${provider.name}, Model: ${provider.model}`);
  logger.info(`📤 Sending streaming API request to ${provider.name} provider using ${provider.model}`);
  
  // Start timing the API request
  performanceMonitor.startTiming(`Streaming-API-${provider.name}-request`, 'api', {
    provider: provider.name,
    model: provider.model,
    messageCount: messages.length
  });

  // Deep clone messages to avoid reference issues
  const cleanedMessages = JSON.parse(JSON.stringify(messages));
  
  // Create the request body based on provider
  let requestBody: any = {
    model: provider.model,
    messages: cleanedMessages,
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

  try {
    logger.info(`Making streaming request to ${provider.apiUrl}`);
    
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
      performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
      const errorText = await response.text();
      logger.error(`❌ Streaming API Error from ${provider.name}:`, response.status, errorText);
      throw new Error(`Failed streaming request to ${provider.name}: ${response.statusText || errorText}`);
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

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine === '') continue;
          if (trimmedLine === 'data: [DONE]') {
            // Stream completed
            logger.info('✅ Streaming completed');
            const duration = performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
            logger.info(`✅ Streaming response completed in ${duration?.toFixed(2)}ms`);
            
            options.onChunk({
              content: '',
              isComplete: true,
              usage
            });
            options.onComplete(fullContent, usage);
            return;
          }
          
          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6); // Remove 'data: ' prefix
            const parsed = parseSSEData(dataStr);
            
            if (parsed) {
              const choice = parsed.choices?.[0];
              
              if (choice?.delta?.content) {
                const chunkContent = choice.delta.content;
                fullContent += chunkContent;
                
                options.onChunk({
                  content: chunkContent,
                  isComplete: false
                });
              }
              
              // Store usage info if available
              if (parsed.usage) {
                usage = parsed.usage;
              }
              
              // Check for completion
              if (choice?.finish_reason) {
                logger.info('✅ Streaming completed with finish_reason:', choice.finish_reason);
                const duration = performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
                logger.info(`✅ Streaming response completed in ${duration?.toFixed(2)}ms`);
                
                options.onChunk({
                  content: '',
                  isComplete: true,
                  usage
                });
                options.onComplete(fullContent, usage);
                return;
              }
            }
          }
        }
      }
      
      // If we exit the loop without a proper completion, treat as complete
      logger.info('✅ Streaming ended (no explicit completion signal)');
      const duration = performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
      logger.info(`✅ Streaming response ended in ${duration?.toFixed(2)}ms`);
      
      options.onChunk({
        content: '',
        isComplete: true,
        usage
      });
      options.onComplete(fullContent, usage);
      
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    performanceMonitor.endTiming(`Streaming-API-${provider.name}-request`);
    logger.error(`❌ Exception in streaming API call to ${provider.name}:`, error);
    
    if (error instanceof Error) {
      options.onError(error);
    } else {
      options.onError(new Error('Unknown streaming error'));
    }
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
              logger.log('Successfully parsed partial JSON during streaming');
            } catch (parseError) {
              // JSON not ready yet, but don't stop streaming
              logger.log('JSON not ready for parsing yet, continuing stream...');
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
const isDevelopment = process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  [key: string]: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  /**
   * Debug function specifically for image generation prompts.
   * Always logs the full prompt regardless of environment for debugging purposes.
   */
  debugImagePrompt: (prompt: string, options?: any) => void;
}

const createLogger = (level: LogLevel, ...args: any[]): void => {
  switch (level) {
    case 'debug':
      if (isDevelopment) {
        console.log('🔍', ...args);
      }
      break;
    case 'info':
      if (isDevelopment) {
        console.log('ℹ️', ...args);
      }
      break;
    case 'warn':
      console.warn('⚠️', ...args);
      break;
    case 'error':
      console.error('❌', ...args);
      break;
  }
};

const logger: Logger = {
  debug: (...args: any[]) => createLogger('debug', ...args),
  info: (...args: any[]) => createLogger('info', ...args),
  warn: (...args: any[]) => createLogger('warn', ...args),
  error: (...args: any[]) => createLogger('error', ...args),
  debugImagePrompt: (prompt: string, options?: any) => {
    // Only log image prompts in development environment
    if (isDevelopment) {
      console.group('🖼️ IMAGE GENERATION DEBUG - Full Prompt');
      console.log('📝 Full Image Prompt:');
      console.log(prompt);
      if (options) {
        console.log('⚙️ Generation Options:', options);
      }
      console.log('📏 Prompt Length:', prompt.length, 'characters');
      console.groupEnd();
    }
  }
};

export default logger; 
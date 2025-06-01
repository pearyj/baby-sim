const isDevelopment = process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  [key: string]: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
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
  error: (...args: any[]) => createLogger('error', ...args)
};

export default logger; 
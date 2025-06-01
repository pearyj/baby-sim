import logger from './logger';

const isDevelopment = process.env.NODE_ENV === 'development';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  category: 'api' | 'local' | 'ui';
  details?: any;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeTimers: Map<string, PerformanceMetric> = new Map();

  // Start timing a metric
  startTiming(name: string, category: 'api' | 'local' | 'ui', details?: any): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      category,
      details
    };
    
    this.activeTimers.set(name, metric);
    logger.debug(`Started timing: ${name} (${category})`);
  }

  // End timing a metric
  endTiming(name: string): number | null {
    const metric = this.activeTimers.get(name);
    if (!metric) {
      logger.warn(`No active timer found for: ${name}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    this.metrics.push(metric);
    this.activeTimers.delete(name);
    
    logger.debug(`Completed timing: ${name} - ${metric.duration.toFixed(2)}ms (${metric.category})`);
    return metric.duration;
  }

  // Get all completed metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Get metrics by category
  getMetricsByCategory(category: 'api' | 'local' | 'ui'): PerformanceMetric[] {
    return this.metrics.filter(m => m.category === category);
  }

  // Get summary of performance by category
  getSummary(): { api: number; local: number; ui: number; total: number } {
    if (!isDevelopment) return { api: 0, local: 0, ui: 0, total: 0 };
    
    const summary = {
      api: 0,
      local: 0,
      ui: 0,
      total: 0
    };
    
    this.metrics.forEach(metric => {
      if (metric.duration) {
        summary[metric.category] += metric.duration;
        summary.total += metric.duration;
      }
    });

    logger.debug('Summary by category:');
    logger.debug(`  🌐 API calls: ${summary.api.toFixed(2)}ms`);
    logger.debug(`  🖥️ Local processing: ${summary.local.toFixed(2)}ms`);
    logger.debug(`  🎨 UI rendering: ${summary.ui.toFixed(2)}ms`);
    logger.debug(`  📊 Total: ${summary.total.toFixed(2)}ms`);
    
    logger.debug('\nDetailed metrics:');
    this.metrics.forEach(metric => {
      if (metric.duration) {
        logger.debug(`  ${metric.category === 'api' ? '🌐' : metric.category === 'local' ? '🖥️' : '🎨'} ${metric.name}: ${metric.duration.toFixed(2)}ms`);
        if (metric.details) {
          logger.debug(`    Details:`, metric.details);
        }
      }
    });

    return summary;
  }

  // Print detailed performance report
  printReport(): void {
    console.group('📊 Performance Report');
    
    const summary = this.getSummary();
    console.log('Summary by category:');
    console.log(`  🌐 API calls: ${summary.api.toFixed(2)}ms`);
    console.log(`  🖥️ Local processing: ${summary.local.toFixed(2)}ms`);
    console.log(`  🎨 UI rendering: ${summary.ui.toFixed(2)}ms`);
    console.log(`  📊 Total: ${summary.total.toFixed(2)}ms`);
    
    console.log('\nDetailed metrics:');
    this.metrics.forEach(metric => {
      console.log(`  ${metric.category === 'api' ? '🌐' : metric.category === 'local' ? '🖥️' : '🎨'} ${metric.name}: ${metric.duration?.toFixed(2)}ms`);
      if (metric.details) {
        console.log(`    Details:`, metric.details);
      }
    });
    
    console.groupEnd();
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
    this.activeTimers.clear();
    logger.debug('🧹 Performance metrics cleared');
  }

  // Helper method to time async functions
  async timeAsync<T>(
    name: string, 
    category: 'api' | 'local' | 'ui', 
    fn: () => Promise<T>,
    details?: any
  ): Promise<T> {
    this.startTiming(name, category, details);
    try {
      const result = await fn();
      this.endTiming(name);
      return result;
    } catch (error) {
      this.endTiming(name);
      throw error;
    }
  }

  // Helper method to time synchronous functions
  timeSync<T>(
    name: string, 
    category: 'api' | 'local' | 'ui', 
    fn: () => T,
    details?: any
  ): T {
    this.startTiming(name, category, details);
    try {
      const result = fn();
      this.endTiming(name);
      return result;
    } catch (error) {
      this.endTiming(name);
      throw error;
    }
  }
}

// Export a singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export const {
  startTiming,
  endTiming,
  getMetrics,
  getMetricsByCategory,
  getSummary,
  printReport,
  clear: clearMetrics,
  timeAsync,
  timeSync
} = performanceMonitor;

// Make performance monitor available in the browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
  (window as any).perf = {
    report: () => performanceMonitor.printReport(),
    clear: () => performanceMonitor.clear(),
    summary: () => performanceMonitor.getSummary(),
    metrics: () => performanceMonitor.getMetrics(),
    api: () => performanceMonitor.getMetricsByCategory('api'),
    local: () => performanceMonitor.getMetricsByCategory('local'),
    ui: () => performanceMonitor.getMetricsByCategory('ui'),
    // Add test function
    test: () => {
      console.log('🧪 Adding test metrics...');
      performanceMonitor.timeSync('console-test-local', 'local', () => {
        const start = Date.now();
        while (Date.now() - start < 25) {} // 25ms work
      });
      performanceMonitor.timeSync('console-test-ui', 'ui', () => {
        const start = Date.now();
        while (Date.now() - start < 15) {} // 15ms work
      });
      // Async test
      performanceMonitor.timeAsync('console-test-api', 'api', async () => {
        await new Promise(resolve => setTimeout(resolve, 75)); // 75ms
      });
      console.log('✅ Test metrics added. Check summary with perf.summary()');
    }
  };
  
  console.log('🔧 Performance monitor loaded. Use perf.test() to add test metrics, perf.summary() to check results.');
} 
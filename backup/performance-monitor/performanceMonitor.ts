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
  }

  // End timing a metric
  endTiming(name: string): number | null {
    const metric = this.activeTimers.get(name);
    if (!metric) {
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    this.metrics.push(metric);
    this.activeTimers.delete(name);
    
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

    return summary;
  }

  // Print detailed performance report
  printReport(): void {
    console.group('📊 Performance Report');
    
    const summary = this.getSummary();
    console.log('Summary:', summary);
    console.groupEnd();
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
    this.activeTimers.clear();
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
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms async
      }).then(() => {
        console.log('✅ Test metrics added! Use perf.summary() to see results.');
      });
    }
  };
} 
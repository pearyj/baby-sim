# Performance Monitor Backup

This directory contains the backup of all performance monitor related code that was removed from the main codebase for cleaner code structure.

## Files Backed Up

### Core Performance Monitor Files
- `performanceMonitor.ts` - Main performance monitoring utility with comprehensive timing and metrics collection
- `PerformanceMonitor.tsx` - React component for displaying performance metrics in development mode

## What Was Removed From Main Codebase

### Files that had performance monitor usage removed:
1. `src/App.tsx` - Removed PerformanceMonitor component import and usage
2. `src/services/streamingService.ts` - Removed performance timing calls
3. `src/services/imageGenerationService.ts` - Removed performance timing calls  
4. `src/services/gptServiceUnified.ts` - Removed performance timing calls
5. `src/stores/useGameStore.ts` - Removed performance timing calls
6. `src/components/dev/index.ts` - Removed PerformanceMonitor export

### Files that were completely removed:
1. `src/utils/performanceMonitor.ts` - Complete performance monitoring utility
2. `src/components/dev/PerformanceMonitor.tsx` - Performance monitor React component

## How to Restore Performance Monitor (if needed)

If you need to restore performance monitoring functionality:

1. Copy the files back to their original locations:
   ```bash
   cp backup/performance-monitor/performanceMonitor.ts src/utils/
   cp backup/performance-monitor/PerformanceMonitor.tsx src/components/dev/
   ```

2. Add back the imports and usage in the affected files:
   - Add `import { performanceMonitor } from './utils/performanceMonitor'` to files that need it
   - Add `import { PerformanceMonitor } from './components/dev/PerformanceMonitor'` to App.tsx
   - Add `<PerformanceMonitor />` back to the App component in development mode
   - Add back the performance timing calls in service files (wrap API calls with `performanceMonitor.timeAsync()`)

3. Export PerformanceMonitor from `src/components/dev/index.ts`:
   ```typescript
   export { PerformanceMonitor } from './PerformanceMonitor';
   ```

## Features of the Performance Monitor

- **Real-time performance tracking** - Monitor API calls, local processing, and UI rendering
- **Categorized metrics** - Separate tracking for API, local, and UI operations
- **Visual dashboard** - Expandable UI component showing detailed metrics
- **Development mode only** - Only active in development environment
- **Console debugging** - Global `perf` object available in browser console
- **Comprehensive timing** - Support for both sync and async operations

## Performance Monitor Usage Examples

```typescript
// Time an async operation
const result = await performanceMonitor.timeAsync('api-call', 'api', async () => {
  return await fetch('/api/data');
});

// Time a sync operation
const processed = performanceMonitor.timeSync('data-processing', 'local', () => {
  return processData(data);
});

// Manual timing
performanceMonitor.startTiming('custom-operation', 'ui');
// ... do work
performanceMonitor.endTiming('custom-operation');
```

The performance monitor was removed to keep the codebase clean, but can be easily restored if performance debugging is needed in the future.
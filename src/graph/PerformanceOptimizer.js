/**
 * Performance optimization framework for Claude Code Graph
 * Handles caching, metrics collection, and performance monitoring
 */
export class PerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      cacheSize: options.cacheSize || 1000,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      enableMetrics: options.enableMetrics !== false,
      performanceBudget: options.performanceBudget || {
        graphLoad: 5000,    // 5s max for graph loading
        queryResponse: 1000, // 1s max for queries
        batchSize: 100      // max files per batch
      },
      ...options
    };

    this.cache = new Map();
    this.metrics = new Map();
    this.performanceLog = [];
    this.startTime = Date.now();
  }

  /**
   * Create a cached version of a function
   */
  cached(fn, keyGenerator = null) {
    const cache = this.cache;
    const timeout = this.options.cacheTimeout;

    return async function(...args) {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      const cacheKey = `${fn.name}:${key}`;
      
      // Check cache
      if (cache.has(cacheKey)) {
        const { data, timestamp } = cache.get(cacheKey);
        if (Date.now() - timestamp < timeout) {
          return data;
        } else {
          cache.delete(cacheKey);
        }
      }

      // Execute function and cache result
      const result = await fn.apply(this, args);
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      // Cleanup old cache entries
      if (cache.size > this.options.cacheSize) {
        this.cleanupCache();
      }
      
      return result;
    }.bind(this);
  }

  /**
   * Monitor performance of a function
   */
  monitored(fn, name = null) {
    const functionName = name || fn.name;
    const metrics = this.metrics;
    const performanceLog = this.performanceLog;
    const budget = this.options.performanceBudget;

    return async function(...args) {
      const startTime = Date.now();
      let error = null;
      let result = null;

      try {
        result = await fn.apply(this, args);
      } catch (e) {
        error = e;
        throw e;
      } finally {
        const duration = Date.now() - startTime;
        
        // Update metrics
        if (!metrics.has(functionName)) {
          metrics.set(functionName, {
            calls: 0,
            totalTime: 0,
            avgTime: 0,
            maxTime: 0,
            minTime: Infinity,
            errors: 0,
            lastCall: null
          });
        }
        
        const metric = metrics.get(functionName);
        metric.calls++;
        metric.totalTime += duration;
        metric.avgTime = metric.totalTime / metric.calls;
        metric.maxTime = Math.max(metric.maxTime, duration);
        metric.minTime = Math.min(metric.minTime, duration);
        metric.lastCall = new Date().toISOString();
        
        if (error) {
          metric.errors++;
        }

        // Log performance issues
        const budgetForFunction = budget[functionName] || budget.queryResponse;
        if (duration > budgetForFunction) {
          performanceLog.push({
            timestamp: new Date().toISOString(),
            function: functionName,
            duration,
            budget: budgetForFunction,
            exceeded: duration - budgetForFunction,
            args: args.length,
            error: error ? error.message : null
          });
        }
      }

      return result;
    }.bind(this);
  }

  /**
   * Batch process items with concurrency control
   */
  async batchProcess(items, processor, options = {}) {
    const {
      batchSize = this.options.performanceBudget.batchSize,
      concurrency = 5,
      delay = 0
    } = options;

    const results = [];
    const batches = this.createBatches(items, batchSize);
    
    for (const batch of batches) {
      const batchPromises = batch.map(item => processor(item));
      const batchResults = await this.limitConcurrency(batchPromises, concurrency);
      results.push(...batchResults);
      
      // Add delay between batches if specified
      if (delay > 0 && batch !== batches[batches.length - 1]) {
        await this.sleep(delay);
      }
    }
    
    return results;
  }

  /**
   * Limit concurrency of promises
   */
  async limitConcurrency(promises, limit) {
    const results = [];
    const executing = [];
    
    for (const promise of promises) {
      const p = Promise.resolve(promise).then(result => {
        executing.splice(executing.indexOf(p), 1);
        return result;
      });
      
      results.push(p);
      executing.push(p);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Debounce function calls
   */
  debounced(fn, delay = 300) {
    let timeoutId;
    
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Throttle function calls
   */
  throttled(fn, limit = 1000) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Cleanup old cache entries
   */
  cleanupCache() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();
    const timeout = this.options.cacheTimeout;
    
    // Remove expired entries first
    let removed = 0;
    for (const [key, { timestamp }] of entries) {
      if (now - timestamp > timeout) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    // If still too large, remove oldest entries
    if (this.cache.size > this.options.cacheSize) {
      const sortedEntries = entries
        .filter(([key]) => this.cache.has(key)) // Only keep non-expired
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = this.cache.size - this.options.cacheSize;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(sortedEntries[i][0]);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const metrics = {};
    
    for (const [name, metric] of this.metrics) {
      metrics[name] = { ...metric };
    }
    
    return {
      functions: metrics,
      cache: {
        size: this.cache.size,
        maxSize: this.options.cacheSize,
        hitRate: this.calculateCacheHitRate()
      },
      performance: {
        uptime: Date.now() - this.startTime,
        issues: this.performanceLog.length,
        recentIssues: this.performanceLog.slice(-10)
      }
    };
  }

  /**
   * Calculate cache hit rate (approximation)
   */
  calculateCacheHitRate() {
    const totalCalls = Array.from(this.metrics.values())
      .reduce((sum, metric) => sum + metric.calls, 0);
    
    if (totalCalls === 0) return 0;
    
    // Rough estimation based on cache size vs total calls
    const estimatedHits = Math.min(this.cache.size, totalCalls);
    return (estimatedHits / totalCalls * 100).toFixed(1);
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const metrics = this.getMetrics();
    const issues = this.performanceLog.slice(-20); // Last 20 issues
    
    return {
      summary: {
        uptime: this.formatDuration(metrics.performance.uptime),
        totalFunctionCalls: Object.values(metrics.functions)
          .reduce((sum, m) => sum + m.calls, 0),
        cacheEfficiency: `${metrics.cache.hitRate}%`,
        performanceIssues: metrics.performance.issues
      },
      functions: Object.entries(metrics.functions)
        .map(([name, metric]) => ({
          name,
          calls: metric.calls,
          avgTime: `${metric.avgTime.toFixed(1)}ms`,
          maxTime: `${metric.maxTime}ms`,
          errors: metric.errors,
          errorRate: `${(metric.errors / metric.calls * 100).toFixed(1)}%`
        }))
        .sort((a, b) => b.calls - a.calls),
      recentIssues: issues.map(issue => ({
        function: issue.function,
        duration: `${issue.duration}ms`,
        budget: `${issue.budget}ms`,
        exceeded: `+${issue.exceeded}ms`,
        timestamp: issue.timestamp
      }))
    };
  }

  /**
   * Format duration in human readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Clear all caches and reset metrics
   */
  reset() {
    this.cache.clear();
    this.metrics.clear();
    this.performanceLog.length = 0;
    this.startTime = Date.now();
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an optimized version of GraphService
   */
  optimizeGraphService(graphService) {
    // Cache expensive operations
    graphService.findRelatedFiles = this.cached(
      graphService.findRelatedFiles.bind(graphService),
      (targetFile, options) => `${targetFile}:${JSON.stringify(options)}`
    );

    graphService.getArchitectureOverview = this.cached(
      graphService.getArchitectureOverview.bind(graphService),
      () => 'overview'
    );

    graphService.searchBySymbols = this.cached(
      graphService.searchBySymbols.bind(graphService),
      (keywords) => keywords.join(':')
    );

    // Monitor performance
    graphService.findRelatedFiles = this.monitored(
      graphService.findRelatedFiles,
      'findRelatedFiles'
    );

    graphService.getArchitectureOverview = this.monitored(
      graphService.getArchitectureOverview,
      'getArchitectureOverview'
    );

    return graphService;
  }
}
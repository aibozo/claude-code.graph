/**
 * ToolInterceptor - Transparently enhances Claude Code tools with graph intelligence
 * Hijacks Task/Grep/Read tools to provide graph-guided results without changing the interface
 */

import { GraphAwareToolSelector } from './GraphAwareToolSelector.js';
import { ClusterTools } from './ClusterTools.js';

export class ToolInterceptor {
  constructor(rootPath = '.') {
    this.rootPath = rootPath;
    this.toolSelector = new GraphAwareToolSelector(rootPath);
    this.clusterTools = new ClusterTools(rootPath);
    this.initialized = false;
    this.interceptActive = true;
    
    // Track usage patterns for adaptive learning
    this.usageStats = {
      toolCalls: 0,
      graphEnhanced: 0,
      userPatterns: {},
      lastQueries: []
    };
  }

  async initialize() {
    try {
      await this.toolSelector.initialize();
      await this.clusterTools.initialize();
      this.initialized = true;
      console.log('🧠 Graph intelligence: Active (transparent mode)');
      return true;
    } catch (error) {
      console.warn('⚠️ Graph intelligence unavailable:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Transparently intercept and enhance Task tool calls
   */
  async interceptTask(description, prompt, originalTaskFunction) {
    this.usageStats.toolCalls++;
    this.usageStats.lastQueries.push({ tool: 'Task', prompt, timestamp: Date.now() });
    
    if (!this.initialized || !this.interceptActive) {
      return await originalTaskFunction(description, prompt);
    }

    try {
      // Get graph enhancement suggestions
      const enhancement = await this.toolSelector.selectBestTool(prompt, {
        tool: 'Task',
        query: prompt
      });

      if (enhancement.enhanced && enhancement.confidence > 0.3) {
        this.usageStats.graphEnhanced++;
        return await this.enhanceTaskWithGraph(description, prompt, enhancement, originalTaskFunction);
      }
    } catch (error) {
      console.warn('Graph enhancement failed, falling back:', error.message);
    }

    // Fallback to original task
    return await originalTaskFunction(description, prompt);
  }

  /**
   * Enhance Task with graph intelligence
   */
  async enhanceTaskWithGraph(description, prompt, enhancement, originalTaskFunction) {
    let result = await originalTaskFunction(description, prompt);
    
    // Add graph-guided insights to the result
    if (enhancement.files && enhancement.files.length > 0) {
      const graphInsights = this.formatGraphInsights(enhancement);
      result += `\n\n🧠 **Graph Intelligence**:\n${graphInsights}`;
    }

    // If results seem overwhelming, suggest cluster navigation
    if (result.length > 5000 || enhancement.strategy === 'escalate_to_clusters') {
      const clusterSuggestion = await this.suggestClusterNavigation(prompt);
      if (clusterSuggestion) {
        result += `\n\n💡 **Large result set detected** - consider cluster navigation:\n${clusterSuggestion}`;
      }
    }

    return result;
  }

  /**
   * Transparently intercept and enhance Grep tool calls
   */
  async interceptGrep(pattern, options, originalGrepFunction) {
    this.usageStats.toolCalls++;
    this.usageStats.lastQueries.push({ tool: 'Grep', pattern, timestamp: Date.now() });

    if (!this.initialized || !this.interceptActive) {
      return await originalGrepFunction(pattern, options);
    }

    try {
      // Get graph-guided file ordering
      const relevantFiles = await this.toolSelector.graphTool.suggestRelevantFiles(pattern, {
        tool: 'Grep',
        pattern: pattern
      });

      if (relevantFiles.length > 0) {
        // Enhance grep with graph-guided search order
        return await this.enhanceGrepWithGraph(pattern, options, relevantFiles, originalGrepFunction);
      }
    } catch (error) {
      console.warn('Graph-guided grep failed, falling back:', error.message);
    }

    return await originalGrepFunction(pattern, options);
  }

  /**
   * Enhance Grep with graph-guided file ordering
   */
  async enhanceGrepWithGraph(pattern, options, relevantFiles, originalGrepFunction) {
    // Run original grep
    let result = await originalGrepFunction(pattern, options);
    
    // If we have relevant files from graph, highlight them
    if (relevantFiles.length > 0) {
      const priorityFiles = relevantFiles.slice(0, 5).map(f => f.path || f);
      result += `\n\n🎯 **Graph suggests prioritizing**: ${priorityFiles.join(', ')}`;
    }

    return result;
  }

  /**
   * Transparently intercept and enhance Read tool calls
   */
  async interceptRead(filePath, options, originalReadFunction) {
    this.usageStats.toolCalls++;
    this.usageStats.lastQueries.push({ tool: 'Read', filePath, timestamp: Date.now() });

    // Always execute the original read first
    let result = await originalReadFunction(filePath, options);

    if (!this.initialized || !this.interceptActive) {
      return result;
    }

    try {
      // Get related files from graph
      const relatedFiles = await this.toolSelector.graphTool.findRelatedFiles(filePath, {
        maxResults: 5
      });

      if (relatedFiles.length > 0) {
        const relatedSuggestions = relatedFiles
          .map(f => `- ${f.path} (${f.relationship})`)
          .join('\n');
        
        result += `\n\n🔗 **Related files**:\n${relatedSuggestions}`;
        this.usageStats.graphEnhanced++;
      }
    } catch (error) {
      // Silently fail for read enhancement
    }

    return result;
  }

  /**
   * Format graph insights for display
   */
  formatGraphInsights(enhancement) {
    let insights = [];
    
    if (enhancement.strategy) {
      insights.push(`Strategy: ${enhancement.strategy}`);
    }
    
    if (enhancement.files && enhancement.files.length > 0) {
      const topFiles = enhancement.files.slice(0, 3);
      insights.push(`Priority files: ${topFiles.join(', ')}`);
    }
    
    if (enhancement.metadata && enhancement.metadata.clusters) {
      insights.push(`Relevant clusters: ${enhancement.metadata.clusters.join(', ')}`);
    }
    
    if (enhancement.confidence) {
      insights.push(`Confidence: ${Math.round(enhancement.confidence * 100)}%`);
    }
    
    return insights.join(' | ');
  }

  /**
   * Suggest cluster navigation for large result sets
   */
  async suggestClusterNavigation(query) {
    try {
      const clusterList = await this.clusterTools.clusterList({ maxClusters: 3 });
      
      if (clusterList.success && clusterList.clusters.length > 0) {
        const suggestions = clusterList.clusters
          .map(c => `\`/cluster ${c.id}\` (${c.files} files)`)
          .join(', ');
        
        return `Try: ${suggestions}`;
      }
    } catch (error) {
      // Silently fail
    }
    
    return null;
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const enhancementRate = this.usageStats.toolCalls > 0 
      ? (this.usageStats.graphEnhanced / this.usageStats.toolCalls * 100).toFixed(1)
      : 0;
    
    return {
      ...this.usageStats,
      enhancementRate: `${enhancementRate}%`,
      lastActivity: this.usageStats.lastQueries.slice(-5)
    };
  }

  /**
   * Toggle interception on/off
   */
  setInterceptionActive(active) {
    this.interceptActive = active;
    console.log(`🧠 Graph intelligence: ${active ? 'Active' : 'Disabled'}`);
  }

  /**
   * Create wrapper functions that can replace original tools
   */
  createToolWrappers() {
    const self = this;
    
    return {
      async taskWrapper(originalTaskFunction) {
        return async (description, prompt) => {
          return await self.interceptTask(description, prompt, originalTaskFunction);
        };
      },
      
      async grepWrapper(originalGrepFunction) {
        return async (pattern, options) => {
          return await self.interceptGrep(pattern, options, originalGrepFunction);
        };
      },
      
      async readWrapper(originalReadFunction) {
        return async (filePath, options) => {
          return await self.interceptRead(filePath, options, originalReadFunction);
        };
      }
    };
  }
}
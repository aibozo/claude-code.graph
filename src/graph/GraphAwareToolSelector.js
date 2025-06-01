import { GraphTool } from './GraphTool.js';

/**
 * Enhanced tool selector that uses graph analysis to make smarter tool choices
 * Integrates with Claude Code's existing tool selection system
 */
export class GraphAwareToolSelector {
  constructor(rootPath, fallbackSelector = null) {
    this.rootPath = rootPath;
    this.graphTool = new GraphTool(rootPath);
    this.fallbackSelector = fallbackSelector;
    this.initialized = false;
    
    // Tool selection priorities (higher = preferred)
    this.toolPriorities = {
      graph_search: 100,
      targeted_read: 90,
      grep: 50,
      broad_search: 10,
      fallback: 5
    };
  }

  /**
   * Initialize the graph-aware tool selector
   */
  async initialize() {
    try {
      this.initialized = await this.graphTool.initialize();
      return this.initialized;
    } catch (error) {
      console.warn('GraphAwareToolSelector initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Select the best tool(s) for a given query and context
   * 
   * @param {string} query - The user's query/request
   * @param {Object} context - Current context (currentFile, recentFiles, etc.)
   * @returns {Object} Tool selection with strategy and files
   */
  async selectBestTool(query, context = {}) {
    // Initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }

    // Get graph health status
    const graphHealth = await this.graphTool.checkHealth();
    
    if (!graphHealth.healthy) {
      // Fallback to original tool selection if graph unavailable
      return this.fallbackToOriginalSelection(query, context, 'Graph unavailable');
    }

    try {
      // Analyze query for graph potential
      const analysis = await this.analyzeQuery(query, context);
      
      // Select strategy based on analysis
      const strategy = this.selectStrategy(analysis, context);
      
      // Execute strategy
      return await this.executeStrategy(strategy, query, context);
    } catch (error) {
      console.warn('Graph-enhanced tool selection failed:', error.message);
      return this.fallbackToOriginalSelection(query, context, error.message);
    }
  }

  /**
   * Analyze query to determine graph potential
   */
  async analyzeQuery(query, context) {
    const analysis = {
      isStructural: this.graphTool.isStructuralQuery(query),
      hasFileContext: !!context.currentFile,
      queryType: this.classifyQuery(query),
      graphSuggestion: null,
      relatedFiles: [],
      relevantFiles: []
    };

    // Get graph suggestions
    analysis.graphSuggestion = await this.graphTool.suggestToolUsage(query, context);

    // If we have file context, get related files
    if (analysis.hasFileContext) {
      analysis.relatedFiles = await this.graphTool.findRelatedFiles(
        context.currentFile, 
        { maxResults: 20 }
      );
    }

    // Get files relevant to the query
    analysis.relevantFiles = await this.graphTool.suggestRelevantFiles(query, context);

    return analysis;
  }

  /**
   * Classify the type of query
   */
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (this.matchesPattern(lowerQuery, ['find', 'search', 'locate', 'where'])) {
      return 'search';
    }
    
    if (this.matchesPattern(lowerQuery, ['show', 'display', 'read', 'view'])) {
      return 'read';
    }
    
    if (this.matchesPattern(lowerQuery, ['modify', 'change', 'edit', 'update', 'fix'])) {
      return 'modify';
    }
    
    if (this.matchesPattern(lowerQuery, ['related', 'connected', 'depends', 'uses'])) {
      return 'relationship';
    }
    
    if (this.matchesPattern(lowerQuery, ['architecture', 'structure', 'overview'])) {
      return 'analysis';
    }
    
    return 'general';
  }

  /**
   * Select the best strategy based on analysis
   */
  selectStrategy(analysis, context) {
    // Prioritize graph strategies
    if (analysis.isStructural || analysis.queryType === 'relationship') {
      return {
        type: 'graph_first',
        priority: this.toolPriorities.graph_search,
        reason: 'Query involves code relationships'
      };
    }

    // Use targeted search if we have related files
    if (analysis.relatedFiles.length > 0 && analysis.relatedFiles.length <= 20) {
      return {
        type: 'targeted_search',
        priority: this.toolPriorities.targeted_read,
        reason: 'Graph shows manageable set of related files',
        targets: analysis.relatedFiles.slice(0, 10).map(f => f.path)
      };
    }

    // Use graph-guided search if we have relevant files
    if (analysis.relevantFiles.length > 0) {
      return {
        type: 'graph_guided',
        priority: this.toolPriorities.grep,
        reason: 'Graph suggests relevant starting points',
        guides: analysis.relevantFiles.slice(0, 5).map(f => f.path)
      };
    }

    // Analysis queries should use graph
    if (analysis.queryType === 'analysis') {
      return {
        type: 'graph_analysis',
        priority: this.toolPriorities.graph_search,
        reason: 'Architecture analysis query'
      };
    }

    // Default to traditional search
    return {
      type: 'traditional',
      priority: this.toolPriorities.broad_search,
      reason: 'Traditional search appropriate'
    };
  }

  /**
   * Execute the selected strategy
   */
  async executeStrategy(strategy, query, context) {
    switch (strategy.type) {
      case 'graph_first':
        return await this.executeGraphFirstStrategy(query, context);
      
      case 'targeted_search':
        return await this.executeTargetedSearchStrategy(strategy, query, context);
      
      case 'graph_guided':
        return await this.executeGraphGuidedStrategy(strategy, query, context);
      
      case 'graph_analysis':
        return await this.executeGraphAnalysisStrategy(query, context);
      
      case 'traditional':
      default:
        return this.fallbackToOriginalSelection(query, context, strategy.reason);
    }
  }

  /**
   * Execute graph-first strategy (use graph data directly)
   */
  async executeGraphFirstStrategy(query, context) {
    const suggestions = await this.graphTool.suggestRelevantFiles(query, context);
    
    if (suggestions.length > 0) {
      return {
        tool: 'GraphSearch',
        strategy: 'graph_first',
        files: suggestions.slice(0, 10).map(s => s.path),
        confidence: 0.9,
        reason: 'Graph analysis found relevant files',
        metadata: {
          suggestions: suggestions.slice(0, 5)
        }
      };
    }

    // Fallback if no graph results
    return this.fallbackToOriginalSelection(query, context, 'No graph results found');
  }

  /**
   * Execute targeted search strategy (read specific related files)
   */
  async executeTargetedSearchStrategy(strategy, query, context) {
    return {
      tool: 'Read',
      strategy: 'targeted_search',
      files: strategy.targets,
      confidence: 0.8,
      reason: strategy.reason,
      metadata: {
        searchWithin: true,
        targets: strategy.targets
      }
    };
  }

  /**
   * Execute graph-guided strategy (grep with graph priorities)
   */
  async executeGraphGuidedStrategy(strategy, query, context) {
    const searchTerms = this.extractSearchTerms(query);
    
    return {
      tool: 'Grep',
      strategy: 'graph_guided',
      searchTerms,
      priority_files: strategy.guides,
      confidence: 0.7,
      reason: strategy.reason,
      metadata: {
        guideFiles: strategy.guides,
        searchTerms
      }
    };
  }

  /**
   * Execute graph analysis strategy (architectural queries)
   */
  async executeGraphAnalysisStrategy(query, context) {
    return {
      tool: 'GraphAnalysis',
      strategy: 'graph_analysis',
      analysisType: this.determineAnalysisType(query),
      confidence: 0.9,
      reason: 'Architecture analysis query',
      metadata: {
        query
      }
    };
  }

  /**
   * Fallback to original tool selection
   */
  fallbackToOriginalSelection(query, context, reason) {
    if (this.fallbackSelector && typeof this.fallbackSelector.selectTool === 'function') {
      const original = this.fallbackSelector.selectTool(query, context);
      return {
        ...original,
        strategy: 'fallback',
        fallbackReason: reason,
        graphEnhanced: false
      };
    }

    // Default fallback strategy
    return {
      tool: this.selectDefaultTool(query),
      strategy: 'default_fallback',
      confidence: 0.5,
      reason: `Fallback selection: ${reason}`,
      graphEnhanced: false
    };
  }

  /**
   * Select default tool based on query patterns
   */
  selectDefaultTool(query) {
    const lowerQuery = query.toLowerCase();
    
    if (this.matchesPattern(lowerQuery, ['find', 'search', 'grep'])) {
      return 'Grep';
    }
    
    if (this.matchesPattern(lowerQuery, ['list', 'show files', '*.'])) {
      return 'Glob';
    }
    
    if (this.matchesPattern(lowerQuery, ['read', 'show', 'content'])) {
      return 'Read';
    }
    
    return 'Grep'; // Default to grep for most searches
  }

  /**
   * Extract search terms from query
   */
  extractSearchTerms(query) {
    // Remove common query words and extract meaningful terms
    const cleanQuery = query
      .replace(/^(find|search|grep|look for|show me)/i, '')
      .replace(/\b(in|from|within|inside)\b/gi, '')
      .trim();
    
    // Extract quoted strings first
    const quotedMatches = cleanQuery.match(/"([^"]+)"/g) || [];
    const quoted = quotedMatches.map(match => match.slice(1, -1));
    
    // Extract other meaningful words
    const remaining = cleanQuery.replace(/"[^"]+"/g, '');
    const words = remaining
      .split(/\s+/)
      .filter(word => word.length > 2 && !/^(the|and|for|are|but|not)$/i.test(word));
    
    return [...quoted, ...words];
  }

  /**
   * Determine analysis type for graph analysis queries
   */
  determineAnalysisType(query) {
    const lowerQuery = query.toLowerCase();
    
    if (this.matchesPattern(lowerQuery, ['overview', 'architecture', 'structure'])) {
      return 'overview';
    }
    
    if (this.matchesPattern(lowerQuery, ['hot', 'popular', 'frequently', 'most used'])) {
      return 'hot_paths';
    }
    
    if (this.matchesPattern(lowerQuery, ['cycle', 'circular', 'dependency loop'])) {
      return 'cycles';
    }
    
    if (this.matchesPattern(lowerQuery, ['stats', 'statistics', 'metrics'])) {
      return 'stats';
    }
    
    return 'overview';
  }

  /**
   * Check if query matches any of the given patterns
   */
  matchesPattern(query, patterns) {
    return patterns.some(pattern => query.includes(pattern));
  }

  /**
   * Get tool selection statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      graphAvailable: this.initialized,
      strategies: Object.keys(this.toolPriorities),
      priorities: this.toolPriorities
    };
  }
}
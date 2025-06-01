import { GraphService } from './GraphService.js';

/**
 * Graph-aware tool for Claude Code integration
 * Provides graph-enhanced file discovery and code navigation
 */
export class GraphTool {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphService = new GraphService(rootPath);
    this.initialized = false;
  }

  /**
   * Initialize the graph tool
   */
  async initialize() {
    try {
      this.initialized = await this.graphService.initialize();
      return this.initialized;
    } catch (error) {
      console.warn('GraphTool initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if graph tools are available and healthy
   */
  async checkHealth() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return {
      healthy: this.initialized && this.graphService.isHealthy(),
      stats: this.initialized ? this.graphService.getStats() : null,
      issues: this.getHealthIssues()
    };
  }

  /**
   * Get health issues for diagnostics
   */
  getHealthIssues() {
    const issues = [];
    
    if (!this.initialized) {
      issues.push('Graph service not initialized');
    }
    
    if (this.initialized && !this.graphService.isHealthy()) {
      issues.push('No graph data available');
    }
    
    return issues;
  }

  /**
   * Find files related to a target file using graph relationships
   * 
   * @param {string} targetFile - File to find relationships for
   * @param {Object} options - Search options
   * @returns {Array} Array of related files with relationship info
   */
  async findRelatedFiles(targetFile, options = {}) {
    if (!this.initialized) {
      return [];
    }

    const {
      depth = 3,
      types = ['imports', 'calls', 'inheritance'],
      includeReverse = true,
      maxResults = 20
    } = options;

    try {
      const related = await this.graphService.findRelatedFiles(targetFile, {
        maxDepth: depth,
        relationTypes: types,
        includeReverse
      });

      // Sort by confidence and limit results
      return related
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults)
        .map(item => ({
          path: item.path,
          relationship: item.relationship,
          confidence: item.confidence,
          depth: item.depth,
          reason: this.getRelationshipReason(item.relationship)
        }));
    } catch (error) {
      console.warn('Failed to find related files:', error.message);
      return [];
    }
  }

  /**
   * Suggest files relevant to a coding task using graph analysis
   * 
   * @param {string} task - Description of the task
   * @param {Object} codeContext - Current code context
   * @returns {Array} Array of suggested files with relevance scores
   */
  async suggestRelevantFiles(task, codeContext = {}) {
    if (!this.initialized) {
      return [];
    }

    try {
      // Extract keywords from task description
      const keywords = this.extractKeywords(task);
      
      // Search for symbols matching keywords
      const symbolMatches = await this.graphService.searchBySymbols(keywords);
      
      // Get related files if we have a current file context
      let relatedFiles = [];
      if (codeContext.currentFile) {
        relatedFiles = await this.findRelatedFiles(codeContext.currentFile, {
          depth: 2,
          maxResults: 10
        });
      }
      
      // Combine and rank results
      return this.rankFiles([...symbolMatches, ...relatedFiles], task, codeContext);
    } catch (error) {
      console.warn('Failed to suggest relevant files:', error.message);
      return [];
    }
  }

  /**
   * Get high-level architecture overview
   */
  async getArchitectureOverview() {
    if (!this.initialized) {
      return null;
    }

    try {
      return await this.graphService.getArchitectureOverview();
    } catch (error) {
      console.warn('Failed to get architecture overview:', error.message);
      return null;
    }
  }

  /**
   * Get hot paths (most frequently used code paths)
   */
  async getHotPaths() {
    if (!this.initialized) {
      return [];
    }

    try {
      const overview = await this.graphService.getArchitectureOverview();
      return overview.hotPaths || [];
    } catch (error) {
      console.warn('Failed to get hot paths:', error.message);
      return [];
    }
  }

  /**
   * Detect circular dependencies
   */
  async detectCycles() {
    if (!this.initialized) {
      return [];
    }

    try {
      const overview = await this.graphService.getArchitectureOverview();
      return overview.cycles || [];
    } catch (error) {
      console.warn('Failed to detect cycles:', error.message);
      return [];
    }
  }

  /**
   * Get graph statistics
   */
  async getStats() {
    if (!this.initialized) {
      return null;
    }

    try {
      return this.graphService.getStats();
    } catch (error) {
      console.warn('Failed to get stats:', error.message);
      return null;
    }
  }

  /**
   * Check if a query would benefit from graph-enhanced search
   */
  isStructuralQuery(query) {
    const structuralKeywords = [
      'related', 'depends', 'calls', 'imports', 'uses', 'extends',
      'inheritance', 'structure', 'architecture', 'connected',
      'find all', 'show me', 'what uses', 'what calls', 'dependencies'
    ];

    const lowerQuery = query.toLowerCase();
    return structuralKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Suggest tool usage based on query type
   */
  async suggestToolUsage(query, context = {}) {
    if (!this.initialized) {
      return { useGraph: false, reason: 'Graph not available' };
    }

    // Check if this is a structural query
    if (this.isStructuralQuery(query)) {
      return { 
        useGraph: true, 
        reason: 'Query involves code relationships',
        strategy: 'graph_first'
      };
    }

    // Check if we have context that would benefit from graph search
    if (context.currentFile) {
      const related = await this.findRelatedFiles(context.currentFile, { 
        maxResults: 5 
      });
      
      if (related.length > 0) {
        return {
          useGraph: true,
          reason: 'Current file has graph relationships',
          strategy: 'targeted_search',
          targets: related.slice(0, 3).map(r => r.path)
        };
      }
    }

    return { 
      useGraph: false, 
      reason: 'Query better suited for traditional search' 
    };
  }

  // Private helper methods

  /**
   * Extract keywords from task description
   */
  extractKeywords(task) {
    // Simple keyword extraction - could be enhanced with NLP
    const words = task.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Filter out common words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
      'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy',
      'did', 'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye'
    ]);
    
    return words.filter(word => !stopWords.has(word));
  }

  /**
   * Rank files by relevance to task and context
   */
  rankFiles(candidates, task, context) {
    const rankedFiles = candidates.map(candidate => {
      let score = candidate.relevance || candidate.confidence || 0.5;
      
      // Boost score for files matching task keywords
      const taskKeywords = this.extractKeywords(task);
      const fileText = (candidate.file || candidate.path || '').toLowerCase();
      const matchingKeywords = taskKeywords.filter(keyword => 
        fileText.includes(keyword)
      );
      score += matchingKeywords.length * 0.1;
      
      // Boost score for files in same directory as current context
      if (context.currentFile && (candidate.file || candidate.path)) {
        const contextDir = context.currentFile.split('/').slice(0, -1).join('/');
        const candidateDir = (candidate.file || candidate.path).split('/').slice(0, -1).join('/');
        if (contextDir === candidateDir) {
          score += 0.2;
        }
      }
      
      // Boost score for certain file types based on task
      const filePath = candidate.file || candidate.path || '';
      if (task.includes('test') && filePath.includes('test')) {
        score += 0.3;
      }
      if (task.includes('config') && filePath.includes('config')) {
        score += 0.3;
      }
      
      return {
        path: candidate.file || candidate.path,
        type: candidate.type,
        language: candidate.language,
        relevance: Math.min(1.0, score),
        reason: this.getRelevanceReason(candidate, task),
        matches: candidate.matches || matchingKeywords
      };
    });

    // Remove duplicates and sort by relevance
    const uniqueFiles = new Map();
    rankedFiles.forEach(file => {
      if (!uniqueFiles.has(file.path) || uniqueFiles.get(file.path).relevance < file.relevance) {
        uniqueFiles.set(file.path, file);
      }
    });

    return Array.from(uniqueFiles.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 15);
  }

  /**
   * Get human-readable reason for relationship
   */
  getRelationshipReason(relationship) {
    const reasons = {
      'imports': 'imports this module',
      'calls': 'calls functions from this file',
      'inheritance': 'inherits from classes in this file',
      'reverse_imports': 'is imported by this file',
      'reverse_calls': 'has functions called by this file',
      'reverse_inheritance': 'has classes inherited by this file',
      'composition': 'uses components from this file',
      'dependencies': 'depends on this file'
    };
    
    return reasons[relationship] || `has ${relationship} relationship`;
  }

  /**
   * Get human-readable reason for relevance
   */
  getRelevanceReason(candidate, task) {
    if (candidate.matches && candidate.matches.length > 0) {
      return `contains keywords: ${candidate.matches.join(', ')}`;
    }
    
    if (candidate.relationship) {
      return this.getRelationshipReason(candidate.relationship);
    }
    
    return 'potentially relevant based on graph analysis';
  }
}
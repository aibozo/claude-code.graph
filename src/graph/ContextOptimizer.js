/**
 * Context Optimizer - Efficient graph data presentation for Claude
 * Compresses large graph data into concise, actionable context
 */

export class ContextOptimizer {
  constructor(graphService) {
    this.graphService = graphService;
  }

  /**
   * Generate concise context summary for Claude
   * Focuses on high-value, actionable information
   */
  async generateContextSummary(options = {}) {
    const {
      maxItems = 50,
      focusFile = null,
      includeStats = true,
      includeHotspots = true
    } = options;

    const summary = {
      status: await this.getGraphStatus(),
      architecture: await this.getArchitectureSummary(maxItems / 2),
      ...(focusFile && { focus: await this.getFocusedContext(focusFile, maxItems / 2) }),
      ...(includeHotspots && { hotspots: await this.getCodeHotspots(10) })
    };

    return this.formatForContext(summary);
  }

  /**
   * Get concise graph status for context header
   */
  async getGraphStatus() {
    if (!this.graphService.isHealthy()) {
      return "Graph: OFF";
    }

    // Check if super-graph is available for compressed view
    const hasSuperGraph = await this.graphService.hasSuperGraph();
    const stats = this.graphService.getStats();
    
    if (hasSuperGraph) {
      const clusterTools = this.graphService.getClusterTools();
      const clusterList = await clusterTools.clusterList({ maxClusters: 10 });
      
      if (clusterList.success) {
        return `Graph: ON (${clusterList.total} clusters, ${stats.totalNodes} files)`;
      }
    }

    return `Graph: ON (${stats.totalNodes} nodes, ${stats.languages.length} langs)`;
  }

  /**
   * Get high-level architecture overview
   */
  async getArchitectureSummary(maxItems) {
    try {
      const overview = await this.graphService.getArchitectureOverview();
      
      // Aggregate by module patterns
      const modulePatterns = {};
      
      Object.entries(overview.modules).forEach(([lang, analysis]) => {
        if (analysis.topNodes && analysis.topNodes.length > 0) {
          const topFiles = analysis.topNodes
            .slice(0, Math.min(5, maxItems / 2))
            .map(node => ({
              file: this.getFilePattern(node.file),
              connections: node.totalDegree,
              type: node.type
            }));
          
          modulePatterns[lang] = {
            count: analysis.nodeCount,
            topFiles
          };
        }
      });

      return modulePatterns;
    } catch (error) {
      return { error: "Architecture analysis unavailable" };
    }
  }

  /**
   * Get focused context for a specific file
   */
  async getFocusedContext(targetFile, maxItems) {
    try {
      const related = await this.graphService.findRelatedFiles(targetFile, {
        maxDepth: 2,
        relationTypes: ['imports', 'calls'],
        includeReverse: true
      });

      const focused = related
        .slice(0, maxItems)
        .map(item => ({
          file: this.shortenPath(item.path),
          relation: this.simplifyRelation(item.relationship),
          confidence: Math.round(item.confidence * 100)
        }));

      return {
        target: this.shortenPath(targetFile),
        related: focused,
        total: related.length
      };
    } catch (error) {
      return { error: "Focus analysis failed" };
    }
  }

  /**
   * Get code hotspots (most connected files)
   */
  async getCodeHotspots(maxItems) {
    try {
      const overview = await this.graphService.getArchitectureOverview();
      const allHotspots = [];

      Object.entries(overview.modules).forEach(([lang, analysis]) => {
        if (analysis.topNodes) {
          analysis.topNodes.forEach(node => {
            if (node.totalDegree > 5) { // Only significant connections
              allHotspots.push({
                file: this.shortenPath(node.file),
                connections: node.totalDegree,
                lang,
                type: node.type
              });
            }
          });
        }
      });

      return allHotspots
        .sort((a, b) => b.connections - a.connections)
        .slice(0, maxItems);

    } catch (error) {
      return [];
    }
  }

  /**
   * Format summary for Claude's context window
   */
  formatForContext(summary) {
    let context = `${summary.status}`;

    // Add architecture overview
    if (summary.architecture && Object.keys(summary.architecture).length > 0) {
      context += " | Modules: ";
      const moduleCount = Object.entries(summary.architecture)
        .map(([lang, data]) => `${lang}(${data.count})`)
        .join(", ");
      context += moduleCount;
    }

    // Add hotspots if present
    if (summary.hotspots && summary.hotspots.length > 0) {
      const topHotspot = summary.hotspots[0];
      context += ` | Hotspot: ${topHotspot.file} (${topHotspot.connections} deps)`;
    }

    // Add focused context if present
    if (summary.focus && summary.focus.related) {
      context += ` | Focus: ${summary.focus.target} → ${summary.focus.related.length} related`;
    }

    return {
      compact: context,
      detailed: summary
    };
  }

  /**
   * Shorten file paths for context efficiency
   */
  shortenPath(filePath) {
    if (!filePath) return '';
    
    // Remove common prefixes and focus on meaningful parts
    let shortened = filePath
      .replace(/^\.\//g, '')
      .replace(/^src\//g, '')
      .replace(/^lib\//g, '')
      .replace(/^open_spiel\//g, 'os/');

    // Keep only last 2 directory levels for deep paths
    const parts = shortened.split('/');
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`;
    }

    return shortened;
  }

  /**
   * Extract meaningful file patterns
   */
  getFilePattern(filePath) {
    if (!filePath) return '';
    
    const parts = filePath.split('/');
    if (parts.length > 2) {
      return `${parts[1]}/.../${parts[parts.length - 1]}`;
    }
    return filePath;
  }

  /**
   * Simplify relationship descriptions
   */
  simplifyRelation(relationship) {
    const simple = {
      'imports': '←',
      'reverse_imports': '→', 
      'calls': '→()',
      'reverse_calls': '←()',
      'inheritance': '↑',
      'reverse_inheritance': '↓'
    };

    return simple[relationship] || relationship;
  }

  /**
   * Get concise daemon status
   */
  async getDaemonStatus() {
    // This will be implemented to check daemon status
    // and return "Daemon: ON" or "Daemon: OFF" 
    return "Daemon: OFF"; // Placeholder
  }
}
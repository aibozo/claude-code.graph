import { GraphService } from './GraphService.js';
import { ContextOptimizer } from './ContextOptimizer.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Graph-aware tool for Claude Code integration
 * Provides graph-enhanced file discovery and code navigation
 */
export class GraphTool {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphService = new GraphService(rootPath);
    this.contextOptimizer = new ContextOptimizer(this.graphService);
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
   * Get optimized context summary for Claude
   */
  async getContextSummary(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.graphService.isHealthy()) {
      return {
        compact: "Graph: OFF",
        detailed: { status: "Graph: OFF", reason: "No graph data available" }
      };
    }

    return await this.contextOptimizer.generateContextSummary(options);
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

  /**
   * Check daemon status for Claude Code context
   * @returns {Object} Daemon status information
   */
  async checkDaemonStatus() {
    const lockFile = join(this.rootPath, '.graph', 'daemon.lock');
    
    if (!existsSync(lockFile)) {
      return {
        running: false,
        status: 'Graph Daemon: OFF',
        pid: null,
        uptime: null
      };
    }

    try {
      const pidStr = await readFile(lockFile, 'utf8');
      const pid = parseInt(pidStr.trim());
      
      // Check if process exists (Node.js way)
      try {
        process.kill(pid, 0); // Signal 0 just checks if process exists
        
        // Get uptime if possible
        const stats = await this.getDaemonStats();
        
        return {
          running: true,
          status: 'Graph Daemon: ON',
          pid: pid,
          uptime: stats.uptime || null,
          updates: stats.updates || 0
        };
      } catch (error) {
        // Process doesn't exist, remove stale lock file
        try {
          await import('fs/promises').then(fs => fs.unlink(lockFile));
        } catch {}
        
        return {
          running: false,
          status: 'Graph Daemon: OFF',
          pid: null,
          uptime: null
        };
      }
    } catch (error) {
      return {
        running: false,
        status: 'Graph Daemon: ERROR',
        pid: null,
        uptime: null,
        error: error.message
      };
    }
  }

  /**
   * Start the graph daemon
   * @returns {Object} Start result
   */
  async startDaemon() {
    try {
      // Check if already running
      const status = await this.checkDaemonStatus();
      if (status.running) {
        return {
          success: true,
          message: 'Daemon already running',
          status: status
        };
      }

      // Check Python dependencies first (try python3.12, then python3)
      let pythonCmd = 'python3';
      try {
        await this.runCommand('python3.12', ['-c', 'import watchdog, networkx, psutil, aiofiles']);
        pythonCmd = 'python3.12';
      } catch (error) {
        try {
          await this.runCommand('python3', ['-c', 'import watchdog, networkx, psutil, aiofiles']);
        } catch (error2) {
          return {
            success: false,
            message: 'Missing Python dependencies. Install with: pip3 install watchdog networkx psutil aiofiles',
            status: { running: false, status: 'Graph Daemon: DEPS_MISSING' }
          };
        }
      }

      // Find daemon script (look in common locations)
      const possiblePaths = [
        join(process.cwd(), 'tools', 'codegraphd.py'),
        join(__dirname, '..', '..', 'tools', 'codegraphd.py'),
        '/usr/local/lib/node_modules/claude-code-graph/tools/codegraphd.py',
        join(process.env.HOME, '.nvm/versions/node/v22.15.0/lib/node_modules/claude-code-graph/tools/codegraphd.py')
      ];

      let daemonPath = null;
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          daemonPath = path;
          break;
        }
      }

      if (!daemonPath) {
        return {
          success: false,
          message: 'Daemon script not found',
          status: { running: false, status: 'Graph Daemon: SCRIPT_MISSING' }
        };
      }

      // Start daemon with the detected Python version
      const child = spawn(pythonCmd, [daemonPath], {
        detached: true,
        stdio: 'ignore',
        cwd: this.rootPath
      });
      
      child.unref();

      // Wait and check if started
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await this.checkDaemonStatus();

      return {
        success: newStatus.running,
        message: newStatus.running ? 'Daemon started successfully' : 'Failed to start daemon',
        status: newStatus
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to start daemon: ${error.message}`,
        status: { running: false, status: 'Graph Daemon: ERROR' }
      };
    }
  }

  /**
   * Stop the graph daemon
   * @returns {Object} Stop result
   */
  async stopDaemon() {
    try {
      const status = await this.checkDaemonStatus();
      
      if (!status.running) {
        return {
          success: true,
          message: 'Daemon not running',
          status: { running: false, status: 'Graph Daemon: OFF' }
        };
      }

      // Kill the process
      process.kill(status.pid, 'SIGTERM');
      
      // Wait for process to stop
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newStatus = await this.checkDaemonStatus();
      
      return {
        success: !newStatus.running,
        message: newStatus.running ? 'Failed to stop daemon' : 'Daemon stopped successfully',
        status: newStatus
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to stop daemon: ${error.message}`,
        status: { running: false, status: 'Graph Daemon: ERROR' }
      };
    }
  }

  /**
   * Get daemon statistics
   * @returns {Object} Daemon stats
   */
  async getDaemonStats() {
    try {
      const metricsFile = join(this.rootPath, '.graph', 'metrics.json');
      if (existsSync(metricsFile)) {
        const content = await readFile(metricsFile, 'utf8');
        const metrics = JSON.parse(content);
        
        if (metrics.daemon) {
          return {
            uptime: metrics.daemon.daemon_start,
            updates: metrics.daemon.updates || 0,
            errors: metrics.daemon.errors || 0,
            avgTime: metrics.daemon.avg_time || 0
          };
        }
      }
    } catch (error) {
      console.warn('Failed to read daemon stats:', error.message);
    }
    
    return {};
  }

  /**
   * Run a command and return result
   * @param {string} command Command to run
   * @param {Array} args Command arguments
   * @returns {Promise} Command result
   */
  runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      
      child.stdout?.on('data', (data) => output += data);
      child.stderr?.on('data', (data) => output += data);
      
      child.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      });
      
      child.on('error', reject);
    });
  }
}
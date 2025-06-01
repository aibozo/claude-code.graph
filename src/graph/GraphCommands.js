import { GraphTool } from './GraphTool.js';
import path from 'path';
import fs from 'fs/promises';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Graph-specific commands for Claude Code
 * Provides direct user access to graph functionality via slash commands
 */
export class GraphCommands {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphTool = new GraphTool(rootPath);
    this.initialized = false;
  }

  /**
   * Initialize graph commands
   */
  async initialize() {
    try {
      this.initialized = await this.graphTool.initialize();
      return this.initialized;
    } catch (error) {
      console.warn('GraphCommands initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get all available graph commands
   */
  getAvailableCommands() {
    return {
      '/graph-overview': {
        description: 'Show architecture overview of the codebase',
        usage: '/graph-overview',
        example: '/graph-overview'
      },
      '/find-related': {
        description: 'Find files related to a specific file',
        usage: '/find-related <filename>',
        example: '/find-related src/auth/login.js'
      },
      '/hot-paths': {
        description: 'Show most frequently used code paths',
        usage: '/hot-paths [--limit=N]',
        example: '/hot-paths --limit=5'
      },
      '/cycles': {
        description: 'Detect circular dependencies',
        usage: '/cycles [--language=<lang>]',
        example: '/cycles --language=javascript'
      },
      '/graph-stats': {
        description: 'Show graph statistics and health info',
        usage: '/graph-stats',
        example: '/graph-stats'
      },
      '/graph-health': {
        description: 'Check graph system health and diagnostics',
        usage: '/graph-health',
        example: '/graph-health'
      },
      '/dstart': {
        description: 'Start the graph update daemon',
        usage: '/dstart [--background]',
        example: '/dstart --background'
      },
      '/dstop': {
        description: 'Stop the graph update daemon',
        usage: '/dstop [--force]',
        example: '/dstop'
      },
      '/gupdate': {
        description: 'Manually update all graphs (rebuild)',
        usage: '/gupdate [--force]',
        example: '/gupdate --force'
      },
      '/dstatus': {
        description: 'Show daemon status and performance metrics',
        usage: '/dstatus',
        example: '/dstatus'
      }
    };
  }

  /**
   * Execute a graph command
   */
  async executeCommand(command, args = [], options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      return this.formatError('Graph system not available', 
        'Run `ccg doctor` to check system health');
    }

    try {
      switch (command) {
        case '/graph-overview':
          return await this.handleOverviewCommand(args, options);
        
        case '/find-related':
          return await this.handleFindRelatedCommand(args, options);
        
        case '/hot-paths':
          return await this.handleHotPathsCommand(args, options);
        
        case '/cycles':
          return await this.handleCyclesCommand(args, options);
        
        case '/graph-stats':
          return await this.handleStatsCommand(args, options);
        
        case '/graph-health':
          return await this.handleHealthCommand(args, options);
        
        case '/dstart':
          return await this.handleDaemonStartCommand(args, options);
        
        case '/dstop':
          return await this.handleDaemonStopCommand(args, options);
        
        case '/gupdate':
          return await this.handleGraphUpdateCommand(args, options);
        
        case '/dstatus':
          return await this.handleDaemonStatusCommand(args, options);
        
        default:
          return this.formatError(`Unknown command: ${command}`, 
            'Use `/graph-help` to see available commands');
      }
    } catch (error) {
      return this.formatError(`Command failed: ${error.message}`, 
        'Check graph system health with `/graph-health`');
    }
  }

  /**
   * Handle /graph-overview command
   */
  async handleOverviewCommand(args, options) {
    const overview = await this.graphTool.getArchitectureOverview();
    
    if (!overview) {
      return this.formatError('No architecture data available');
    }

    return this.formatArchitectureOverview(overview);
  }

  /**
   * Handle /find-related command
   */
  async handleFindRelatedCommand(args, options) {
    if (args.length === 0) {
      return this.formatError('Missing filename argument', 
        'Usage: /find-related <filename>');
    }

    const filename = args[0];
    const depth = options.depth || 3;
    const maxResults = options.limit || 20;

    const related = await this.graphTool.findRelatedFiles(filename, {
      depth,
      maxResults
    });

    if (related.length === 0) {
      return this.formatInfo(`No related files found for: ${filename}`, 
        'File may not be in the graph or has no relationships');
    }

    return this.formatRelatedFiles(filename, related);
  }

  /**
   * Handle /hot-paths command
   */
  async handleHotPathsCommand(args, options) {
    const limit = options.limit || 10;
    const hotPaths = await this.graphTool.getHotPaths();

    if (hotPaths.length === 0) {
      return this.formatInfo('No hot paths found', 
        'The codebase may be too small or have simple structure');
    }

    return this.formatHotPaths(hotPaths.slice(0, limit));
  }

  /**
   * Handle /cycles command
   */
  async handleCyclesCommand(args, options) {
    const cycles = await this.graphTool.detectCycles();
    const languageFilter = options.language;

    let filteredCycles = cycles;
    if (languageFilter) {
      filteredCycles = cycles.filter(cycle => 
        cycle.language.toLowerCase() === languageFilter.toLowerCase());
    }

    if (filteredCycles.length === 0) {
      const message = languageFilter 
        ? `No cycles found in ${languageFilter}` 
        : 'No circular dependencies detected';
      return this.formatSuccess(message, 'This is good! Your code has clean dependencies.');
    }

    return this.formatCycles(filteredCycles);
  }

  /**
   * Handle /graph-stats command
   */
  async handleStatsCommand(args, options) {
    const stats = await this.graphTool.getStats();
    
    if (!stats) {
      return this.formatError('No statistics available');
    }

    return this.formatStats(stats);
  }

  /**
   * Handle /graph-health command
   */
  async handleHealthCommand(args, options) {
    const health = await this.graphTool.checkHealth();
    return this.formatHealth(health);
  }

  /**
   * Handle /dstart command - Start the graph daemon
   */
  async handleDaemonStartCommand(args, options) {
    try {
      // Check if daemon is already running
      const isRunning = await this.isDaemonRunning();
      
      if (isRunning.running) {
        return this.formatInfo('Daemon already running', 
          `PID: ${isRunning.pid}. Use \`/dstop\` to stop it first.`);
      }

      const background = options.background || args.includes('--background');
      
      if (background) {
        // Start daemon in background
        const result = await this.startDaemonBackground();
        if (result.success) {
          return this.formatSuccess('Graph daemon started in background', 
            `PID: ${result.pid}. Use \`/dstatus\` to monitor progress.`);
        } else {
          return this.formatError('Failed to start daemon', result.error);
        }
      } else {
        // Start daemon and show initial output
        return this.formatInfo('Starting graph daemon...', 
          'Daemon will run in background. Use `/dstatus` to check status.');
      }
    } catch (error) {
      return this.formatError('Failed to start daemon', error.message);
    }
  }

  /**
   * Handle /dstop command - Stop the graph daemon
   */
  async handleDaemonStopCommand(args, options) {
    try {
      const isRunning = await this.isDaemonRunning();
      
      if (!isRunning.running) {
        return this.formatInfo('Daemon not running', 
          'Use `/dstart` to start the daemon.');
      }

      const force = options.force || args.includes('--force');
      const result = await this.stopDaemon(isRunning.pid, force);
      
      if (result.success) {
        return this.formatSuccess('Graph daemon stopped', 
          `Daemon with PID ${isRunning.pid} has been terminated.`);
      } else {
        return this.formatError('Failed to stop daemon', result.error);
      }
    } catch (error) {
      return this.formatError('Failed to stop daemon', error.message);
    }
  }

  /**
   * Handle /gupdate command - Manual graph update
   */
  async handleGraphUpdateCommand(args, options) {
    try {
      const force = options.force || args.includes('--force');
      
      // Check if daemon is running - prefer daemon refresh if available
      const isRunning = await this.isDaemonRunning();
      
      if (isRunning.running && !force) {
        // Send refresh signal to daemon
        const result = await this.refreshDaemon(isRunning.pid);
        if (result.success) {
          return this.formatSuccess('Graph update triggered', 
            'Daemon received refresh signal. Updates will complete shortly.');
        }
      }
      
      // Manual rebuild (daemon not running or force requested)
      return this.formatInfo('Starting manual graph rebuild...', 
        'This may take a few seconds for large codebases.');
        
      // Actually run the rebuild
      const buildResult = await this.runGraphBuild();
      
      if (buildResult.success) {
        return this.formatSuccess('Graph rebuild completed', 
          `Processed ${buildResult.stats?.total_files || 'unknown'} files in ${buildResult.duration}s`);
      } else {
        return this.formatError('Graph rebuild failed', buildResult.error);
      }
    } catch (error) {
      return this.formatError('Graph update failed', error.message);
    }
  }

  /**
   * Handle /dstatus command - Show daemon status
   */
  async handleDaemonStatusCommand(args, options) {
    try {
      const status = await this.getDaemonStatus();
      return this.formatDaemonStatus(status);
    } catch (error) {
      return this.formatError('Failed to get daemon status', error.message);
    }
  }

  // Formatting methods

  /**
   * Format architecture overview
   */
  formatArchitectureOverview(overview) {
    let output = '## 📊 Architecture Overview\n\n';
    
    // Metrics summary
    if (overview.metrics) {
      output += '### Project Metrics\n';
      output += `- **Total Files**: ${overview.metrics.total_files || 'Unknown'}\n`;
      output += `- **Last Updated**: ${overview.metrics.timestamp || 'Unknown'}\n\n`;
      
      if (overview.metrics.by_language) {
        output += '### Languages\n';
        Object.entries(overview.metrics.by_language).forEach(([lang, count]) => {
          if (count > 0) {
            output += `- **${lang}**: ${count} files\n`;
          }
        });
        output += '\n';
      }
    }

    // Module analysis
    if (overview.modules) {
      output += '### Module Analysis\n';
      Object.entries(overview.modules).forEach(([language, analysis]) => {
        if (analysis.nodeCount > 0) {
          output += `#### ${language.charAt(0).toUpperCase() + language.slice(1)}\n`;
          output += `- **Nodes**: ${analysis.nodeCount}\n`;
          output += `- **Edges**: ${analysis.edgeCount}\n`;
          output += `- **Avg Degree**: ${analysis.avgDegree?.toFixed(2) || 'N/A'}\n`;
          
          if (analysis.topNodes && analysis.topNodes.length > 0) {
            output += `- **Most Connected**: ${analysis.topNodes[0].file || analysis.topNodes[0].id}\n`;
          }
          output += '\n';
        }
      });
    }

    // Hot paths preview
    if (overview.hotPaths && overview.hotPaths.length > 0) {
      output += '### 🔥 Top Hot Paths\n';
      overview.hotPaths.slice(0, 3).forEach((path, i) => {
        output += `${i + 1}. ${path.language}: ${path.path.map(p => p.file || p.id).join(' → ')}\n`;
      });
      output += '\n*Use `/hot-paths` for complete list*\n\n';
    }

    // Cycles warning
    if (overview.cycles && overview.cycles.length > 0) {
      output += '### ⚠️ Circular Dependencies\n';
      output += `Found ${overview.cycles.length} circular dependencies.\n`;
      output += '*Use `/cycles` for details*\n\n';
    }

    return { type: 'success', content: output };
  }

  /**
   * Format related files
   */
  formatRelatedFiles(filename, related) {
    let output = `## 🔗 Files Related to \`${filename}\`\n\n`;
    
    if (related.length === 0) {
      output += '*No related files found*\n';
      return { type: 'info', content: output };
    }

    // Group by relationship type
    const byRelationship = {};
    related.forEach(file => {
      const rel = file.relationship || 'unknown';
      if (!byRelationship[rel]) byRelationship[rel] = [];
      byRelationship[rel].push(file);
    });

    Object.entries(byRelationship).forEach(([relationship, files]) => {
      output += `### ${this.formatRelationshipTitle(relationship)}\n`;
      files.forEach(file => {
        const confidence = (file.confidence * 100).toFixed(0);
        output += `- \`${file.path}\` (${confidence}% confidence)\n`;
      });
      output += '\n';
    });

    return { type: 'success', content: output };
  }

  /**
   * Format hot paths
   */
  formatHotPaths(hotPaths) {
    let output = '## 🔥 Hot Paths (Most Used Code Paths)\n\n';
    
    hotPaths.forEach((pathInfo, i) => {
      output += `### ${i + 1}. ${pathInfo.language} Path\n`;
      const pathStr = pathInfo.path.map(node => `\`${node.file || node.id}\``).join(' → ');
      output += `${pathStr}\n\n`;
    });

    return { type: 'success', content: output };
  }

  /**
   * Format cycles
   */
  formatCycles(cycles) {
    let output = '## 🔄 Circular Dependencies\n\n';
    
    if (cycles.length === 0) {
      output += '✅ No circular dependencies found!\n';
      return { type: 'success', content: output };
    }

    output += `Found ${cycles.length} circular dependenc${cycles.length === 1 ? 'y' : 'ies'}:\n\n`;
    
    cycles.forEach((cycle, i) => {
      output += `### ${i + 1}. ${cycle.language} Cycle (${cycle.length} nodes)\n`;
      const cycleStr = cycle.nodes.map(node => `\`${node.file || node.id}\``).join(' → ');
      output += `${cycleStr} → *(back to start)*\n\n`;
    });

    output += '💡 **Tip**: Circular dependencies can make code harder to understand and test. Consider refactoring to break these cycles.\n';

    return { type: 'warning', content: output };
  }

  /**
   * Format statistics
   */
  formatStats(stats) {
    let output = '## 📈 Graph Statistics\n\n';
    
    output += `- **Total Graphs**: ${stats.totalGraphs}\n`;
    output += `- **Total Nodes**: ${stats.totalNodes}\n`;
    output += `- **Total Edges**: ${stats.totalEdges}\n`;
    output += `- **Last Update**: ${stats.lastUpdate || 'Unknown'}\n\n`;

    if (stats.languages && stats.languages.length > 0) {
      output += '### By Language\n';
      stats.languages.forEach(lang => {
        output += `- **${lang.language}**: ${lang.nodes} nodes, ${lang.edges} edges\n`;
      });
    }

    return { type: 'info', content: output };
  }

  /**
   * Format health status
   */
  formatHealth(health) {
    let output = '## 🏥 Graph System Health\n\n';
    
    const status = health.healthy ? '✅ Healthy' : '❌ Unhealthy';
    output += `**Status**: ${status}\n\n`;

    if (health.stats) {
      output += '### Current Statistics\n';
      output += `- **Graphs Available**: ${health.stats.totalGraphs}\n`;
      output += `- **Total Nodes**: ${health.stats.totalNodes}\n`;
      output += `- **Total Edges**: ${health.stats.totalEdges}\n\n`;
    }

    if (health.issues && health.issues.length > 0) {
      output += '### Issues\n';
      health.issues.forEach(issue => {
        output += `- ⚠️ ${issue}\n`;
      });
      output += '\n💡 Run `ccg doctor` for more detailed diagnostics.\n';
    }

    return { 
      type: health.healthy ? 'success' : 'error', 
      content: output 
    };
  }

  // Helper methods for daemon control

  /**
   * Check if daemon is running
   */
  async isDaemonRunning() {
    const lockFile = path.join(this.rootPath, '.graph', 'daemon.lock');
    
    try {
      await fs.access(lockFile);
      const pidContent = await fs.readFile(lockFile, 'utf8');
      const pid = parseInt(pidContent.trim());
      
      // Check if process exists
      try {
        process.kill(pid, 0);
        return { running: true, pid };
      } catch (e) {
        // Process doesn't exist, remove stale lock file
        await fs.unlink(lockFile).catch(() => {});
        return { running: false };
      }
    } catch (e) {
      return { running: false };
    }
  }

  /**
   * Start daemon in background
   */
  async startDaemonBackground() {
    try {
      const venvPath = path.join(this.rootPath, '.venv', 'bin', 'activate');
      const daemonPath = path.join(this.rootPath, 'tools', 'codegraphd.py');
      
      // Check if virtual environment exists
      const hasVenv = await fs.access(venvPath).then(() => true).catch(() => false);
      
      let command;
      if (hasVenv) {
        command = `source ${venvPath} && python ${daemonPath}`;
      } else {
        command = `python3 ${daemonPath}`;
      }
      
      // Start daemon in background
      const child = spawn('bash', ['-c', command], {
        detached: true,
        stdio: 'ignore',
        cwd: this.rootPath
      });
      
      child.unref();
      
      // Wait a moment to see if it started successfully
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = await this.isDaemonRunning();
      if (status.running) {
        return { success: true, pid: status.pid };
      } else {
        return { success: false, error: 'Daemon failed to start' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop daemon
   */
  async stopDaemon(pid, force = false) {
    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      process.kill(pid, signal);
      
      // Wait a moment for graceful shutdown
      if (!force) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if still running, force kill if needed
        try {
          process.kill(pid, 0);
          process.kill(pid, 'SIGKILL');
        } catch (e) {
          // Process already stopped
        }
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send refresh signal to daemon
   */
  async refreshDaemon(pid) {
    try {
      process.kill(pid, 'SIGUSR1');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Run manual graph build
   */
  async runGraphBuild() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const buildScript = path.join(this.rootPath, 'tools', 'codegraph.sh');
      
      const child = spawn('bash', [buildScript], {
        cwd: this.rootPath,
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        error += data.toString();
      });
      
      child.on('close', async (code) => {
        const duration = (Date.now() - startTime) / 1000;
        
        if (code === 0) {
          // Try to get updated stats
          let stats = null;
          try {
            const metricsPath = path.join(this.rootPath, '.graph', 'metrics.json');
            const metricsContent = await fs.readFile(metricsPath, 'utf8');
            stats = JSON.parse(metricsContent);
          } catch (e) {
            // Ignore metrics errors
          }
          
          resolve({ 
            success: true, 
            duration: duration.toFixed(1),
            stats,
            output 
          });
        } else {
          resolve({ 
            success: false, 
            error: error || 'Build script failed',
            output 
          });
        }
      });
      
      child.on('error', (err) => {
        resolve({ 
          success: false, 
          error: err.message 
        });
      });
    });
  }

  /**
   * Get comprehensive daemon status
   */
  async getDaemonStatus() {
    const isRunning = await this.isDaemonRunning();
    
    const status = {
      running: isRunning.running,
      pid: isRunning.pid,
      metrics: null,
      graphs: null
    };
    
    // Get daemon metrics if available
    try {
      const metricsPath = path.join(this.rootPath, '.graph', 'metrics.json');
      const metricsContent = await fs.readFile(metricsPath, 'utf8');
      const metrics = JSON.parse(metricsContent);
      
      status.metrics = metrics.daemon || null;
      status.graphs = {
        total_files: metrics.total_files,
        by_language: metrics.by_language,
        last_build: metrics.timestamp
      };
    } catch (e) {
      // Metrics not available
    }
    
    return status;
  }

  /**
   * Format daemon status for display
   */
  formatDaemonStatus(status) {
    let output = '## 🤖 Graph Daemon Status\n\n';
    
    if (status.running) {
      output += `**Status**: 🟢 Running (PID: ${status.pid})\n\n`;
      
      if (status.metrics) {
        const metrics = status.metrics;
        output += '### Performance Metrics\n';
        output += `- **Uptime**: ${this.formatUptime(metrics.daemon_start)}\n`;
        output += `- **Total Updates**: ${metrics.updates}\n`;
        output += `- **Errors**: ${metrics.errors}\n`;
        output += `- **Average Update Time**: ${metrics.avg_time.toFixed(2)}s\n`;
        
        if (metrics.last_update) {
          const lastUpdate = new Date(metrics.last_update);
          const timeSince = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
          output += `- **Last Update**: ${timeSince}s ago\n`;
        }
        output += '\n';
      }
      
      if (status.graphs) {
        output += '### Graph Status\n';
        output += `- **Total Files**: ${status.graphs.total_files || 'Unknown'}\n`;
        
        if (status.graphs.by_language) {
          output += '- **Languages**:\n';
          Object.entries(status.graphs.by_language).forEach(([lang, count]) => {
            if (count > 0) {
              output += `  - ${lang}: ${count} files\n`;
            }
          });
        }
        output += '\n';
      }
      
      output += '### Controls\n';
      output += '- `/dstop` - Stop daemon\n';
      output += '- `/gupdate` - Trigger manual refresh\n';
      
    } else {
      output += '**Status**: 🔴 Not Running\n\n';
      output += '### Quick Start\n';
      output += '- `/dstart` - Start daemon\n';
      output += '- `/gupdate` - Manual graph rebuild\n';
    }
    
    return { type: status.running ? 'success' : 'info', content: output };
  }

  /**
   * Format uptime duration
   */
  formatUptime(startTime) {
    try {
      const start = new Date(startTime);
      const now = new Date();
      const diffMs = now - start;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m`;
      } else {
        return `${diffMinutes}m`;
      }
    } catch (e) {
      return 'Unknown';
    }
  }

  formatRelationshipTitle(relationship) {
    const titles = {
      'imports': '📥 Imports',
      'calls': '📞 Function Calls', 
      'inheritance': '🧬 Inheritance',
      'reverse_imports': '📤 Imported By',
      'reverse_calls': '📲 Called By',
      'reverse_inheritance': '👥 Inherited By'
    };
    
    return titles[relationship] || `🔗 ${relationship.replace(/_/g, ' ')}`;
  }

  formatError(message, details = null) {
    return {
      type: 'error',
      content: `❌ **Error**: ${message}${details ? `\n\n💡 ${details}` : ''}`
    };
  }

  formatSuccess(message, details = null) {
    return {
      type: 'success',
      content: `✅ **Success**: ${message}${details ? `\n\n${details}` : ''}`
    };
  }

  formatInfo(message, details = null) {
    return {
      type: 'info',
      content: `ℹ️ **Info**: ${message}${details ? `\n\n${details}` : ''}`
    };
  }
}
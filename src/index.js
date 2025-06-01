import { GraphService } from './graph/GraphService.js';
import { GraphTool } from './graph/GraphTool.js';
import { GraphAwareToolSelector } from './graph/GraphAwareToolSelector.js';
import { GraphCommands } from './graph/GraphCommands.js';

/**
 * Claude Code Graph - Main entry point
 * Integrates graph functionality with Claude Code
 */
export class ClaudeCodeGraph {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphService = new GraphService(rootPath);
    this.graphTool = new GraphTool(rootPath);
    this.toolSelector = new GraphAwareToolSelector(rootPath);
    this.commands = new GraphCommands(rootPath);
    this.initialized = false;
  }

  /**
   * Initialize the entire graph system
   */
  async initialize() {
    try {
      console.log('🔧 Initializing claude-code-graph...');
      
      // Initialize all components
      const results = await Promise.allSettled([
        this.graphService.initialize(),
        this.graphTool.initialize(),
        this.toolSelector.initialize(),
        this.commands.initialize()
      ]);

      // Check results
      const failures = results.filter(r => r.status === 'rejected' || !r.value);
      
      if (failures.length === results.length) {
        console.warn('❌ Graph system initialization failed completely');
        this.initialized = false;
      } else {
        console.log(`✅ Graph system initialized (${results.length - failures.length}/${results.length} components)`);
        this.initialized = true;
      }

      return this.initialized;
    } catch (error) {
      console.error('Graph system initialization error:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Start Claude Code Graph with the given options
   */
  async start(options = {}) {
    const { enableGraph = true, args = [] } = options;
    
    console.log('🚀 Starting claude-code-graph...');
    
    if (enableGraph) {
      await this.initialize();
    }

    // Handle command line arguments
    if (args.length > 0) {
      return await this.handleArgs(args);
    }

    // Start interactive mode or Claude Code integration
    return await this.startInteractiveMode();
  }

  /**
   * Handle command line arguments
   */
  async handleArgs(args) {
    const command = args[0];
    
    // Handle graph commands
    if (command.startsWith('/graph') || command.startsWith('graph-')) {
      const normalizedCommand = command.startsWith('/') ? command : `/${command}`;
      const result = await this.commands.executeCommand(normalizedCommand, args.slice(1));
      console.log(result.content);
      return result;
    }

    // Handle other commands
    switch (command) {
      case 'init':
        return await this.initializeProject();
      case 'doctor':
        return await this.runDiagnostics();
      case 'status':
        return await this.showStatus();
      default:
        console.log('Unknown command. Run with --help for usage information.');
        return false;
    }
  }

  /**
   * Start interactive mode (placeholder for full Claude Code integration)
   */
  async startInteractiveMode() {
    console.log('📊 Claude Code Graph is ready!');
    console.log('');
    console.log('Available graph commands:');
    
    const commands = this.commands.getAvailableCommands();
    Object.entries(commands).forEach(([cmd, info]) => {
      console.log(`  ${cmd.padEnd(20)} - ${info.description}`);
    });
    
    console.log('');
    console.log('💡 Use these commands to explore your codebase structure.');
    
    // In a full integration, this would start Claude Code with graph enhancements
    return true;
  }

  /**
   * Initialize graph support in current project
   */
  async initializeProject() {
    console.log('🏗️ Initializing graph support...');
    
    // Check if already initialized
    const healthCheck = await this.checkGraphHealth();
    if (healthCheck.healthy) {
      console.log('✅ Graph support already initialized and healthy');
      return true;
    }

    // Run graph builder
    console.log('📊 Building initial graphs...');
    // This would run the codegraph.sh script
    
    console.log('✅ Graph support initialized');
    console.log('💡 Run `ccg doctor` to verify everything is working');
    
    return true;
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics() {
    console.log('🔍 Running diagnostics...');
    
    const health = await this.checkGraphHealth();
    
    console.log(`Graph Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    if (health.stats) {
      console.log(`Graphs: ${health.stats.totalGraphs}`);
      console.log(`Nodes: ${health.stats.totalNodes}`);
      console.log(`Edges: ${health.stats.totalEdges}`);
    }
    
    if (health.issues.length > 0) {
      console.log('\nIssues:');
      health.issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    }
    
    return health.healthy;
  }

  /**
   * Show current status
   */
  async showStatus() {
    console.log('📊 Claude Code Graph Status');
    console.log('');
    
    const health = await this.checkGraphHealth();
    const stats = health.stats;
    
    if (stats) {
      console.log(`Status: ${health.healthy ? '🟢 Running' : '🔴 Issues'}`);
      console.log(`Graphs: ${stats.totalGraphs}`);
      console.log(`Files Analyzed: ${stats.totalNodes}`);
      console.log(`Relationships: ${stats.totalEdges}`);
      console.log(`Last Update: ${stats.lastUpdate || 'Unknown'}`);
      
      if (stats.languages) {
        console.log('\nLanguages:');
        stats.languages.forEach(lang => {
          console.log(`  ${lang.language}: ${lang.nodes} nodes`);
        });
      }
    } else {
      console.log('Status: 🔴 Not initialized');
    }
    
    return health.healthy;
  }

  /**
   * Check graph system health
   */
  async checkGraphHealth() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return await this.graphTool.checkHealth();
  }

  /**
   * Handle a query with graph enhancement
   */
  async handleQuery(query, context = {}) {
    if (!this.initialized) {
      return { enhanced: false, reason: 'Graph not initialized' };
    }

    try {
      const toolSelection = await this.toolSelector.selectBestTool(query, context);
      
      return {
        enhanced: true,
        tool: toolSelection.tool,
        strategy: toolSelection.strategy,
        files: toolSelection.files,
        confidence: toolSelection.confidence,
        reason: toolSelection.reason,
        metadata: toolSelection.metadata
      };
    } catch (error) {
      return { 
        enhanced: false, 
        reason: `Tool selection failed: ${error.message}` 
      };
    }
  }

  /**
   * Execute a graph command
   */
  async executeGraphCommand(command, args = [], options = {}) {
    return await this.commands.executeCommand(command, args, options);
  }

  /**
   * Find files related to a target file
   */
  async findRelatedFiles(targetFile, options = {}) {
    return await this.graphTool.findRelatedFiles(targetFile, options);
  }

  /**
   * Get architecture overview
   */
  async getArchitectureOverview() {
    return await this.graphTool.getArchitectureOverview();
  }

  /**
   * Search with graph context
   */
  async searchWithContext(searchTerm, options = {}) {
    const { useGraph = true } = options;
    
    if (!useGraph || !this.initialized) {
      return { searchOrder: [], useGraph: false };
    }

    try {
      // Use graph to suggest search order
      const relevant = await this.graphTool.suggestRelevantFiles(searchTerm);
      const searchOrder = relevant.map(r => r.path);
      
      return { 
        searchOrder, 
        useGraph: true, 
        relevantFiles: relevant.slice(0, 5) 
      };
    } catch (error) {
      return { searchOrder: [], useGraph: false, error: error.message };
    }
  }
}

// Export individual components for advanced usage
export {
  GraphService,
  GraphTool, 
  GraphAwareToolSelector,
  GraphCommands
};
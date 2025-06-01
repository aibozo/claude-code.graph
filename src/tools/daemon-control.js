#!/usr/bin/env node

/**
 * Daemon Control Tool for Claude Code Graph
 * Allows Claude to check and control the graph daemon status
 */

import { GraphTool } from '../graph/GraphTool.js';
import { resolve } from 'path';

const DEFAULT_ROOT = process.cwd();

/**
 * Get daemon status for Claude's context
 */
export async function getDaemonStatus(rootPath = DEFAULT_ROOT) {
  try {
    const graphTool = new GraphTool(resolve(rootPath));
    const status = await graphTool.checkDaemonStatus();
    
    return {
      success: true,
      status: status.status,
      running: status.running,
      details: {
        pid: status.pid,
        uptime: status.uptime,
        updates: status.updates,
        error: status.error
      }
    };
  } catch (error) {
    return {
      success: false,
      status: 'Graph Daemon: ERROR',
      running: false,
      error: error.message
    };
  }
}

/**
 * Start the daemon
 */
export async function startDaemon(rootPath = DEFAULT_ROOT) {
  try {
    const graphTool = new GraphTool(resolve(rootPath));
    const result = await graphTool.startDaemon();
    
    return {
      success: result.success,
      message: result.message,
      status: result.status.status,
      running: result.status.running
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to start daemon: ${error.message}`,
      status: 'Graph Daemon: ERROR',
      running: false
    };
  }
}

/**
 * Stop the daemon
 */
export async function stopDaemon(rootPath = DEFAULT_ROOT) {
  try {
    const graphTool = new GraphTool(resolve(rootPath));
    const result = await graphTool.stopDaemon();
    
    return {
      success: result.success,
      message: result.message,
      status: result.status.status,
      running: result.status.running
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to stop daemon: ${error.message}`,
      status: 'Graph Daemon: ERROR',
      running: false
    };
  }
}

/**
 * Get graph system health including daemon
 */
export async function getGraphHealth(rootPath = DEFAULT_ROOT) {
  try {
    const graphTool = new GraphTool(resolve(rootPath));
    await graphTool.initialize();
    
    const health = await graphTool.checkHealth();
    const daemonStatus = await graphTool.checkDaemonStatus();
    
    return {
      success: true,
      healthy: health.healthy,
      daemon: {
        status: daemonStatus.status,
        running: daemonStatus.running,
        updates: daemonStatus.updates || 0
      },
      graphs: {
        total: health.stats?.totalGraphs || 0,
        nodes: health.stats?.totalNodes || 0,
        edges: health.stats?.totalEdges || 0
      },
      issues: health.issues || []
    };
  } catch (error) {
    return {
      success: false,
      healthy: false,
      error: error.message,
      daemon: { status: 'Graph Daemon: ERROR', running: false }
    };
  }
}

/**
 * Get optimized context for Claude
 */
export async function getClaudeContext(rootPath = DEFAULT_ROOT, options = {}) {
  try {
    const graphTool = new GraphTool(resolve(rootPath));
    await graphTool.initialize();
    
    const context = await graphTool.getContextSummary(options);
    const daemonStatus = await graphTool.checkDaemonStatus();
    
    // Combine graph context with daemon status
    const fullContext = `${context.compact} | ${daemonStatus.status}`;
    
    return {
      success: true,
      context: fullContext,
      detailed: {
        ...context.detailed,
        daemon: {
          status: daemonStatus.status,
          running: daemonStatus.running
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      context: "Graph: ERROR | Daemon: OFF",
      error: error.message
    };
  }
}

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, command, rootPath] = process.argv;
  
  switch (command) {
    case 'status':
      const status = await getDaemonStatus(rootPath);
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case 'start':
      const startResult = await startDaemon(rootPath);
      console.log(JSON.stringify(startResult, null, 2));
      break;
      
    case 'stop':
      const stopResult = await stopDaemon(rootPath);
      console.log(JSON.stringify(stopResult, null, 2));
      break;
      
    case 'health':
      const health = await getGraphHealth(rootPath);
      console.log(JSON.stringify(health, null, 2));
      break;
      
    default:
      console.log('Usage: daemon-control.js <status|start|stop|health> [rootPath]');
      process.exit(1);
  }
}
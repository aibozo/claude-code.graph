/**
 * TodoMonitor - Real-time monitoring of Claude's todo interactions
 * This is our "man in the middle" system
 */

import { TodoGraphBridge } from './TodoGraphBridge.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, watch } from 'fs';
import path from 'path';

export class TodoMonitor {
  constructor(rootPath = '.') {
    this.rootPath = rootPath;
    this.bridge = new TodoGraphBridge(rootPath);
    this.monitoringActive = false;
    this.lastTodoSnapshot = null;
    this.logPath = path.join(rootPath, '.graph', 'todo-monitor.log');
  }

  /**
   * Start monitoring Claude's todo calls
   * Since we can't actually intercept the tool calls, we'll monitor the state changes
   */
  async startMonitoring() {
    this.monitoringActive = true;
    console.log('🔍 Todo Monitor: Starting real-time todo analysis...');
    
    // Take initial snapshot
    this.lastTodoSnapshot = await this.getCurrentTodos();
    
    // Monitor for changes (we'll check periodically since we can't intercept directly)
    this.monitoringInterval = setInterval(async () => {
      await this.checkForTodoChanges();
    }, 1000); // Check every second
    
    await this.log('TodoMonitor started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.monitoringActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('🛑 Todo Monitor: Stopped');
  }

  /**
   * Since we can't intercept TodoRead directly, we'll simulate getting current state
   * In practice, this would need integration with Claude Code's todo system
   */
  async getCurrentTodos() {
    // For now, return our test todos - in reality this would call TodoRead
    return [
      {
        id: "perf-fix-1",
        content: "Fix performance bottleneck in src/graph/GraphClustering.js around line 145", 
        status: "pending",
        priority: "high"
      },
      {
        id: "cluster-org-1",
        content: "Update cluster c2 to include better file organization",
        status: "pending", 
        priority: "medium"
      },
      {
        id: "todo-intercept-1",
        content: "Build todo interception system to capture TodoRead/TodoWrite calls",
        status: "completed",
        priority: "high"
      }
    ];
  }

  /**
   * Check for changes in todo state
   */
  async checkForTodoChanges() {
    if (!this.monitoringActive) return;

    try {
      const currentTodos = await this.getCurrentTodos();
      
      if (this.lastTodoSnapshot) {
        const changes = this.detectChanges(this.lastTodoSnapshot, currentTodos);
        
        if (changes.length > 0) {
          console.log(`📝 Todo Monitor: Detected ${changes.length} changes`);
          
          // Process changes through our bridge
          for (const change of changes) {
            await this.bridge.interceptTodoCall(change.type, [change.todo]);
            await this.log(`${change.type}: ${change.todo.id} - ${change.description}`);
          }
        }
      }
      
      this.lastTodoSnapshot = currentTodos;
    } catch (error) {
      console.warn('Todo Monitor error:', error.message);
    }
  }

  /**
   * Detect changes between todo snapshots
   */
  detectChanges(oldTodos, newTodos) {
    const changes = [];
    const oldMap = new Map(oldTodos.map(t => [t.id, t]));
    const newMap = new Map(newTodos.map(t => [t.id, t]));

    // Find new todos
    for (const [id, todo] of newMap) {
      if (!oldMap.has(id)) {
        changes.push({
          type: 'TodoWrite',
          operation: 'created',
          todo,
          description: `Created new todo: ${todo.content.substring(0, 50)}...`
        });
      }
    }

    // Find modified todos
    for (const [id, newTodo] of newMap) {
      const oldTodo = oldMap.get(id);
      if (oldTodo && (
        oldTodo.status !== newTodo.status ||
        oldTodo.content !== newTodo.content ||
        oldTodo.priority !== newTodo.priority
      )) {
        changes.push({
          type: 'TodoWrite',
          operation: 'modified',
          todo: newTodo,
          oldTodo,
          description: `Modified todo: ${newTodo.id} (${oldTodo.status} → ${newTodo.status})`
        });
      }
    }

    // Find deleted todos
    for (const [id, todo] of oldMap) {
      if (!newMap.has(id)) {
        changes.push({
          type: 'TodoWrite',
          operation: 'deleted',
          todo,
          description: `Deleted todo: ${todo.content.substring(0, 50)}...`
        });
      }
    }

    return changes;
  }

  /**
   * Log monitoring events
   */
  async log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      if (existsSync(this.logPath)) {
        const existing = await readFile(this.logPath, 'utf8');
        await writeFile(this.logPath, existing + logEntry);
      } else {
        await writeFile(this.logPath, logEntry);
      }
    } catch (error) {
      console.warn('Failed to write monitor log:', error.message);
    }
  }

  /**
   * Get current todo-graph analysis
   */
  async getAnalysis() {
    const report = this.bridge.generateReport();
    const currentTodos = await this.getCurrentTodos();
    
    return {
      todoCount: currentTodos.length,
      mappedTodos: report.totalMappings,
      clusterAffected: Object.keys(report.clusterTodos),
      filesAffected: Object.keys(report.fileTodos),
      report
    };
  }

  /**
   * Manual trigger for analyzing current todos (for testing)
   */
  async analyzeCurrentTodos() {
    console.log('🔍 Analyzing current todo state...');
    const currentTodos = await this.getCurrentTodos();
    
    if (currentTodos.length > 0) {
      await this.bridge.interceptTodoCall('TodoRead', currentTodos);
      const analysis = await this.getAnalysis();
      
      console.log('📊 Current Analysis:');
      console.log(`- Total todos: ${analysis.todoCount}`);
      console.log(`- Mapped to graph: ${analysis.mappedTodos}`);
      console.log(`- Clusters affected: ${analysis.clusterAffected.join(', ')}`);
      console.log(`- Files affected: ${analysis.filesAffected.join(', ')}`);
      
      return analysis;
    }
    
    return null;
  }
}
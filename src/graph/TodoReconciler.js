/**
 * TodoReconciler - Smart reconciliation of todo-graph state across sessions
 */

import { TodoGraphBridge } from './TodoGraphBridge.js';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export class TodoReconciler {
  constructor(rootPath = '.') {
    this.rootPath = rootPath;
    this.bridge = new TodoGraphBridge(rootPath);
    this.sessionPath = path.join(rootPath, '.graph', 'session-state.json');
  }

  /**
   * Check for session restart and provide reconciliation guidance
   */
  async checkSessionContinuity() {
    console.log('🔍 Checking session continuity...');
    
    // Load previous session state
    const previousState = await this.loadPreviousSession();
    
    if (!previousState) {
      console.log('✨ New session detected - no reconciliation needed');
      return { isNewSession: true, recommendations: [] };
    }

    console.log(`📊 Previous session: ${previousState.todoCount} todos from ${previousState.timestamp}`);
    
    // Get current todo state (would come from TodoRead in real usage)
    const currentTodos = await this.getCurrentTodoState();
    
    if (currentTodos.length === 0) {
      console.log('🚨 Session restart detected - todos lost but graph data persisted');
      return await this.generateRestartGuidance(previousState);
    }

    // Check for overlaps and changes
    return await this.generateContinuityGuidance(previousState, currentTodos);
  }

  /**
   * Generate guidance for session restart scenario
   */
  async generateRestartGuidance(previousState) {
    const recommendations = [];
    
    // Categorize previous todos by importance
    const importantTodos = previousState.todos.filter(t => 
      t.status === 'in_progress' || (t.status === 'pending' && t.priority === 'high')
    );
    
    const otherTodos = previousState.todos.filter(t => 
      t.status === 'pending' && t.priority !== 'high'
    );

    if (importantTodos.length > 0) {
      recommendations.push({
        type: 'restore_critical',
        priority: 'high',
        title: '🚨 Restore Critical Work',
        message: `${importantTodos.length} important todos were lost in session restart`,
        todos: importantTodos.map(t => ({
          suggested: this.generateTodoSuggestion(t),
          original: t.content,
          reason: t.status === 'in_progress' ? 'was in progress' : 'high priority'
        })),
        action: 'Consider recreating these todos to continue important work'
      });
    }

    if (otherTodos.length > 0) {
      recommendations.push({
        type: 'review_lost',
        priority: 'medium', 
        title: '📋 Review Lost Todos',
        message: `${otherTodos.length} other todos were also lost`,
        todos: otherTodos.slice(0, 5).map(t => ({ // Show max 5
          original: t.content,
          clusters: this.extractClusters(t),
          files: this.extractFiles(t)
        })),
        action: `Review if any of these ${otherTodos.length} todos are still relevant`
      });
    }

    return {
      isSessionRestart: true,
      previousTodoCount: previousState.todoCount,
      currentTodoCount: 0,
      recommendations
    };
  }

  /**
   * Generate smart todo suggestion based on previous todo
   */
  generateTodoSuggestion(previousTodo) {
    const { content, status, priority } = previousTodo;
    
    // Clean up and enhance the suggestion
    let suggestion = content;
    
    // Add status context
    if (status === 'in_progress') {
      suggestion = `Continue: ${suggestion}`;
    }
    
    // Enhance with specific file/cluster context if available
    const files = this.extractFiles(previousTodo);
    const clusters = this.extractClusters(previousTodo);
    
    if (files.length > 0 && !suggestion.includes(files[0])) {
      suggestion += ` (${files[0]})`;
    } else if (clusters.length > 0 && !suggestion.toLowerCase().includes('cluster')) {
      suggestion += ` (cluster ${clusters[0]})`;
    }
    
    return suggestion;
  }

  /**
   * Generate guidance for session continuity (no restart)
   */
  async generateContinuityGuidance(previousState, currentTodos) {
    const recommendations = [];
    
    // Check for duplicate work
    const duplicates = await this.findDuplicateWork(previousState.todos, currentTodos);
    
    if (duplicates.length > 0) {
      recommendations.push({
        type: 'avoid_duplicates',
        priority: 'medium',
        title: '🔄 Potential Duplicate Work',
        message: `${duplicates.length} todos may duplicate previous work`,
        duplicates: duplicates.map(d => ({
          current: d.currentTodo.content,
          previous: d.previousTodo.content,
          similarity: Math.round(d.similarity * 100)
        })),
        action: 'Consider if these todos are actually duplicates'
      });
    }

    // Check for scope changes
    const scopeChanges = this.detectScopeChanges(previousState.todos, currentTodos);
    
    if (scopeChanges.length > 0) {
      recommendations.push({
        type: 'scope_changes',
        priority: 'low',
        title: '📈 Scope Evolution',
        message: `${scopeChanges.length} todos have evolved in scope`,
        changes: scopeChanges,
        action: 'This is normal evolution - just noting the changes'
      });
    }

    return {
      isSessionRestart: false,
      previousTodoCount: previousState.todoCount,
      currentTodoCount: currentTodos.length,
      recommendations
    };
  }

  /**
   * Save current session state for future reconciliation
   */
  async saveSessionState(todos) {
    const sessionState = {
      timestamp: new Date().toISOString(),
      todoCount: todos.length,
      todos: todos.map(t => ({
        id: t.id,
        content: t.content,
        status: t.status,
        priority: t.priority,
        clusters: this.extractClusters(t),
        files: this.extractFiles(t)
      }))
    };

    try {
      await writeFile(this.sessionPath, JSON.stringify(sessionState, null, 2));
      console.log(`💾 Session state saved (${todos.length} todos)`);
    } catch (error) {
      console.warn('Failed to save session state:', error.message);
    }
  }

  /**
   * Load previous session state
   */
  async loadPreviousSession() {
    try {
      const data = await readFile(this.sessionPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null; // No previous session
    }
  }

  /**
   * Get current todo state (mock - in real usage would call TodoRead)
   */
  async getCurrentTodoState() {
    // This would be replaced with actual TodoRead call
    // For testing, return empty (simulating session restart)
    return [];
  }

  /**
   * Find duplicate work between todo sets
   */
  async findDuplicateWork(previousTodos, currentTodos) {
    const duplicates = [];
    
    for (const currentTodo of currentTodos) {
      const currentAnalysis = await this.bridge.analyzeTodoContent(currentTodo);
      
      for (const previousTodo of previousTodos) {
        const previousAnalysis = {
          fileReferences: this.extractFiles(previousTodo),
          clusterReferences: this.extractClusters(previousTodo)
        };
        
        const similarity = this.calculateSimilarity(currentAnalysis, previousAnalysis);
        
        if (similarity > 0.5) {
          duplicates.push({
            currentTodo,
            previousTodo,
            similarity
          });
          break; // Only match to first similar todo
        }
      }
    }
    
    return duplicates;
  }

  /**
   * Detect todos that have evolved in scope
   */
  detectScopeChanges(previousTodos, currentTodos) {
    const changes = [];
    
    // Find todos with same ID but different content
    for (const currentTodo of currentTodos) {
      const previousTodo = previousTodos.find(p => p.id === currentTodo.id);
      
      if (previousTodo && previousTodo.content !== currentTodo.content) {
        changes.push({
          id: currentTodo.id,
          before: previousTodo.content,
          after: currentTodo.content,
          scope: currentTodo.content.length > previousTodo.content.length ? 'expanded' : 'narrowed'
        });
      }
    }
    
    return changes;
  }

  /**
   * Helper methods for extracting file/cluster info
   */
  extractFiles(todo) {
    // Extract from graph mappings if available, or parse content
    const filePattern = /(?:^|\s)([a-zA-Z0-9_\-\/\.]+\.[a-zA-Z]{2,4})(?=\s|$|:|,|;)/g;
    const files = [];
    let match;
    
    while ((match = filePattern.exec(todo.content)) !== null) {
      files.push(match[1]);
    }
    
    return files;
  }

  extractClusters(todo) {
    const clusterPattern = /\bc(\d+)\b/g;
    const clusters = [];
    let match;
    
    while ((match = clusterPattern.exec(todo.content)) !== null) {
      clusters.push(`c${match[1]}`);
    }
    
    return clusters;
  }

  /**
   * Calculate similarity between todo analyses
   */
  calculateSimilarity(analysis1, analysis2) {
    let similarity = 0;
    let factors = 0;

    // File overlap
    const fileOverlap = this.calculateArrayOverlap(
      analysis1.fileReferences || [], 
      analysis2.fileReferences || []
    );
    if (fileOverlap > 0) {
      similarity += fileOverlap * 0.6;
      factors++;
    }

    // Cluster overlap  
    const clusterOverlap = this.calculateArrayOverlap(
      analysis1.clusterReferences || [],
      analysis2.clusterReferences || []
    );
    if (clusterOverlap > 0) {
      similarity += clusterOverlap * 0.4;
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  calculateArrayOverlap(arr1, arr2) {
    if (arr1.length === 0 || arr2.length === 0) return 0;
    
    const set1 = new Set(arr1.map(s => s.toLowerCase()));
    const set2 = new Set(arr2.map(s => s.toLowerCase()));
    
    let matches = 0;
    for (const item of set1) {
      if (set2.has(item) || Array.from(set2).some(s2 => 
        item.includes(s2) || s2.includes(item)
      )) {
        matches++;
      }
    }
    
    return matches / Math.max(set1.size, set2.size);
  }

  /**
   * Display reconciliation recommendations to user
   */
  displayRecommendations(reconciliation) {
    if (reconciliation.recommendations.length === 0) {
      console.log('✅ No reconciliation issues detected');
      return;
    }

    console.log('\n💡 RECONCILIATION RECOMMENDATIONS:\n');
    
    for (const rec of reconciliation.recommendations) {
      const priorityIcon = { high: '🚨', medium: '⚠️', low: 'ℹ️' }[rec.priority];
      console.log(`${priorityIcon} ${rec.title}`);
      console.log(`   ${rec.message}`);
      console.log(`   → ${rec.action}\n`);
      
      // Show specific details based on type
      if (rec.type === 'restore_critical' && rec.todos) {
        console.log('   Suggested recreations:');
        rec.todos.slice(0, 3).forEach(todo => {
          console.log(`   📝 "${todo.suggested}" (was ${todo.reason})`);
        });
        if (rec.todos.length > 3) {
          console.log(`   ... and ${rec.todos.length - 3} more`);
        }
        console.log('');
      }
    }
  }
}
/**
 * TodoGraphBridge - Intercepts and analyzes todo interactions to map them to graph nodes
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export class TodoGraphBridge {
  constructor(rootPath = '.') {
    this.rootPath = rootPath;
    this.graphPath = path.join(rootPath, '.graph');
    this.todoLogPath = path.join(this.graphPath, 'todo-log.json');
    this.todoMappingPath = path.join(this.graphPath, 'todo-mapping.json');
    this.superGraphPath = path.join(this.graphPath, 'supergraph.json');
    
    // Initialize todo tracking
    this.todoLog = [];
    this.todoMappings = new Map();
    this.loadExistingData();
  }

  async loadExistingData() {
    try {
      if (existsSync(this.todoLogPath)) {
        const data = await readFile(this.todoLogPath, 'utf8');
        this.todoLog = JSON.parse(data);
      }
      
      if (existsSync(this.todoMappingPath)) {
        const data = await readFile(this.todoMappingPath, 'utf8');
        const mappings = JSON.parse(data);
        this.todoMappings = new Map(Object.entries(mappings));
      }
    } catch (error) {
      console.warn('Failed to load existing todo data:', error.message);
    }
  }

  /**
   * Intercept and analyze a todo interaction
   */
  async interceptTodoCall(callType, todos, timestamp = new Date().toISOString()) {
    const logEntry = {
      timestamp,
      callType, // 'TodoRead' or 'TodoWrite'
      todos: Array.isArray(todos) ? todos : [],
      mappings: {}
    };

    // Analyze each todo for file/graph references
    if (Array.isArray(todos)) {
      for (const todo of todos) {
        const analysis = await this.analyzeTodoContent(todo);
        if (analysis.graphReferences.length > 0) {
          logEntry.mappings[todo.id] = analysis;
        }
      }
    }

    this.todoLog.push(logEntry);
    await this.persistData();
    
    console.log(`📝 Todo Bridge: Captured ${callType} with ${Object.keys(logEntry.mappings).length} graph mappings`);
    
    return logEntry;
  }

  /**
   * Analyze todo content for file paths, cluster references, and graph nodes
   */
  async analyzeTodoContent(todo) {
    const content = todo.content || '';
    const analysis = {
      todoId: todo.id,
      status: todo.status,
      priority: todo.priority,
      graphReferences: [],
      fileReferences: [],
      clusterReferences: [],
      confidence: 0
    };

    // Extract file paths with improved patterns and deduplication
    const fileSet = new Set();
    
    // Pattern 1: Explicit file extensions
    const fileExtPattern = /(?:^|\s)([a-zA-Z0-9_\-\/\.]+\.[a-zA-Z]{2,4})(?=\s|$|:|,|;)/g;
    let match;
    while ((match = fileExtPattern.exec(content)) !== null) {
      const filePath = match[1];
      if (filePath.length > 3 && !filePath.startsWith('.') && !filePath.endsWith('.')) {
        fileSet.add(filePath);
        analysis.confidence += 0.4;
      }
    }
    
    // Pattern 2: Directory paths (only if they look like code paths)
    const dirPattern = /(?:^|\s)((?:src|lib|tests?|bin|tools?|graph)\/[a-zA-Z0-9_\-\/]+)(?=\s|$)/g;
    while ((match = dirPattern.exec(content)) !== null) {
      const dirPath = match[1];
      if (dirPath.length > 4) {
        fileSet.add(dirPath);
        analysis.confidence += 0.3;
      }
    }
    
    // Pattern 3: Relative paths with ./
    const relativePattern = /(?:\.\/)([a-zA-Z0-9_\-\/\.]+)/g;
    while ((match = relativePattern.exec(content)) !== null) {
      const relPath = `./${match[1]}`;
      if (relPath.length > 3) {
        fileSet.add(relPath);
        analysis.confidence += 0.3;
      }
    }
    
    // Pattern 4: Context keywords + file paths
    const contextPattern = /(?:in|file|from|update|fix|modify)\s+([a-zA-Z0-9_\-\/\.]+(?:\.[a-zA-Z]{2,4})?)/gi;
    while ((match = contextPattern.exec(content)) !== null) {
      const contextFile = match[1];
      if (contextFile.length > 3 && (contextFile.includes('/') || contextFile.includes('.'))) {
        fileSet.add(contextFile);
        analysis.confidence += 0.5;
      }
    }

    analysis.fileReferences = Array.from(fileSet);

    // Extract cluster references (c0, c1, etc.) - more precise
    const clusterPattern = /\bcluster\s+c(\d+)\b|\bc(\d+)\s+cluster\b|\bc(\d+)\b/gi;
    const clusterSet = new Set();
    while ((match = clusterPattern.exec(content)) !== null) {
      const clusterId = `c${match[1] || match[2] || match[3]}`;
      clusterSet.add(clusterId);
      analysis.confidence += 0.4;
    }
    analysis.clusterReferences = Array.from(clusterSet);

    // Map to actual graph nodes
    await this.mapToGraphNodes(analysis);

    return analysis;
  }

  /**
   * Map file/cluster references to actual graph nodes
   */
  async mapToGraphNodes(analysis) {
    try {
      // Load super-graph for cluster mapping
      if (existsSync(this.superGraphPath)) {
        const superGraph = JSON.parse(await readFile(this.superGraphPath, 'utf8'));
        
        // Map cluster references
        for (const clusterId of analysis.clusterReferences) {
          if (superGraph.clusters[clusterId]) {
            analysis.graphReferences.push({
              type: 'cluster',
              id: clusterId,
              files: superGraph.clusters[clusterId].fileList || [],
              confidence: 0.8
            });
          }
        }

        // Map file references to clusters
        for (const filePath of analysis.fileReferences) {
          const normalizedPath = this.normalizePath(filePath);
          
          // Find which cluster contains this file
          for (const [clusterId, cluster] of Object.entries(superGraph.clusters)) {
            if (cluster.fileList && cluster.fileList.some(f => 
              this.normalizePath(f).includes(normalizedPath) || 
              normalizedPath.includes(this.normalizePath(f))
            )) {
              analysis.graphReferences.push({
                type: 'file_in_cluster',
                clusterId,
                filePath: normalizedPath,
                confidence: 0.6
              });
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to map to graph nodes:', error.message);
    }
  }

  /**
   * Normalize file paths for better matching
   */
  normalizePath(filePath) {
    return filePath
      .replace(/^\.\//, '')
      .replace(/^src\//, '')
      .replace(/\\/g, '/')
      .toLowerCase();
  }

  /**
   * Get todo-graph mappings for a specific todo or all todos
   */
  getTodoMappings(todoId = null) {
    if (todoId) {
      const relevant = this.todoLog
        .filter(entry => entry.mappings[todoId])
        .map(entry => entry.mappings[todoId]);
      return relevant.length > 0 ? relevant[relevant.length - 1] : null;
    }

    // Return all current mappings
    const currentMappings = {};
    for (const entry of this.todoLog.slice(-10)) { // Last 10 entries
      Object.assign(currentMappings, entry.mappings);
    }
    return currentMappings;
  }

  /**
   * Get todos affecting a specific cluster or file
   */
  getTodosForGraphNode(nodeId) {
    const affectingTodos = [];
    
    for (const entry of this.todoLog) {
      for (const [todoId, mapping] of Object.entries(entry.mappings)) {
        for (const ref of mapping.graphReferences) {
          if (ref.id === nodeId || ref.clusterId === nodeId || 
              (ref.filePath && ref.filePath.includes(nodeId))) {
            affectingTodos.push({
              todoId,
              mapping,
              timestamp: entry.timestamp,
              status: mapping.status
            });
          }
        }
      }
    }

    return affectingTodos;
  }

  /**
   * Persist todo data to disk
   */
  async persistData() {
    try {
      await writeFile(this.todoLogPath, JSON.stringify(this.todoLog, null, 2));
      
      const mappingsObj = Object.fromEntries(this.todoMappings);
      await writeFile(this.todoMappingPath, JSON.stringify(mappingsObj, null, 2));
    } catch (error) {
      console.warn('Failed to persist todo data:', error.message);
    }
  }

  /**
   * Generate a report of todo-graph relationships
   */
  generateReport() {
    const mappings = this.getTodoMappings();
    const clusters = {};
    const files = {};
    
    for (const [todoId, mapping] of Object.entries(mappings)) {
      for (const ref of mapping.graphReferences) {
        if (ref.type === 'cluster') {
          if (!clusters[ref.id]) clusters[ref.id] = [];
          clusters[ref.id].push({ todoId, status: mapping.status, priority: mapping.priority });
        } else if (ref.type === 'file_in_cluster') {
          if (!files[ref.filePath]) files[ref.filePath] = [];
          files[ref.filePath].push({ todoId, status: mapping.status, priority: mapping.priority });
        }
      }
    }

    return {
      clusterTodos: clusters,
      fileTodos: files,
      totalMappings: Object.keys(mappings).length,
      timestamp: new Date().toISOString()
    };
  }
}
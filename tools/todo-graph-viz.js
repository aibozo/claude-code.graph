#!/usr/bin/env node

/**
 * Simple visualization of todo-graph connections for debugging
 */

import { TodoGraphBridge } from '../src/graph/TodoGraphBridge.js';
import { readFile } from 'fs/promises';
import path from 'path';

class TodoGraphVisualizer {
  constructor(rootPath = '.') {
    this.rootPath = rootPath;
    this.bridge = new TodoGraphBridge(rootPath);
  }

  async generateVisualization() {
    console.log('🎨 Generating Todo-Graph Visualization\n');
    
    // Ensure bridge loads existing data
    await this.bridge.loadExistingData();
    
    // Get current todo mappings
    const mappings = this.bridge.getTodoMappings();
    const report = this.bridge.generateReport();
    
    if (Object.keys(mappings).length === 0) {
      console.log('📝 No todo-graph mappings found. Create some todos with file references first!');
      return;
    }

    // Load super-graph for cluster info
    let clusters = {};
    try {
      const superGraphPath = path.join(this.rootPath, '.graph', 'supergraph.json');
      const superGraph = JSON.parse(await readFile(superGraphPath, 'utf8'));
      clusters = superGraph.clusters;
    } catch (error) {
      console.warn('⚠️ Could not load cluster data:', error.message);
    }

    console.log('📊 Todo-Graph Connection Map\n');
    console.log('=' .repeat(60));
    
    // Show overall stats
    console.log(`📈 Summary:`);
    console.log(`  Total todos: ${Object.keys(mappings).length}`);
    console.log(`  Clusters affected: ${Object.keys(report.clusterTodos).length}`);
    console.log(`  Files affected: ${Object.keys(report.fileTodos).length}`);
    console.log('');

    // Visualize by cluster
    console.log('🗂️  Cluster View:');
    for (const [clusterId, todos] of Object.entries(report.clusterTodos)) {
      const cluster = clusters[clusterId] || { description: 'Unknown cluster', files: 0 };
      console.log(`\n  📁 ${clusterId}: ${cluster.description}`);
      console.log(`     Files: ${cluster.files}, Languages: ${(cluster.languages || []).join(', ')}`);
      
      for (const todo of todos) {
        const statusIcon = this.getStatusIcon(todo.status);
        const priorityColor = this.getPriorityColor(todo.priority);
        console.log(`     ${statusIcon} ${todo.todoId} (${priorityColor}${todo.priority}\x1b[0m)`);
      }
    }

    // Visualize by file
    console.log('\n📄 File View:');
    for (const [filePath, todos] of Object.entries(report.fileTodos)) {
      console.log(`\n  📄 ${filePath}`);
      
      for (const todo of todos) {
        const statusIcon = this.getStatusIcon(todo.status);
        const priorityColor = this.getPriorityColor(todo.priority);
        console.log(`     ${statusIcon} ${todo.todoId} (${priorityColor}${todo.priority}\x1b[0m)`);
      }
    }

    // Show connection details
    console.log('\n🔗 Connection Details:');
    for (const [todoId, mapping] of Object.entries(mappings)) {
      console.log(`\n  📝 ${todoId}:`);
      console.log(`     Status: ${this.getStatusIcon(mapping.status)} ${mapping.status}`);
      console.log(`     Priority: ${this.getPriorityColor(mapping.priority)}${mapping.priority}\x1b[0m`);
      console.log(`     Confidence: ${mapping.confidence.toFixed(2)}`);
      
      if (mapping.fileReferences.length > 0) {
        console.log(`     Files: ${mapping.fileReferences.join(', ')}`);
      }
      
      if (mapping.clusterReferences.length > 0) {
        console.log(`     Clusters: ${mapping.clusterReferences.join(', ')}`);
      }
      
      if (mapping.graphReferences.length > 0) {
        console.log(`     Graph refs: ${mapping.graphReferences.length}`);
        for (const ref of mapping.graphReferences) {
          console.log(`       → ${ref.type}: ${ref.id || ref.clusterId} (conf: ${ref.confidence})`);
        }
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Visualization complete!');
  }

  getStatusIcon(status) {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'pending': return '⏳';
      default: return '❓';
    }
  }

  getPriorityColor(priority) {
    switch (priority) {
      case 'high': return '\x1b[31m'; // Red
      case 'medium': return '\x1b[33m'; // Yellow  
      case 'low': return '\x1b[32m'; // Green
      default: return '\x1b[37m'; // White
    }
  }

  async generateSimpleGraph() {
    console.log('\n📈 Simple ASCII Graph:\n');
    
    const mappings = this.bridge.getTodoMappings();
    const report = this.bridge.generateReport();
    
    // Simple representation
    const todos = Object.keys(mappings);
    const clusters = Object.keys(report.clusterTodos);
    
    console.log('Todos        Clusters');
    console.log('-----        --------');
    
    const maxLines = Math.max(todos.length, clusters.length);
    for (let i = 0; i < maxLines; i++) {
      const todo = todos[i] || '';
      const cluster = clusters[i] || '';
      const connector = (todo && cluster) ? ' ──── ' : '      ';
      console.log(`${todo.padEnd(12)}${connector}${cluster}`);
    }
  }
}

// Run visualization
async function main() {
  const viz = new TodoGraphVisualizer('.');
  await viz.generateVisualization();
  await viz.generateSimpleGraph();
}

main().catch(console.error);
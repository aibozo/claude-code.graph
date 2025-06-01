#!/usr/bin/env node

/**
 * End-to-end test of the complete todo-graph system
 */

import { TodoMonitor } from './src/graph/TodoMonitor.js';

async function testEndToEnd() {
  console.log('🧪 End-to-End Todo-Graph System Test\n');
  
  const monitor = new TodoMonitor('.');
  
  // Simulate a realistic todo workflow with current file references
  const realisticTodos = [
    {
      id: "perf-fix-clustering",
      content: "Fix performance bottleneck in src/graph/GraphClustering.js around line 145",
      status: "pending",
      priority: "high"
    },
    {
      id: "update-c2-organization", 
      content: "Update cluster c2 to include better file organization",
      status: "pending",
      priority: "medium"
    },
    {
      id: "test-todo-bridge",
      content: "Add tests for TodoGraphBridge.js functionality",
      status: "in_progress",
      priority: "medium"
    },
    {
      id: "optimize-treesitter",
      content: "Optimize memory usage in ./tools/fast-treesitter.js for large files", 
      status: "pending",
      priority: "low"
    },
    {
      id: "refactor-graph-commands",
      content: "Refactor graph/GraphCommands.js to improve command handling",
      status: "completed",
      priority: "medium"
    }
  ];

  console.log('📝 Simulating todo workflow...');
  
  // Process todos through the bridge
  for (const todo of realisticTodos) {
    console.log(`Processing: ${todo.id}`);
    await monitor.bridge.interceptTodoCall('TodoWrite', [todo]);
  }
  
  console.log('\n🔍 Analyzing captured data...');
  const analysis = await monitor.getAnalysis();
  
  console.log('📊 System Analysis:');
  console.log(`- Total todos: ${analysis.todoCount}`);
  console.log(`- Mapped to graph: ${analysis.mappedTodos}`);
  console.log(`- Clusters affected: ${analysis.clusterAffected.join(', ') || 'none'}`);
  console.log(`- Files affected: ${analysis.filesAffected.join(', ') || 'none'}`);
  
  // Test specific mappings
  console.log('\n🎯 Testing specific mappings:');
  const perfMapping = monitor.bridge.getTodoMappings('perf-fix-clustering');
  if (perfMapping) {
    console.log(`✅ Performance todo mapped to: ${perfMapping.graphReferences.length} graph nodes`);
    console.log(`   Files: ${perfMapping.fileReferences.join(', ')}`);
    console.log(`   Confidence: ${perfMapping.confidence.toFixed(2)}`);
  }
  
  const clusterMapping = monitor.bridge.getTodoMappings('update-c2-organization');
  if (clusterMapping) {
    console.log(`✅ Cluster todo mapped to: ${clusterMapping.graphReferences.length} graph nodes`);
    console.log(`   Clusters: ${clusterMapping.clusterReferences.join(', ')}`);
    console.log(`   Confidence: ${clusterMapping.confidence.toFixed(2)}`);
  }
  
  // Test todo retrieval for graph nodes
  console.log('\n🗂️ Testing reverse lookup (todos affecting graph nodes):');
  const c2Todos = monitor.bridge.getTodosForGraphNode('c2');
  console.log(`Todos affecting cluster c2: ${c2Todos.length}`);
  
  for (const todoRef of c2Todos.slice(0, 3)) {
    console.log(`  - ${todoRef.todoId}: ${todoRef.mapping.status}`);
  }
  
  console.log('\n✅ End-to-end test complete!');
  console.log('💡 Now run: node tools/todo-graph-viz.js');
  
  return analysis;
}

testEndToEnd().catch(console.error);
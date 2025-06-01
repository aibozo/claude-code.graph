#!/usr/bin/env node

/**
 * Test script to demonstrate todo interception and analysis
 */

import { TodoGraphBridge } from './src/graph/TodoGraphBridge.js';

async function testTodoInterception() {
  console.log('🧪 Testing Todo-Graph Bridge System\n');
  
  const bridge = new TodoGraphBridge('.');
  
  // Simulate the todos we just created with various file references
  const testTodos = [
    {
      id: "todo-intercept-1",
      content: "Build todo interception system to capture TodoRead/TodoWrite calls",
      status: "in_progress",
      priority: "high"
    },
    {
      id: "todo-match-2", 
      content: "Design todo-to-graph-node matching algorithm using file paths in src/graph/TodoGraphBridge.js",
      status: "pending",
      priority: "high"
    },
    {
      id: "todo-test-3",
      content: "Test todo interception with sample tasks containing file references like graph/ClusterTools.js and c2 cluster",
      status: "pending", 
      priority: "medium"
    },
    {
      id: "file-specific-task",
      content: "Fix performance issue in ./tools/fast-treesitter.js line 42",
      status: "pending",
      priority: "high"
    },
    {
      id: "cluster-task",
      content: "Refactor c0 cluster modules for better organization",
      status: "pending",
      priority: "medium"
    }
  ];

  // Test interception
  console.log('📝 Intercepting TodoWrite call...');
  const logEntry = await bridge.interceptTodoCall('TodoWrite', testTodos);
  
  console.log('\n🔍 Analysis Results:');
  console.log(`- Captured ${testTodos.length} todos`);
  console.log(`- Found ${Object.keys(logEntry.mappings).length} with graph references`);
  
  console.log('\n📊 Detailed Mappings:');
  for (const [todoId, mapping] of Object.entries(logEntry.mappings)) {
    console.log(`\n${todoId}:`);
    console.log(`  Files: ${mapping.fileReferences.join(', ')}`);
    console.log(`  Clusters: ${mapping.clusterReferences.join(', ')}`);
    console.log(`  Graph refs: ${mapping.graphReferences.length}`);
    console.log(`  Confidence: ${mapping.confidence.toFixed(2)}`);
    
    for (const ref of mapping.graphReferences) {
      console.log(`    → ${ref.type}: ${ref.id || ref.clusterId} (${ref.confidence})`);
    }
  }

  // Test getting mappings
  console.log('\n🎯 Testing retrieval:');
  const specificMapping = bridge.getTodoMappings('todo-match-2');
  if (specificMapping) {
    console.log(`Todo "todo-match-2" maps to ${specificMapping.graphReferences.length} graph nodes`);
  }

  // Generate report
  console.log('\n📋 Todo-Graph Report:');
  const report = bridge.generateReport();
  console.log(`Total mappings: ${report.totalMappings}`);
  console.log('Cluster todos:', Object.keys(report.clusterTodos));
  console.log('File todos:', Object.keys(report.fileTodos));

  console.log('\n✅ Todo-Graph Bridge test complete!');
}

// Run the test
testTodoInterception().catch(console.error);
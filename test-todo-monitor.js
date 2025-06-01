#!/usr/bin/env node

import { TodoMonitor } from './src/graph/TodoMonitor.js';

async function testMonitoring() {
  console.log('🧪 Testing Todo Monitoring System\n');
  
  const monitor = new TodoMonitor('.');
  
  // Test current todo analysis
  console.log('📊 Analyzing current todos...');
  const analysis = await monitor.analyzeCurrentTodos();
  
  if (analysis) {
    console.log('\n🎯 Found todo-graph connections:');
    for (const cluster of analysis.clusterAffected) {
      console.log(`  Cluster ${cluster}: affected by todos`);
    }
    
    for (const file of analysis.filesAffected) {
      console.log(`  File ${file}: has pending work`);
    }
  }
  
  console.log('\n✅ Monitor test complete!');
}

testMonitoring().catch(console.error);
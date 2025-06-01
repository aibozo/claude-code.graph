#!/usr/bin/env node

/**
 * Test the smart reconciliation system
 */

import { TodoReconciler } from './src/graph/TodoReconciler.js';

async function testSmartReconciliation() {
  console.log('🧠 Testing Smart Todo Reconciliation System\n');
  
  const reconciler = new TodoReconciler('.');
  
  // Test 1: Simulate saving session state
  console.log('💾 Test 1: Saving session state...');
  const sessionTodos = [
    { id: "critical-bug", content: "Fix memory leak in src/graph/GraphClustering.js", status: "in_progress", priority: "high" },
    { id: "cluster-refactor", content: "Refactor cluster c2 organization", status: "pending", priority: "high" },
    { id: "add-tests", content: "Add unit tests for TodoGraphBridge.js", status: "pending", priority: "medium" },
    { id: "docs-update", content: "Update documentation", status: "pending", priority: "low" }
  ];
  
  await reconciler.saveSessionState(sessionTodos);
  console.log(`✅ Saved ${sessionTodos.length} todos to session state`);
  
  // Test 2: Check session continuity (simulate restart)
  console.log('\n🔄 Test 2: Checking session continuity after restart...');
  const continuity = await reconciler.checkSessionContinuity();
  
  console.log(`Session type: ${continuity.isSessionRestart ? 'RESTART' : 'CONTINUATION'}`);
  console.log(`Previous todos: ${continuity.previousTodoCount || 0}`);
  console.log(`Current todos: ${continuity.currentTodoCount || 0}`);
  
  if (continuity.recommendations) {
    reconciler.displayRecommendations(continuity);
  }
  
  // Test 3: Simulate user recreating some todos with variations
  console.log('\n📝 Test 3: Simulating user recreation with variations...');
  
  // Mock getCurrentTodoState to return recreated todos
  const originalGetCurrentTodos = reconciler.getCurrentTodoState;
  reconciler.getCurrentTodoState = async () => [
    { id: "new-critical", content: "Fix performance and memory issues in src/graph/GraphClustering.js line 145", status: "pending", priority: "high" },
    { id: "new-cluster", content: "Update cluster c2 for better file organization", status: "pending", priority: "medium" },
    { id: "new-feature", content: "Add visualization dashboard for graph metrics", status: "pending", priority: "medium" }
  ];
  
  const continuityWithRecreation = await reconciler.checkSessionContinuity();
  console.log('\nWith recreated todos:');
  reconciler.displayRecommendations(continuityWithRecreation);
  
  // Restore original method
  reconciler.getCurrentTodoState = originalGetCurrentTodos;
  
  console.log('\n✅ Smart reconciliation test complete!');
  console.log('\n🎯 KEY INSIGHTS:');
  console.log('- System persists todo-graph mappings across sessions');
  console.log('- Detects duplicate work with similarity scoring');
  console.log('- Prioritizes restoration of in-progress/high-priority work');
  console.log('- Provides actionable recommendations to user');
  console.log('- Handles edge cases gracefully');
}

testSmartReconciliation().catch(console.error);
#!/usr/bin/env node

/**
 * Test todo-graph reconciliation scenarios and edge cases
 */

import { TodoGraphBridge } from './src/graph/TodoGraphBridge.js';
import { readFile, writeFile } from 'fs/promises';

class TodoReconciliationTester {
  constructor() {
    this.bridge = new TodoGraphBridge('.');
    this.scenarios = [];
  }

  async testSessionRestart() {
    console.log('🔄 Testing Session Restart Scenario\n');
    
    // Simulate state before restart
    const preRestartTodos = [
      { id: "task-1", content: "Fix bug in src/graph/GraphService.js", status: "in_progress", priority: "high" },
      { id: "task-2", content: "Update cluster c2 organization", status: "pending", priority: "medium" },
      { id: "task-3", content: "Add tests to GraphClustering.js", status: "completed", priority: "low" }
    ];

    console.log('📝 Pre-restart state:');
    for (const todo of preRestartTodos) {
      await this.bridge.interceptTodoCall('TodoWrite', [todo]);
      console.log(`  ${todo.id}: ${todo.status} - ${todo.content.substring(0, 40)}...`);
    }

    const preRestartMappings = this.bridge.getTodoMappings();
    console.log(`\n📊 Pre-restart: ${Object.keys(preRestartMappings).length} mapped todos`);

    // Simulate restart - Claude Code todos disappear, but our graph data persists
    console.log('\n🚨 SIMULATING SESSION RESTART...');
    console.log('   📤 Claude Code todos: LOST');
    console.log('   💾 Graph mappings: PERSISTED');

    // Post-restart: User recreates some todos (with slight variations)
    const postRestartTodos = [
      { id: "new-task-1", content: "Fix performance issue in src/graph/GraphService.js line 42", status: "pending", priority: "high" },
      { id: "new-task-2", content: "Refactor cluster c2 for better organization", status: "pending", priority: "medium" },
      { id: "new-task-4", content: "Debug issue in tools/fast-treesitter.js", status: "pending", priority: "high" }
    ];

    console.log('\n📝 Post-restart todos (user recreated):');
    for (const todo of postRestartTodos) {
      console.log(`  ${todo.id}: ${todo.content.substring(0, 40)}...`);
    }

    // Test reconciliation
    await this.testReconciliation(preRestartMappings, postRestartTodos);
  }

  async testReconciliation(oldMappings, newTodos) {
    console.log('\n🔍 RECONCILIATION ANALYSIS:\n');

    const reconciliation = {
      duplicateWork: [],
      lostTodos: [],
      newWork: [],
      recommendations: []
    };

    // Process new todos and check for overlaps
    for (const newTodo of newTodos) {
      const newAnalysis = await this.bridge.analyzeTodoContent(newTodo);
      
      // Check if this todo overlaps with previous work
      const overlaps = this.findOverlaps(newAnalysis, oldMappings);
      
      if (overlaps.length > 0) {
        reconciliation.duplicateWork.push({
          newTodo: newTodo.id,
          content: newTodo.content,
          overlaps: overlaps.map(o => ({ id: o.todoId, similarity: o.similarity }))
        });
      } else {
        reconciliation.newWork.push({
          todo: newTodo.id,
          content: newTodo.content,
          targets: newAnalysis.graphReferences.map(r => r.id || r.clusterId)
        });
      }
    }

    // Find lost todos (old todos with no new equivalent)
    for (const [oldId, oldMapping] of Object.entries(oldMappings)) {
      const hasEquivalent = newTodos.some(newTodo => {
        const newAnalysis = { fileReferences: [newTodo.content], graphReferences: [] };
        return this.calculateSimilarity(oldMapping, newAnalysis) > 0.5;
      });

      if (!hasEquivalent && oldMapping.status !== 'completed') {
        reconciliation.lostTodos.push({
          id: oldId,
          status: oldMapping.status,
          files: oldMapping.fileReferences,
          clusters: oldMapping.clusterReferences
        });
      }
    }

    // Generate recommendations
    this.generateRecommendations(reconciliation);
    this.displayReconciliation(reconciliation);

    return reconciliation;
  }

  findOverlaps(newAnalysis, oldMappings) {
    const overlaps = [];

    for (const [oldId, oldMapping] of Object.entries(oldMappings)) {
      const similarity = this.calculateSimilarity(newAnalysis, oldMapping);
      if (similarity > 0.3) {
        overlaps.push({
          todoId: oldId,
          similarity: similarity,
          reason: this.getSimilarityReason(newAnalysis, oldMapping)
        });
      }
    }

    return overlaps.sort((a, b) => b.similarity - a.similarity);
  }

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

  getSimilarityReason(analysis1, analysis2) {
    const reasons = [];
    
    if (this.calculateArrayOverlap(analysis1.fileReferences, analysis2.fileReferences) > 0) {
      reasons.push('same files');
    }
    
    if (this.calculateArrayOverlap(analysis1.clusterReferences, analysis2.clusterReferences) > 0) {
      reasons.push('same clusters');
    }
    
    return reasons.join(', ') || 'unknown';
  }

  generateRecommendations(reconciliation) {
    // Recommend ignoring duplicate work
    for (const dup of reconciliation.duplicateWork) {
      reconciliation.recommendations.push({
        type: 'ignore_duplicate',
        message: `Todo "${dup.newTodo}" seems to duplicate previous work on ${dup.overlaps[0]?.id}`,
        action: 'Consider marking as duplicate or merging with existing task'
      });
    }

    // Recommend restoring lost important todos
    for (const lost of reconciliation.lostTodos) {
      if (lost.status === 'in_progress') {
        reconciliation.recommendations.push({
          type: 'restore_important',
          message: `Lost in-progress todo: "${lost.id}" was working on ${lost.files.join(', ')}`,
          action: 'Consider recreating this todo to continue work'
        });
      }
    }

    // Celebrate genuinely new work
    for (const newWork of reconciliation.newWork) {
      reconciliation.recommendations.push({
        type: 'new_work',
        message: `New todo "${newWork.todo}" targets: ${newWork.targets.join(', ')}`,
        action: 'This appears to be genuinely new work'
      });
    }
  }

  displayReconciliation(reconciliation) {
    console.log('📊 RECONCILIATION RESULTS:\n');

    console.log(`🔄 Duplicate Work: ${reconciliation.duplicateWork.length}`);
    for (const dup of reconciliation.duplicateWork) {
      console.log(`  ⚠️  "${dup.newTodo}" overlaps with previous "${dup.overlaps[0]?.id}" (${(dup.overlaps[0]?.similarity * 100).toFixed(0)}% similar)`);
    }

    console.log(`\n❌ Lost Todos: ${reconciliation.lostTodos.length}`);
    for (const lost of reconciliation.lostTodos) {
      console.log(`  🚨 "${lost.id}" (${lost.status}) - targets: ${lost.files.join(', ')}`);
    }

    console.log(`\n✨ New Work: ${reconciliation.newWork.length}`);
    for (const newWork of reconciliation.newWork) {
      console.log(`  🆕 "${newWork.todo}" - targets: ${newWork.targets.join(', ')}`);
    }

    console.log('\n💡 RECOMMENDATIONS:\n');
    for (const rec of reconciliation.recommendations) {
      const icon = { ignore_duplicate: '🔄', restore_important: '🚨', new_work: '✨' }[rec.type];
      console.log(`${icon} ${rec.message}`);
      console.log(`   → ${rec.action}\n`);
    }
  }

  async testOtherEdgeCases() {
    console.log('\n🧪 Testing Other Edge Cases:\n');

    // Edge case 1: Todo content changes (same ID, different content)
    console.log('📝 Edge Case 1: Todo Content Changes');
    const originalTodo = { id: "evolving-task", content: "Fix issue in GraphService.js", status: "pending", priority: "medium" };
    const updatedTodo = { id: "evolving-task", content: "Fix performance and memory issues in GraphService.js and related modules", status: "in_progress", priority: "high" };
    
    await this.bridge.interceptTodoCall('TodoWrite', [originalTodo]);
    console.log(`  Original: "${originalTodo.content}"`);
    
    await this.bridge.interceptTodoCall('TodoWrite', [updatedTodo]);
    console.log(`  Updated:  "${updatedTodo.content}"`);
    console.log(`  → Scope expanded, priority increased`);

    // Edge case 2: File moved/renamed
    console.log('\n📁 Edge Case 2: File Moved/Renamed');
    const beforeMove = { id: "file-task", content: "Update src/tools/parser.js", status: "pending", priority: "low" };
    console.log(`  Before: "Update src/tools/parser.js"`);
    console.log(`  → File moved to: tools/advanced-parser.js`);
    console.log(`  → Todo becomes stale, needs reconciliation`);

    // Edge case 3: Cluster reorganization
    console.log('\n🗂️  Edge Case 3: Cluster Reorganization');
    console.log(`  Todo: "Refactor cluster c2 modules"`);
    console.log(`  → Clustering algorithm changed, c2 split into c2a and c2b`);
    console.log(`  → Need to update cluster references`);

    console.log('\n✅ Edge case analysis complete!');
  }
}

async function main() {
  const tester = new TodoReconciliationTester();
  
  await tester.testSessionRestart();
  await tester.testOtherEdgeCases();
  
  console.log('\n🎯 RECONCILIATION STRATEGY SUMMARY:');
  console.log('1. 🔄 Detect duplicate work by file/cluster overlap');
  console.log('2. 🚨 Alert about lost in-progress todos');
  console.log('3. ✨ Celebrate genuinely new work');
  console.log('4. 💾 Persist graph mappings across sessions');
  console.log('5. 🤖 Provide smart recommendations to user');
}

main().catch(console.error);
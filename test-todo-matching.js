#!/usr/bin/env node

/**
 * Test file path matching accuracy with various edge cases
 */

import { TodoGraphBridge } from './src/graph/TodoGraphBridge.js';

async function testMatchingAccuracy() {
  console.log('🧪 Testing Todo-Graph Matching Accuracy\n');
  
  const bridge = new TodoGraphBridge('.');
  
  // Test cases with various file path formats
  const testCases = [
    {
      id: "test-1",
      content: "Fix bug in src/graph/GraphClustering.js line 145",
      expected: ["src/graph/GraphClustering.js"],
      description: "Standard file path"
    },
    {
      id: "test-2", 
      content: "Update ./tools/fast-treesitter.js for better performance",
      expected: ["./tools/fast-treesitter.js"],
      description: "Relative path with ./"
    },
    {
      id: "test-3",
      content: "Refactor cluster c2 modules",
      expected: [],
      expectedClusters: ["c2"],
      description: "Cluster reference only"
    },
    {
      id: "test-4",
      content: "Add tests to tests/graph/clustering.test.js and GraphService.js",
      expected: ["tests/graph/clustering.test.js", "GraphService.js"],
      description: "Multiple files in one todo"
    },
    {
      id: "test-5",
      content: "Debug issue affecting graph/ClusterTools.js:42-50",
      expected: ["graph/ClusterTools.js"],
      description: "File with line range"
    },
    {
      id: "test-6",
      content: "Optimize memory usage across the codebase",
      expected: [],
      description: "No specific files mentioned"
    },
    {
      id: "test-7",
      content: "Fix import in index.js from './graph/GraphService'",
      expected: ["index.js", "./graph/GraphService"],
      description: "Import statement references"
    },
    {
      id: "test-8",
      content: "Update package.json dependencies and run npm install",
      expected: ["package.json"],
      description: "Config file and command"
    }
  ];

  let totalTests = testCases.length;
  let passedTests = 0;
  let results = [];

  for (const testCase of testCases) {
    const analysis = await bridge.analyzeTodoContent(testCase);
    
    const actualFiles = analysis.fileReferences;
    const actualClusters = analysis.clusterReferences;
    const expectedFiles = testCase.expected || [];
    const expectedClusters = testCase.expectedClusters || [];
    
    // Check file matching
    const fileMatches = expectedFiles.every(expected => 
      actualFiles.some(actual => 
        actual.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(actual.toLowerCase())
      )
    );
    
    // Check cluster matching
    const clusterMatches = expectedClusters.every(expected =>
      actualClusters.includes(expected)
    );
    
    const passed = fileMatches && clusterMatches;
    if (passed) passedTests++;
    
    results.push({
      id: testCase.id,
      description: testCase.description,
      content: testCase.content,
      expected: expectedFiles,
      actual: actualFiles,
      expectedClusters,
      actualClusters,
      passed,
      confidence: analysis.confidence,
      graphRefs: analysis.graphReferences.length
    });
    
    console.log(`${passed ? '✅' : '❌'} ${testCase.id}: ${testCase.description}`);
    console.log(`  Content: "${testCase.content}"`);
    console.log(`  Expected files: [${expectedFiles.join(', ')}]`);
    console.log(`  Actual files: [${actualFiles.join(', ')}]`);
    if (expectedClusters.length > 0) {
      console.log(`  Expected clusters: [${expectedClusters.join(', ')}]`);
      console.log(`  Actual clusters: [${actualClusters.join(', ')}]`);
    }
    console.log(`  Confidence: ${analysis.confidence.toFixed(2)}, Graph refs: ${analysis.graphReferences.length}`);
    console.log('');
  }

  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed (${(passedTests/totalTests*100).toFixed(1)}%)`);
  
  // Identify patterns in failures
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('\n🐛 Common failure patterns:');
    failures.forEach(failure => {
      console.log(`- ${failure.id}: Missing [${failure.expected.filter(e => 
        !failure.actual.some(a => a.toLowerCase().includes(e.toLowerCase()))
      ).join(', ')}]`);
    });
  }

  // Test edge cases for better patterns
  console.log('\n🔧 Testing improved patterns...');
  await testImprovedPatterns(bridge);
  
  return passedTests / totalTests;
}

async function testImprovedPatterns(bridge) {
  // Test some patterns that might be failing
  const edgeCases = [
    "Fix issue in src/components/Header.tsx:25",
    "Update both config.json and settings.yaml files", 
    "Refactor from utils/helper.js to utils/helpers/main.js",
    "Debug crash in main.py line 142-145",
    "Add feature to pages/dashboard/index.vue"
  ];

  for (const content of edgeCases) {
    const analysis = await bridge.analyzeTodoContent({ id: 'edge', content, status: 'pending', priority: 'medium' });
    console.log(`"${content}"`);
    console.log(`  → Files: [${analysis.fileReferences.join(', ')}] (confidence: ${analysis.confidence.toFixed(2)})`);
  }
}

testMatchingAccuracy().catch(console.error);
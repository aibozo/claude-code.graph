#!/usr/bin/env node

import { ClusterTools } from './src/graph/ClusterTools.js';

const rootPath = '/home/riley/Programming/open_spiel/open_spiel';
const clusterTools = new ClusterTools(rootPath);

console.log('🔍 Testing OpenSpiel Cluster Tools\n');

// Test 1: List all clusters
console.log('1. CLUSTER LIST:');
const list = await clusterTools.clusterList({ maxClusters: 10 });
if (list.success) {
  console.log(`Found ${list.total} clusters, showing ${list.clusters.length}:\n`);
  
  list.clusters.forEach((cluster, i) => {
    console.log(`${i + 1}. ${cluster.id}: ${cluster.summary}`);
    console.log(`   Files: ${cluster.files}, Size: ${cluster.size}`);
    console.log(`   Languages: ${cluster.languages.join(', ')}`);
    console.log(`   Key files: ${cluster.keyFiles.slice(0, 2).join(', ')}...`);
    console.log(`   Connections: ${cluster.connections}, Importance: ${cluster.importance}\n`);
  });
  
  if (list.metrics) {
    console.log(`📊 Metrics: ${list.metrics.totalFiles} files → ${list.metrics.totalClusters} clusters (${list.metrics.compressionRatio})`);
  }
} else {
  console.log(`❌ Error: ${list.error}`);
}

// Test 2: Expand first cluster
console.log('\n\n2. CLUSTER EXPANSION (c0):');
const expanded = await clusterTools.clusterExpand('c0', { includeFileDetails: true, maxFiles: 8 });
if (expanded.success) {
  console.log(`Cluster: ${expanded.cluster.description}`);
  console.log(`Files: ${expanded.cluster.showing}/${expanded.cluster.totalFiles}\n`);
  
  expanded.files.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file.shortPath} (${file.type})`);
    if (file.lines) console.log(`      Lines: ${file.lines}, Complexity: ${file.estimatedComplexity}`);
  });
} else {
  console.log(`❌ Error: ${expanded.error}`);
}

// Test 3: Get file details
console.log('\n\n3. FILE DETAILS:');
const firstFile = 'download_cache/double_dummy_solver/examples/AnalyseAllPlaysBin.cpp';
const fileInfo = await clusterTools.fileGet(firstFile, { includeSymbols: true });
if (fileInfo.success) {
  const file = fileInfo.file;
  console.log(`File: ${file.shortPath}`);
  console.log(`Type: ${file.type}, Size: ${file.size}`);
  
  if (file.symbols && file.symbols.length > 0) {
    console.log(`Symbols: ${file.symbols.map(s => `${s.type}:${s.name}`).slice(0, 5).join(', ')}`);
  }
} else {
  console.log(`❌ Error: ${fileInfo.error}`);
}

console.log('\n✅ Cluster tools test complete!');
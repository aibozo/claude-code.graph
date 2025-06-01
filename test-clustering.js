#!/usr/bin/env node

import { GraphService } from './src/graph/GraphService.js';

async function testClustering() {
  console.log('🔄 Testing clustering manually...');
  
  const rootPath = '/home/riley/Programming/open_spiel/open_spiel';
  console.log('🔧 First rebuilding the graph with fixed parser...');
  
  // Run the build script manually to fix corrupted JSON
  const { spawn } = await import('child_process');
  const buildScript = '/home/riley/Programming/ccg/tools/codegraph.sh';
  
  await new Promise((resolve, reject) => {
    const child = spawn('bash', [buildScript], {
      cwd: rootPath,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });
  
  console.log('✅ Graph rebuilt');
  
  const graphService = new GraphService(rootPath);
  
  try {
    console.log('1. Initializing GraphService...');
    const initialized = await graphService.initialize();
    
    if (!initialized) {
      console.log('❌ Failed to initialize GraphService');
      return;
    }
    
    console.log('✅ GraphService initialized');
    
    // Force super-graph generation
    console.log('2. Generating super-graph...');
    const combinedData = await graphService.getCombinedGraphData();
    console.log(`   Combined data: ${combinedData.nodes.length} nodes, ${combinedData.edges.length} edges`);
    
    if (combinedData.nodes.length > 0) {
      const superGraph = await graphService.clustering.generateSuperGraph(combinedData);
      console.log('✅ Super-graph generated successfully');
      
      console.log(`   Clusters: ${Object.keys(superGraph.clusters).length}`);
      console.log(`   Compression: ${superGraph.metadata.compressionRatio}:1`);
    } else {
      console.log('❌ No data available for clustering');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testClustering();
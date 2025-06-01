#!/usr/bin/env node

import { GraphService } from './src/graph/GraphService.js';

async function testClustering() {
  console.log('🔄 Testing clustering (simple)...');
  
  const rootPath = '/home/riley/Programming/open_spiel/open_spiel';
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
      
      // Test cluster tools
      console.log('\n3. Testing cluster tools...');
      const { ClusterTools } = await import('./src/graph/ClusterTools.js');
      const clusterTools = new ClusterTools(rootPath);
      
      const list = await clusterTools.clusterList({ maxClusters: 5 });
      if (list.success) {
        console.log(`✅ Cluster list: ${list.clusters.length} clusters`);
        list.clusters.forEach((cluster, i) => {
          console.log(`   ${i + 1}. ${cluster.id}: ${cluster.summary} (${cluster.files} files)`);
        });
      } else {
        console.log(`❌ Cluster list failed: ${list.error}`);
      }
      
    } else {
      console.log('❌ No data available for clustering');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testClustering();
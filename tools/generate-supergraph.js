#!/usr/bin/env node

/**
 * Super-graph generation script
 * Standalone script to generate clusters from graph data during build
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GraphService } from '../src/graph/GraphService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateSuperGraph(rootPath) {
  try {
    console.error(`🧠 Generating super-graph for ${rootPath}...`);
    
    const graphService = new GraphService(rootPath);
    
    // Load and combine graph data
    await graphService.loadMetadata();
    await graphService.loadAllGraphs();
    
    const combinedData = await graphService.getCombinedGraphData();
    
    if (combinedData.nodes.length === 0) {
      console.error('   No graph data available for clustering');
      return;
    }
    
    console.error(`   Processing ${combinedData.nodes.length} nodes, ${combinedData.edges.length} edges`);
    
    // Generate super-graph
    const superGraph = await graphService.clustering.generateSuperGraph(combinedData);
    
    if (superGraph) {
      console.error(`   Generated ${Object.keys(superGraph.clusters).length} clusters`);
      console.error(`   Compression ratio: ${superGraph.metadata.compressionRatio}:1`);
    } else {
      console.error('   Super-graph generation failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`Super-graph generation failed: ${error.message}`);
    process.exit(1);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, rootPath] = process.argv;
  
  if (!rootPath) {
    console.error('Usage: generate-supergraph.js <rootPath>');
    process.exit(1);
  }
  
  await generateSuperGraph(rootPath);
}

export { generateSuperGraph };
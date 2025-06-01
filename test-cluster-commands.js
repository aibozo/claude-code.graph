#!/usr/bin/env node

import { GraphCommands } from './src/graph/GraphCommands.js';

async function testClusterCommands() {
  console.log('🧪 Testing cluster commands integration...\n');
  
  const rootPath = '/home/riley/Programming/open_spiel/open_spiel';
  const commands = new GraphCommands(rootPath);
  
  try {
    // Initialize
    console.log('1. Initializing...');
    await commands.initialize();
    console.log('✅ Initialized\n');
    
    // Test /clusters command
    console.log('2. Testing /clusters command...');
    const clustersResult = await commands.executeCommand('/clusters', ['--limit=5']);
    console.log(`Result type: ${clustersResult.type}`);
    console.log(`Content preview: ${clustersResult.content.substring(0, 200)}...\n`);
    
    // Test /cluster expand command
    console.log('3. Testing /cluster c0 command...');
    const clusterResult = await commands.executeCommand('/cluster', ['c0']);
    console.log(`Result type: ${clusterResult.type}`);
    console.log(`Content preview: ${clusterResult.content.substring(0, 200)}...\n`);
    
    // Test /csearch command
    console.log('4. Testing /csearch command...');
    const searchResult = await commands.executeCommand('/csearch', ['test']);
    console.log(`Result type: ${searchResult.type}`);
    console.log(`Content preview: ${searchResult.content.substring(0, 200)}...\n`);
    
    // Test /cfile command
    console.log('5. Testing /cfile command...');
    const fileResult = await commands.executeCommand('/cfile', ['download_cache/double_dummy_solver/examples/AnalyseAllPlaysBin.cpp']);
    console.log(`Result type: ${fileResult.type}`);
    console.log(`Content preview: ${fileResult.content.substring(0, 200)}...\n`);
    
    console.log('✅ All cluster commands working!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testClusterCommands();
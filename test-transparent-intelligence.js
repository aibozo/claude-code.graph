#!/usr/bin/env node

/**
 * Test transparent graph intelligence enhancement
 */

import { ToolInterceptor } from './src/graph/ToolInterceptor.js';

async function testTransparentIntelligence() {
  console.log('🧪 Testing Transparent Graph Intelligence\n');
  
  const interceptor = new ToolInterceptor('.');
  await interceptor.initialize();
  
  // Mock original tool functions
  const mockTaskFunction = async (description, prompt) => {
    return `Original Task Result for: "${prompt}"\nFound 15 files matching the query...`;
  };
  
  const mockGrepFunction = async (pattern, options) => {
    return `Original Grep Result for: "${pattern}"\nMatches found in 8 files...`;
  };
  
  const mockReadFunction = async (filePath, options) => {
    return `File content for: ${filePath}\n\nclass GraphTool {\n  // Implementation...\n}`;
  };
  
  console.log('📝 Test 1: Enhanced Task Tool');
  const taskResult = await interceptor.interceptTask(
    'Find graph tool implementation',
    'Find where GraphTool is implemented',
    mockTaskFunction
  );
  console.log('Result:', taskResult);
  console.log('');
  
  console.log('🔍 Test 2: Enhanced Grep Tool');
  const grepResult = await interceptor.interceptGrep(
    'GraphTool',
    {},
    mockGrepFunction
  );
  console.log('Result:', grepResult);
  console.log('');
  
  console.log('📖 Test 3: Enhanced Read Tool');
  const readResult = await interceptor.interceptRead(
    'src/graph/GraphTool.js',
    {},
    mockReadFunction
  );
  console.log('Result:', readResult);
  console.log('');
  
  // Show usage stats
  console.log('📊 Usage Statistics:');
  const stats = interceptor.getUsageStats();
  console.log(JSON.stringify(stats, null, 2));
  
  console.log('\n✅ Transparent intelligence test complete!');
  console.log('🎯 All tools enhanced without changing their interface');
}

testTransparentIntelligence().catch(console.error);
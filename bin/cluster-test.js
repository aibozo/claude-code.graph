#!/usr/bin/env node

/**
 * Test CLI for cluster tools - demonstrates compressed graph representation
 */

import { ClusterTools } from '../src/graph/ClusterTools.js';
import { resolve } from 'path';

async function main() {
  const [,, command, ...args] = process.argv;
  const rootPath = process.cwd();
  
  const clusterTools = new ClusterTools(resolve(rootPath));
  
  switch (command) {
    case 'list':
      console.log('🔍 Cluster List (Claude startup view):');
      console.log('=====================================');
      const list = await clusterTools.clusterList();
      
      if (list.success) {
        console.log(`\nFound ${list.total} clusters:`);
        
        list.clusters.forEach((cluster, i) => {
          console.log(`\n${i + 1}. ${cluster.id}: ${cluster.summary}`);
          console.log(`   Files: ${cluster.files}, Size: ${cluster.size}`);
          console.log(`   Languages: ${cluster.languages.join(', ')}`);
          console.log(`   Key files: ${cluster.keyFiles.join(', ')}`);
          console.log(`   Connections: ${cluster.connections}, Importance: ${cluster.importance}`);
        });
        
        if (list.majorConnections) {
          console.log('\n🔗 Major Connections:');
          list.majorConnections.forEach(conn => {
            console.log(`   ${conn.from} → ${conn.to} (${conn.strength})`);
          });
        }
        
        if (list.metrics) {
          console.log('\n📊 Metrics:');
          console.log(`   Total files: ${list.metrics.totalFiles}`);
          console.log(`   Compression: ${list.metrics.compressionRatio}`);
          console.log(`   Last updated: ${list.metrics.lastUpdated}`);
        }
      } else {
        console.log(`❌ Error: ${list.error}`);
      }
      break;
      
    case 'expand':
      const clusterId = args[0];
      if (!clusterId) {
        console.log('Usage: cluster-test expand <cluster_id>');
        break;
      }
      
      console.log(`🔍 Expanding cluster: ${clusterId}`);
      console.log('================================');
      
      const expanded = await clusterTools.clusterExpand(clusterId, { 
        includeFileDetails: true,
        maxFiles: 20 
      });
      
      if (expanded.success) {
        console.log(`\nCluster: ${expanded.cluster.description}`);
        console.log(`Files: ${expanded.cluster.showing}/${expanded.cluster.totalFiles}`);
        console.log(`Languages: ${expanded.cluster.languages.join(', ')}`);
        console.log(`Key files: ${expanded.cluster.keyFiles.join(', ')}`);
        
        console.log('\n📁 Files:');
        expanded.files.forEach((file, i) => {
          console.log(`   ${i + 1}. ${file.shortPath} (${file.type})`);
          if (file.lines) console.log(`      Lines: ${file.lines}, Complexity: ${file.estimatedComplexity}`);
        });
        
        if (expanded.connections.length > 0) {
          console.log('\n🔗 Connected to:');
          expanded.connections.slice(0, 5).forEach(conn => {
            console.log(`   ${conn.direction === 'outgoing' ? '→' : '←'} ${conn.description} (${conn.weight})`);
          });
        }
      } else {
        console.log(`❌ Error: ${expanded.error}`);
      }
      break;
      
    case 'file':
      const filePath = args[0];
      if (!filePath) {
        console.log('Usage: cluster-test file <file_path>');
        break;
      }
      
      console.log(`🔍 File details: ${filePath}`);
      console.log('===============================');
      
      const fileInfo = await clusterTools.fileGet(filePath, {
        includeSymbols: true,
        includeDependencies: true
      });
      
      if (fileInfo.success) {
        const file = fileInfo.file;
        console.log(`\nPath: ${file.path}`);
        console.log(`Type: ${file.type} (${file.language})`);
        console.log(`Size: ${file.size}`);
        
        if (file.symbols && file.symbols.length > 0) {
          console.log('\n🔧 Symbols:');
          file.symbols.forEach(symbol => {
            console.log(`   ${symbol.type}: ${symbol.name}`);
          });
        }
        
        if (file.dependencies) {
          console.log('\n🔗 Dependencies:');
          console.log(`   Imports: ${file.dependencies.imports.length}`);
          console.log(`   Exports: ${file.dependencies.exports.length}`);
          console.log(`   Dependents: ${file.dependencies.dependents.length}`);
        }
      } else {
        console.log(`❌ Error: ${fileInfo.error}`);
      }
      break;
      
    case 'search':
      const query = args[0];
      if (!query) {
        console.log('Usage: cluster-test search <query>');
        break;
      }
      
      console.log(`🔍 Searching clusters for: "${query}"`);
      console.log('===================================');
      
      const searchResults = await clusterTools.clusterSearch(query);
      
      if (searchResults.success) {
        if (searchResults.results.length > 0) {
          console.log(`\nFound ${searchResults.results.length} matches:`);
          searchResults.results.forEach((result, i) => {
            console.log(`\n${i + 1}. ${result.cluster.id}: ${result.cluster.description}`);
            console.log(`   Score: ${result.score}, Files: ${result.cluster.files}`);
            console.log(`   Languages: ${result.cluster.languages.join(', ')}`);
          });
        } else {
          console.log('\nNo clusters found matching your query.');
        }
      } else {
        console.log(`❌ Error: ${searchResults.error}`);
      }
      break;
      
    default:
      console.log(`
🧠 Claude Code Graph - Cluster Tools Test

Usage: cluster-test <command> [args]

Commands:
  list                    Show all clusters (Claude startup view)
  expand <cluster_id>     Expand specific cluster details  
  file <file_path>        Get detailed file information
  search <query>          Search clusters by description/language

Examples:
  cluster-test list
  cluster-test expand c0
  cluster-test file src/main.py
  cluster-test search "python test"
      `);
  }
}

main().catch(console.error);
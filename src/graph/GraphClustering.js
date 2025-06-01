/**
 * Graph Clustering - Smart compression of large code graphs
 * Uses community detection to create super-nodes for efficient Claude context
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export class GraphClustering {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphDir = join(rootPath, '.graph');
    this.clustersDir = join(this.graphDir, 'clusters');
    this.cache = new Map();
  }

  /**
   * Generate super-graph from file-level dependencies
   * Uses Louvain-like community detection (simplified JS implementation)
   * Smart resolution: 100x reduction for large codebases, full graph for small projects
   */
  async generateSuperGraph(graphData, options = {}) {
    const {
      targetReduction = 100,  // 100x compression for large codebases
      minClusterSize = 2,     // Reduced for more granular clustering
      resolution = 1.0,       // Slightly lower for finer communities
      fallbackToDirectories = true,
      smallProjectThreshold = 20  // Show full graph if under 20 files
    } = options;

    console.log('🔍 Analyzing graph structure for clustering...');

    // Build adjacency structure from edges
    const graph = this.buildAdjacencyGraph(graphData);
    
    console.log(`   Graph: ${graph.nodes.size} nodes, ${graphData.edges.length} edges`);

    // Smart resolution: skip clustering for small projects
    if (graph.nodes.size < smallProjectThreshold) {
      console.log(`   Small project (${graph.nodes.size} files) - using full graph`);
      return this.createFullGraphSuperGraph(graphData, graph);
    }

    // Calculate target clusters for 100x reduction (but ensure reasonable bounds)
    const targetClusters = Math.max(
      Math.ceil(graph.nodes.size / targetReduction),  // 100x reduction
      5  // Minimum 5 clusters for meaningful organization
    );
    const maxClusters = Math.min(targetClusters * 2, 50); // Allow some flexibility, cap at 50

    console.log(`   Target clusters: ${targetClusters} (${targetReduction}x reduction), max: ${maxClusters}`);

    // Try community detection first
    let communities;
    try {
      communities = this.detectCommunities(graph, resolution);
      console.log(`   Found ${communities.size} initial communities`);
    } catch (error) {
      console.log('   Community detection failed, using directory fallback...');
      communities = this.fallbackToDirectoryClustering(graph);
    }

    // Merge small clusters and limit total count
    communities = this.optimizeClusters(communities, {
      targetClusters,
      maxClusters,
      minClusterSize,
      graph
    });

    console.log(`   Optimized to ${communities.size} clusters`);

    // Generate cluster summaries and super-graph
    const superGraph = await this.buildSuperGraph(communities, graph, graphData);
    
    // Save results
    await this.saveClusters(communities, superGraph);

    return superGraph;
  }

  /**
   * Build adjacency graph from edge data
   */
  buildAdjacencyGraph(graphData) {
    const nodes = new Set();
    const edges = new Map();

    // Add all files as nodes
    graphData.nodes.forEach(node => {
      if (node.file) {
        nodes.add(node.file);
      }
    });

    // Build adjacency lists from edges
    graphData.edges.forEach(edge => {
      const from = edge.from;
      const to = this.resolveEdgeTarget(edge.to, nodes);
      
      if (from && to && nodes.has(from) && nodes.has(to) && from !== to) {
        if (!edges.has(from)) edges.set(from, new Set());
        if (!edges.has(to)) edges.set(to, new Set());
        
        edges.get(from).add(to);
        edges.get(to).add(from); // Undirected for clustering
      }
    });

    return { nodes, edges };
  }

  /**
   * Resolve edge targets to actual files in the graph
   */
  resolveEdgeTarget(target, nodes) {
    // If target is already a known file, use it
    if (nodes.has(target)) return target;
    
    // Try to find files that contain this import
    for (const node of nodes) {
      if (node.includes(target) || target.includes(node.split('/').pop().split('.')[0])) {
        return node;
      }
    }
    
    return null; // External dependency
  }

  /**
   * Simplified Louvain-like community detection
   */
  detectCommunities(graph, resolution = 1.2) {
    const communities = new Map();
    let clusterId = 0;

    // Initialize: each node in its own community
    for (const node of graph.nodes) {
      communities.set(node, clusterId++);
    }

    let improved = true;
    let iteration = 0;
    const maxIterations = 10;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (const node of graph.nodes) {
        const currentCommunity = communities.get(node);
        const neighbors = graph.edges.get(node) || new Set();
        
        // Find best community among neighbors
        const communityScores = new Map();
        
        for (const neighbor of neighbors) {
          const neighborCommunity = communities.get(neighbor);
          if (neighborCommunity !== currentCommunity) {
            const score = communityScores.get(neighborCommunity) || 0;
            communityScores.set(neighborCommunity, score + 1);
          }
        }

        // Move to best community if beneficial
        if (communityScores.size > 0) {
          const bestCommunity = [...communityScores.entries()]
            .sort((a, b) => b[1] - a[1])[0][0];
          
          const currentScore = this.calculateCommunityScore(node, currentCommunity, communities, graph);
          const newScore = this.calculateCommunityScore(node, bestCommunity, communities, graph);
          
          if (newScore > currentScore * resolution) {
            communities.set(node, bestCommunity);
            improved = true;
          }
        }
      }
    }

    console.log(`   Community detection converged after ${iteration} iterations`);
    return this.groupCommunitiesById(communities);
  }

  /**
   * Calculate modularity-like score for a node in a community
   */
  calculateCommunityScore(node, communityId, communities, graph) {
    const neighbors = graph.edges.get(node) || new Set();
    let internalEdges = 0;
    let totalEdges = neighbors.size;

    for (const neighbor of neighbors) {
      if (communities.get(neighbor) === communityId) {
        internalEdges++;
      }
    }

    return totalEdges > 0 ? internalEdges / totalEdges : 0;
  }

  /**
   * Group nodes by community ID
   */
  groupCommunitiesById(nodeToommunity) {
    const communities = new Map();
    
    for (const [node, communityId] of nodeToommunity) {
      if (!communities.has(communityId)) {
        communities.set(communityId, []);
      }
      communities.get(communityId).push(node);
    }

    return communities;
  }

  /**
   * Fallback: cluster by directory structure
   */
  fallbackToDirectoryClustering(graph) {
    const directoryClusters = new Map();
    
    for (const node of graph.nodes) {
      // Extract first two path segments: src/frontend/... -> src.frontend
      const pathParts = node.replace(/^\.\//, '').split('/');
      const dirKey = pathParts.slice(0, Math.min(2, pathParts.length)).join('.');
      
      if (!directoryClusters.has(dirKey)) {
        directoryClusters.set(dirKey, []);
      }
      directoryClusters.get(dirKey).push(node);
    }

    console.log(`   Directory clustering: ${directoryClusters.size} clusters`);
    return directoryClusters;
  }

  /**
   * Create a full graph super-graph for small projects (no clustering)
   */
  createFullGraphSuperGraph(graphData, graph) {
    const clusters = {};
    const edges = [];
    
    // Create individual clusters for each file
    Array.from(graph.nodes).forEach((node, index) => {
      const clusterId = `f${index}`;
      clusters[clusterId] = {
        id: clusterId,
        files: 1,
        size: "~50 LoC",
        description: this.shortenPath(node),
        keyFiles: [node],
        languages: [this.getLanguageFromFile(node)],
        fileList: [node]
      };
    });

    // Convert file edges to cluster edges (direct mapping)
    graphData.edges.forEach(edge => {
      const fromCluster = this.findClusterForFile(edge.from, clusters);
      const toCluster = this.findClusterForFile(edge.to, clusters);
      
      if (fromCluster && toCluster && fromCluster !== toCluster) {
        edges.push({
          from: fromCluster,
          to: toCluster,
          weight: 1,
          type: 'file_dependency'
        });
      }
    });

    const superGraph = {
      clusters,
      edges,
      metadata: {
        totalFiles: graph.nodes.size,
        totalClusters: Object.keys(clusters).length,
        compressionRatio: 1, // No compression for small projects
        timestamp: new Date().toISOString(),
        strategy: 'full_graph'
      }
    };

    return this.saveSuperGraph(superGraph);
  }

  /**
   * Find cluster ID for a given file
   */
  findClusterForFile(filePath, clusters) {
    for (const [clusterId, cluster] of Object.entries(clusters)) {
      if (cluster.fileList.includes(filePath)) {
        return clusterId;
      }
    }
    return null;
  }

  /**
   * Optimize clusters by merging small ones and targeting specific count
   */
  optimizeClusters(communities, options) {
    const { targetClusters, maxClusters, minClusterSize, graph } = options;
    
    // Sort by size (largest first)
    const sortedCommunities = [...communities.entries()]
      .sort((a, b) => b[1].length - a[1].length);

    // If we have too many communities, merge aggressively to reach target
    if (sortedCommunities.length > maxClusters) {
      console.log(`   Too many communities (${sortedCommunities.length}), merging to ${targetClusters}`);
      return this.mergeToTarget(sortedCommunities, targetClusters, minClusterSize);
    }

    // Standard optimization
    const optimized = new Map();
    const miscFiles = [];
    let clusterId = 0;

    for (const [originalId, files] of sortedCommunities) {
      if (files.length >= minClusterSize && optimized.size < maxClusters - 1) {
        optimized.set(`c${clusterId++}`, files);
      } else {
        miscFiles.push(...files);
      }
    }

    // Add miscellaneous cluster if needed
    if (miscFiles.length > 0) {
      optimized.set(`misc`, miscFiles);
    }

    return optimized;
  }

  /**
   * Aggressively merge communities to reach target cluster count
   */
  mergeToTarget(sortedCommunities, targetClusters, minClusterSize) {
    const optimized = new Map();
    
    // Take the largest communities up to our target
    const mainClusters = sortedCommunities.slice(0, targetClusters - 1);
    const remainingCommunities = sortedCommunities.slice(targetClusters - 1);
    
    let clusterId = 0;
    
    // Add main clusters
    for (const [originalId, files] of mainClusters) {
      optimized.set(`c${clusterId++}`, files);
    }
    
    // Merge all remaining communities into a misc cluster
    const miscFiles = [];
    for (const [originalId, files] of remainingCommunities) {
      miscFiles.push(...files);
    }
    
    if (miscFiles.length > 0) {
      optimized.set(`misc`, miscFiles);
    }
    
    console.log(`   Merged to ${optimized.size} clusters (target: ${targetClusters})`);
    return optimized;
  }

  /**
   * Build super-graph with inter-cluster edges
   */
  async buildSuperGraph(communities, graph, originalData) {
    const clusters = {};
    const superEdges = [];
    const nodeToCluster = new Map();

    // Build node-to-cluster mapping
    for (const [clusterId, files] of communities) {
      for (const file of files) {
        nodeToCluster.set(file, clusterId);
      }
    }

    // Generate cluster summaries
    for (const [clusterId, files] of communities) {
      const summary = await this.generateClusterSummary(files, clusterId);
      
      clusters[clusterId] = {
        id: clusterId,
        files: files.length,
        size: this.calculateClusterSize(files),
        description: summary.description,
        keyFiles: summary.keyFiles,
        languages: summary.languages,
        fileList: files
      };
    }

    // Calculate inter-cluster edges
    const edgeWeights = new Map();
    
    originalData.edges.forEach(edge => {
      const fromCluster = nodeToCluster.get(edge.from);
      const toFile = this.resolveEdgeTarget(edge.to, graph.nodes);
      const toCluster = toFile ? nodeToCluster.get(toFile) : null;
      
      if (fromCluster && toCluster && fromCluster !== toCluster) {
        const edgeKey = `${fromCluster}->${toCluster}`;
        edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) || 0) + 1);
      }
    });

    // Convert to edge list
    for (const [edgeKey, weight] of edgeWeights) {
      const [from, to] = edgeKey.split('->');
      superEdges.push({ from, to, weight, type: 'cluster_dependency' });
    }

    return {
      clusters,
      edges: superEdges,
      metadata: {
        totalFiles: graph.nodes.size,
        totalClusters: communities.size,
        compressionRatio: Math.round(graph.nodes.size / communities.size),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate summary for a cluster
   */
  async generateClusterSummary(files, clusterId) {
    // Simple heuristic-based summarization
    const languages = new Set();
    const directories = new Set();
    const keyWords = new Set();
    
    const keyFiles = files
      .sort((a, b) => this.getFileImportance(b) - this.getFileImportance(a))
      .slice(0, 3);

    files.forEach(file => {
      // Extract language
      const ext = file.split('.').pop();
      if (ext) languages.add(ext);
      
      // Extract directory patterns
      const dirs = file.split('/').slice(0, -1);
      dirs.forEach(dir => directories.add(dir));
      
      // Extract meaningful keywords from path
      const pathWords = file.split(/[\/\._]/).filter(w => 
        w.length > 2 && !['src', 'lib', 'test', 'index'].includes(w.toLowerCase())
      );
      pathWords.forEach(word => keyWords.add(word));
    });

    // Generate description
    const dirList = [...directories].slice(0, 2).join(', ');
    const langList = [...languages].slice(0, 2).join(', ');
    const topKeywords = [...keyWords].slice(0, 3).join(', ');
    
    let description = '';
    if (clusterId === 'misc') {
      description = `Miscellaneous files (${langList})`;
    } else if (directories.size > 0) {
      description = `${dirList} modules (${langList})`;
      if (topKeywords) description += ` - ${topKeywords}`;
    } else {
      description = `${langList} files`;
    }

    return {
      description: description.slice(0, 80), // Keep concise
      keyFiles,
      languages: [...languages],
      directories: [...directories]
    };
  }

  /**
   * Calculate file importance for key file selection
   */
  getFileImportance(file) {
    let score = 0;
    
    // Prefer shorter paths (likely more central)
    score += Math.max(0, 10 - file.split('/').length);
    
    // Prefer certain file patterns
    if (file.includes('index') || file.includes('main')) score += 5;
    if (file.includes('test')) score -= 3;
    if (file.includes('__')) score -= 2; // Python internals
    
    return score;
  }

  /**
   * Calculate cluster size (lines of code estimate)
   */
  calculateClusterSize(files) {
    // Rough estimate: average 50 lines per file
    const estimatedLines = files.length * 50;
    
    if (estimatedLines > 1000) {
      return `${Math.round(estimatedLines / 1000)}k LoC`;
    } else {
      return `${estimatedLines} LoC`;
    }
  }

  /**
   * Save clusters and super-graph to disk
   */
  async saveClusters(communities, superGraph) {
    // Ensure clusters directory exists
    if (!existsSync(this.clustersDir)) {
      await mkdir(this.clustersDir, { recursive: true });
    }

    // Save super-graph
    await writeFile(
      join(this.graphDir, 'supergraph.json'),
      JSON.stringify(superGraph, null, 2)
    );

    // Save individual cluster details
    for (const [clusterId, files] of communities) {
      const clusterData = {
        id: clusterId,
        files,
        fileCount: files.length,
        timestamp: new Date().toISOString()
      };
      
      await writeFile(
        join(this.clustersDir, `${clusterId}.json`),
        JSON.stringify(clusterData, null, 2)
      );
    }

    console.log(`   Saved ${communities.size} clusters to ${this.clustersDir}`);
  }

  /**
   * Load existing super-graph
   */
  async loadSuperGraph() {
    try {
      const content = await readFile(join(this.graphDir, 'supergraph.json'), 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if clustering needs regeneration
   */
  shouldRegenerate(graphData, existingSuperGraph) {
    if (!existingSuperGraph) return true;
    
    const currentFileCount = new Set(graphData.nodes.map(n => n.file)).size;
    const previousFileCount = existingSuperGraph.metadata?.totalFiles || 0;
    
    // Regenerate if file count changed by > 5%
    const changePercent = Math.abs(currentFileCount - previousFileCount) / previousFileCount;
    return changePercent > 0.05;
  }

  /**
   * Get language from file extension
   */
  getLanguageFromFile(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap = {
      'js': 'JavaScript',
      'ts': 'TypeScript', 
      'py': 'Python',
      'cpp': 'C++',
      'c': 'C',
      'h': 'C',
      'hpp': 'C++',
      'java': 'Java',
      'go': 'Go',
      'rs': 'Rust'
    };
    return langMap[ext] || ext || 'Unknown';
  }

  /**
   * Shorten file path for display
   */
  shortenPath(filePath) {
    if (!filePath) return '';
    
    // Remove leading ./
    let shortened = filePath.replace(/^\.\//, '');
    
    // Keep only last 2-3 components for very long paths
    const parts = shortened.split('/');
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`;
    }
    
    return shortened;
  }
}
/**
 * Cluster Tools - Claude-facing interface for compressed graph exploration
 * Provides ClusterList, ClusterExpand, and FileGet tools
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export class ClusterTools {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphDir = join(rootPath, '.graph');
    this.clustersDir = join(this.graphDir, 'clusters');
    this.cache = new Map();
  }

  /**
   * Initialize cluster tools
   */
  async initialize() {
    try {
      // Check if super-graph exists
      const superGraphPath = join(this.graphDir, 'supergraph.json');
      if (!existsSync(superGraphPath)) {
        console.warn('Super-graph not found, cluster tools will be limited');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('ClusterTools initialization failed:', error.message);
      return false;
    }
  }

  /**
   * ClusterList - Get overview of all clusters (startup tool)
   * Returns: Compressed view of entire codebase in ~1k tokens
   */
  async clusterList(options = {}) {
    const {
      includeEdges = true,
      includeMetrics = true,
      maxClusters = 50
    } = options;

    try {
      const superGraph = await this.loadSuperGraph();
      if (!superGraph) {
        return {
          success: false,
          error: "No super-graph available. Run 'ccg build' first.",
          clusters: []
        };
      }

      // Sort clusters by importance (size and connectivity)
      const clusterList = Object.values(superGraph.clusters)
        .map(cluster => this.enrichClusterData(cluster, superGraph))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, maxClusters)
        .map(cluster => ({
          id: cluster.id,
          summary: cluster.description,
          files: cluster.files,
          size: cluster.size,
          languages: cluster.languages,
          keyFiles: cluster.keyFiles.map(f => this.shortenPath(f)),
          connections: cluster.connections,
          importance: Math.round(cluster.importance)
        }));

      const result = {
        success: true,
        clusters: clusterList,
        total: Object.keys(superGraph.clusters).length,
        ...(includeEdges && { 
          majorConnections: this.getMajorConnections(superGraph, 5) 
        }),
        ...(includeMetrics && { 
          metrics: this.getMetrics(superGraph) 
        })
      };

      return result;

    } catch (error) {
      return {
        success: false,
        error: `Failed to load cluster list: ${error.message}`,
        clusters: []
      };
    }
  }

  /**
   * ClusterExpand - Get detailed view of specific cluster
   * Returns: Files and internal structure of one cluster
   */
  async clusterExpand(clusterId, options = {}) {
    const {
      depth = 1,
      includeFileDetails = false,
      maxFiles = 50
    } = options;

    try {
      const clusterData = await this.loadCluster(clusterId);
      if (!clusterData) {
        return {
          success: false,
          error: `Cluster '${clusterId}' not found`
        };
      }

      const superGraph = await this.loadSuperGraph();
      const clusterInfo = superGraph?.clusters[clusterId];

      // Get file list with optional details
      let files = [];
      for (const file of clusterData.files.slice(0, maxFiles)) {
        const fileInfo = {
          path: file,
          shortPath: this.shortenPath(file),
          type: this.getFileType(file)
        };
        
        if (includeFileDetails) {
          const basics = await this.getFileBasics(file);
          Object.assign(fileInfo, basics);
        }
        
        files.push(fileInfo);
      }

      // Get connected clusters
      const connections = this.getClusterConnections(clusterId, superGraph);

      return {
        success: true,
        cluster: {
          id: clusterId,
          description: clusterInfo?.description || 'No description',
          totalFiles: clusterData.files.length,
          showing: Math.min(maxFiles, clusterData.files.length),
          languages: clusterInfo?.languages || [],
          keyFiles: clusterInfo?.keyFiles?.map(f => this.shortenPath(f)) || []
        },
        files,
        connections,
        hasMore: clusterData.files.length > maxFiles
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to expand cluster: ${error.message}`
      };
    }
  }

  /**
   * FileGet - Get detailed info about specific file
   * Returns: File-level details for precise reasoning
   */
  async fileGet(filePath, options = {}) {
    const {
      includeContent = false,
      includeSymbols = true,
      includeDependencies = true
    } = options;

    try {
      const fullPath = join(this.rootPath, filePath);
      
      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      const fileInfo = {
        path: filePath,
        shortPath: this.shortenPath(filePath),
        type: this.getFileType(filePath),
        size: await this.getFileSize(fullPath),
        language: this.getLanguage(filePath)
      };

      // Add content if requested (be careful with large files)
      if (includeContent) {
        const content = await readFile(fullPath, 'utf8');
        if (content.length > 10000) {
          fileInfo.contentPreview = content.slice(0, 1000) + '\n... (truncated)';
          fileInfo.fullSize = content.length;
        } else {
          fileInfo.content = content;
        }
      }

      // Extract symbols and structure
      if (includeSymbols) {
        fileInfo.symbols = await this.extractFileSymbols(fullPath, fileInfo.language);
      }

      // Get dependencies
      if (includeDependencies) {
        fileInfo.dependencies = await this.getFileDependencies(filePath);
      }

      return {
        success: true,
        file: fileInfo
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to get file info: ${error.message}`
      };
    }
  }

  /**
   * ClusterSearch - Find clusters matching query
   */
  async clusterSearch(query, options = {}) {
    const { maxResults = 10 } = options;
    
    try {
      const superGraph = await this.loadSuperGraph();
      if (!superGraph) return { success: false, results: [] };

      const queryLower = query.toLowerCase();
      const results = [];

      Object.values(superGraph.clusters).forEach(cluster => {
        let score = 0;
        
        // Check description
        if (cluster.description.toLowerCase().includes(queryLower)) score += 10;
        
        // Check languages
        cluster.languages?.forEach(lang => {
          if (lang.toLowerCase().includes(queryLower)) score += 5;
        });
        
        // Check key files
        cluster.keyFiles?.forEach(file => {
          if (file.toLowerCase().includes(queryLower)) score += 3;
        });

        if (score > 0) {
          results.push({
            cluster: {
              id: cluster.id,
              description: cluster.description,
              files: cluster.files,
              languages: cluster.languages
            },
            score
          });
        }
      });

      return {
        success: true,
        results: results
          .sort((a, b) => b.score - a.score)
          .slice(0, maxResults)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  // Helper methods

  async loadSuperGraph() {
    const cacheKey = 'supergraph';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const content = await readFile(join(this.graphDir, 'supergraph.json'), 'utf8');
      const data = JSON.parse(content);
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      return null;
    }
  }

  async loadCluster(clusterId) {
    const cacheKey = `cluster_${clusterId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const content = await readFile(join(this.clustersDir, `${clusterId}.json`), 'utf8');
      const data = JSON.parse(content);
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      return null;
    }
  }

  enrichClusterData(cluster, superGraph) {
    // Calculate importance based on size and connectivity
    const connections = superGraph.edges.filter(e => 
      e.from === cluster.id || e.to === cluster.id
    ).length;
    
    const importance = cluster.files * 0.3 + connections * 2;
    
    return {
      ...cluster,
      connections,
      importance
    };
  }

  getMajorConnections(superGraph, limit) {
    return superGraph.edges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit)
      .map(edge => ({
        from: superGraph.clusters[edge.from]?.description || edge.from,
        to: superGraph.clusters[edge.to]?.description || edge.to,
        strength: edge.weight
      }));
  }

  getMetrics(superGraph) {
    return {
      totalFiles: superGraph.metadata.totalFiles,
      totalClusters: superGraph.metadata.totalClusters,
      compressionRatio: `${superGraph.metadata.compressionRatio}:1`,
      lastUpdated: superGraph.metadata.timestamp
    };
  }

  getClusterConnections(clusterId, superGraph) {
    if (!superGraph) return [];
    
    return superGraph.edges
      .filter(e => e.from === clusterId || e.to === clusterId)
      .map(edge => ({
        target: edge.from === clusterId ? edge.to : edge.from,
        description: superGraph.clusters[edge.from === clusterId ? edge.to : edge.from]?.description,
        weight: edge.weight,
        direction: edge.from === clusterId ? 'outgoing' : 'incoming'
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  shortenPath(filePath) {
    if (!filePath) return '';
    
    // Remove leading ./
    let shortened = filePath.replace(/^\.\//, '');
    
    // Compress common prefixes
    shortened = shortened
      .replace(/^open_spiel\//, 'os/')
      .replace(/^src\//, '')
      .replace(/^lib\//, '');

    // Keep only last 2-3 components for very long paths
    const parts = shortened.split('/');
    if (parts.length > 4) {
      return `.../${parts.slice(-2).join('/')}`;
    }

    return shortened;
  }

  getFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap = {
      'py': 'Python',
      'js': 'JavaScript', 
      'ts': 'TypeScript',
      'cpp': 'C++',
      'c': 'C',
      'h': 'Header',
      'hpp': 'C++ Header',
      'json': 'Config',
      'md': 'Documentation',
      'txt': 'Text',
      'yml': 'Config',
      'yaml': 'Config'
    };
    
    return typeMap[ext] || 'Unknown';
  }

  getLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  async getFileSize(fullPath) {
    try {
      const stats = await import('fs/promises').then(fs => fs.stat(fullPath));
      const bytes = stats.size;
      
      if (bytes > 1024) {
        return `${Math.round(bytes / 1024)}KB`;
      } else {
        return `${bytes}B`;
      }
    } catch {
      return 'Unknown';
    }
  }

  async getFileBasics(filePath) {
    // Quick file analysis without full content read
    try {
      const fullPath = join(this.rootPath, filePath);
      const content = await readFile(fullPath, 'utf8');
      const lines = content.split('\n');
      
      return {
        lines: lines.length,
        hasDocstring: this.hasDocstring(content, this.getLanguage(filePath)),
        estimatedComplexity: this.estimateComplexity(content)
      };
    } catch {
      return {};
    }
  }

  hasDocstring(content, language) {
    if (language === 'py') {
      return content.includes('"""') || content.includes("'''");
    } else if (['js', 'ts'].includes(language)) {
      return content.includes('/**') || content.includes('//');
    }
    return false;
  }

  estimateComplexity(content) {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const functions = (content.match(/def |function |class /g) || []).length;
    
    if (functions > 20) return 'High';
    if (functions > 5) return 'Medium';
    return 'Low';
  }

  async extractFileSymbols(fullPath, language) {
    // Simple symbol extraction - could be enhanced with proper AST parsing
    try {
      const content = await readFile(fullPath, 'utf8');
      const symbols = [];
      
      if (language === 'py') {
        // Extract Python classes and functions
        const classMatches = content.matchAll(/^class\s+(\w+)/gm);
        for (const match of classMatches) {
          symbols.push({ type: 'class', name: match[1] });
        }
        
        const funcMatches = content.matchAll(/^def\s+(\w+)/gm);
        for (const match of funcMatches) {
          symbols.push({ type: 'function', name: match[1] });
        }
      } else if (['js', 'ts'].includes(language)) {
        // Extract JavaScript/TypeScript functions and classes
        const classMatches = content.matchAll(/class\s+(\w+)/g);
        for (const match of classMatches) {
          symbols.push({ type: 'class', name: match[1] });
        }
        
        const funcMatches = content.matchAll(/function\s+(\w+)|(\w+)\s*\(/g);
        for (const match of funcMatches) {
          symbols.push({ type: 'function', name: match[1] || match[2] });
        }
      }
      
      return symbols.slice(0, 10); // Limit for context efficiency
    } catch {
      return [];
    }
  }

  async getFileDependencies(filePath) {
    // This would integrate with the main graph data
    // For now, return placeholder
    return {
      imports: [],
      exports: [],
      dependents: []
    };
  }
}
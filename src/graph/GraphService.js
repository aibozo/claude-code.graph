import fs from 'fs/promises';
import path from 'path';
import { Graph } from 'graphlib';

/**
 * Core service for managing and querying code graphs
 * Handles multi-language graph data and provides analysis capabilities
 */
export class GraphService {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.graphDir = path.join(rootPath, '.graph');
    this.graphs = new Map(); // language -> Graph instance
    this.metadata = null;
    this.lastUpdate = null;
    this.cache = new Map();
  }

  /**
   * Initialize the graph service and load available graphs
   */
  async initialize() {
    try {
      await this.loadMetadata();
      await this.loadAllGraphs();
      this.lastUpdate = new Date();
      return true;
    } catch (error) {
      console.warn('Graph service initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Load graph metadata and configuration
   */
  async loadMetadata() {
    const metricsPath = path.join(this.graphDir, 'metrics.json');
    try {
      const content = await fs.readFile(metricsPath, 'utf8');
      this.metadata = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load graph metadata: ${error.message}`);
    }
  }

  /**
   * Load all available language-specific graphs
   */
  async loadAllGraphs() {
    const graphFiles = {
      javascript: 'js.json',
      python: 'py.dot', 
      cpp: 'cpp.json',
      ast: 'ts.json'
    };

    for (const [language, filename] of Object.entries(graphFiles)) {
      try {
        await this.loadGraph(language, filename);
      } catch (error) {
        console.warn(`Failed to load ${language} graph:`, error.message);
      }
    }
  }

  /**
   * Load a specific language graph
   */
  async loadGraph(language, filename) {
    const filePath = path.join(this.graphDir, filename);
    
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Graph file not found: ${filename}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    let graphData;

    if (filename.endsWith('.json')) {
      graphData = JSON.parse(content);
      this.graphs.set(language, this.parseJsonGraph(graphData));
    } else if (filename.endsWith('.dot')) {
      this.graphs.set(language, this.parseDotGraph(content));
    }
  }

  /**
   * Parse JSON graph format (JavaScript modules, Tree-sitter AST)
   */
  parseJsonGraph(data) {
    const graph = new Graph({ directed: true });

    if (data.nodes && data.edges) {
      // Tree-sitter format
      data.nodes.forEach(node => {
        graph.setNode(node.id, {
          type: node.type,
          file: node.file,
          line: node.line,
          name: node.name || node.id
        });
      });

      data.edges.forEach(edge => {
        graph.setEdge(edge.from, edge.to, {
          type: edge.type || 'unknown',
          weight: edge.weight || 1
        });
      });
    } else if (typeof data === 'object') {
      // Madge format (JavaScript modules)
      Object.entries(data).forEach(([source, dependencies]) => {
        graph.setNode(source, { type: 'module', file: source });
        
        if (Array.isArray(dependencies)) {
          dependencies.forEach(dep => {
            graph.setNode(dep, { type: 'module', file: dep });
            graph.setEdge(source, dep, { type: 'import', weight: 1 });
          });
        }
      });
    }

    return graph;
  }

  /**
   * Parse DOT graph format (Python call graphs)
   */
  parseDotGraph(content) {
    const graph = new Graph({ directed: true });
    
    // Simple DOT parser for pyan output
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse node definitions: node_name [attributes]
      const nodeMatch = trimmed.match(/^(\w+)\s*\[([^\]]+)\]/);
      if (nodeMatch) {
        const [, nodeId, attrs] = nodeMatch;
        const nodeData = this.parseAttributes(attrs);
        graph.setNode(nodeId, {
          type: 'function',
          label: nodeData.label || nodeId,
          ...nodeData
        });
        continue;
      }

      // Parse edges: node1 -> node2 [attributes]
      const edgeMatch = trimmed.match(/^(\w+)\s*->\s*(\w+)(?:\s*\[([^\]]+)\])?/);
      if (edgeMatch) {
        const [, from, to, attrs] = edgeMatch;
        const edgeData = attrs ? this.parseAttributes(attrs) : {};
        graph.setEdge(from, to, {
          type: 'calls',
          weight: 1,
          ...edgeData
        });
      }
    }

    return graph;
  }

  /**
   * Parse DOT attribute string
   */
  parseAttributes(attrString) {
    const attrs = {};
    const matches = attrString.matchAll(/(\w+)="([^"]+)"/g);
    
    for (const match of matches) {
      attrs[match[1]] = match[2];
    }
    
    return attrs;
  }

  /**
   * Find files related to a target file
   */
  async findRelatedFiles(targetFile, options = {}) {
    const {
      maxDepth = 3,
      relationTypes = ['imports', 'calls', 'inheritance'],
      includeReverse = true
    } = options;

    const cacheKey = `related:${targetFile}:${JSON.stringify(options)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const related = new Set();
    const visited = new Set();
    const queue = [{ file: targetFile, depth: 0, relation: 'self' }];

    while (queue.length > 0) {
      const { file, depth, relation } = queue.shift();
      
      if (visited.has(file) || depth > maxDepth) continue;
      visited.add(file);

      if (depth > 0) {
        related.add({
          path: file,
          relationship: relation,
          depth,
          confidence: Math.max(0.1, 1 - (depth * 0.2))
        });
      }

      // Search in all available graphs
      for (const [language, graph] of this.graphs) {
        this.findDirectlyRelated(graph, file, depth + 1, queue, relationTypes, includeReverse);
      }
    }

    const result = Array.from(related);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Find directly related nodes in a specific graph
   */
  findDirectlyRelated(graph, file, nextDepth, queue, relationTypes, includeReverse) {
    // Find nodes that match the file
    const matchingNodes = graph.nodes().filter(nodeId => {
      const nodeData = graph.node(nodeId);
      return nodeData && (
        nodeData.file === file ||
        nodeData.file?.endsWith(file) ||
        file.endsWith(nodeData.file || '')
      );
    });

    for (const nodeId of matchingNodes) {
      // Outgoing edges (what this file uses)
      graph.outEdges(nodeId)?.forEach(edge => {
        const targetNode = graph.node(edge.w);
        const edgeData = graph.edge(edge);
        
        if (relationTypes.includes(edgeData.type)) {
          queue.push({
            file: targetNode.file || edge.w,
            depth: nextDepth,
            relation: edgeData.type
          });
        }
      });

      // Incoming edges (what uses this file)
      if (includeReverse) {
        graph.inEdges(nodeId)?.forEach(edge => {
          const sourceNode = graph.node(edge.v);
          const edgeData = graph.edge(edge);
          
          if (relationTypes.includes(edgeData.type)) {
            queue.push({
              file: sourceNode.file || edge.v,
              depth: nextDepth,
              relation: `reverse_${edgeData.type}`
            });
          }
        });
      }
    }
  }

  /**
   * Get architecture overview of the codebase
   */
  async getArchitectureOverview() {
    const overview = {
      modules: {},
      hotPaths: [],
      cycles: [],
      metrics: this.metadata || {}
    };

    // Analyze each graph
    for (const [language, graph] of this.graphs) {
      const analysis = this.analyzeGraph(graph, language);
      overview.modules[language] = analysis;
    }

    // Find hot paths (most connected nodes)
    overview.hotPaths = this.findHotPaths();
    
    // Detect cycles
    overview.cycles = this.detectCycles();

    return overview;
  }

  /**
   * Analyze a single graph for metrics
   */
  analyzeGraph(graph, language) {
    const nodes = graph.nodes();
    const edges = graph.edges();
    
    const nodeMetrics = nodes.map(nodeId => {
      const inDegree = graph.inEdges(nodeId)?.length || 0;
      const outDegree = graph.outEdges(nodeId)?.length || 0;
      const nodeData = graph.node(nodeId);
      
      return {
        id: nodeId,
        file: nodeData?.file,
        type: nodeData?.type,
        inDegree,
        outDegree,
        totalDegree: inDegree + outDegree
      };
    });

    // Sort by total degree (most connected)
    nodeMetrics.sort((a, b) => b.totalDegree - a.totalDegree);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      topNodes: nodeMetrics.slice(0, 10),
      avgDegree: nodeMetrics.reduce((sum, n) => sum + n.totalDegree, 0) / nodes.length || 0
    };
  }

  /**
   * Find the most connected paths in the codebase
   */
  findHotPaths() {
    const allPaths = [];
    
    for (const [language, graph] of this.graphs) {
      const nodes = graph.nodes();
      
      // Find high-degree nodes as path starting points
      const hotNodes = nodes
        .map(nodeId => ({
          id: nodeId,
          degree: (graph.inEdges(nodeId)?.length || 0) + (graph.outEdges(nodeId)?.length || 0),
          data: graph.node(nodeId)
        }))
        .filter(node => node.degree > 2)
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 5);

      for (const hotNode of hotNodes) {
        const paths = this.findPathsFromNode(graph, hotNode.id, 3);
        allPaths.push(...paths.map(path => ({
          language,
          path: path.map(nodeId => ({
            id: nodeId,
            file: graph.node(nodeId)?.file,
            type: graph.node(nodeId)?.type
          })),
          weight: path.length
        })));
      }
    }

    return allPaths.slice(0, 10);
  }

  /**
   * Find paths from a specific node
   */
  findPathsFromNode(graph, startNode, maxLength) {
    const paths = [];
    const visited = new Set();
    
    const dfs = (currentNode, currentPath) => {
      if (currentPath.length >= maxLength || visited.has(currentNode)) {
        if (currentPath.length > 1) {
          paths.push([...currentPath]);
        }
        return;
      }
      
      visited.add(currentNode);
      currentPath.push(currentNode);
      
      const outEdges = graph.outEdges(currentNode) || [];
      for (const edge of outEdges) {
        dfs(edge.w, currentPath);
      }
      
      currentPath.pop();
      visited.delete(currentNode);
    };
    
    dfs(startNode, []);
    return paths;
  }

  /**
   * Detect circular dependencies
   */
  detectCycles() {
    const cycles = [];
    
    for (const [language, graph] of this.graphs) {
      const graphCycles = this.findCyclesInGraph(graph);
      cycles.push(...graphCycles.map(cycle => ({
        language,
        nodes: cycle.map(nodeId => ({
          id: nodeId,
          file: graph.node(nodeId)?.file,
          type: graph.node(nodeId)?.type
        })),
        length: cycle.length
      })));
    }
    
    return cycles;
  }

  /**
   * Find cycles in a specific graph using DFS
   */
  findCyclesInGraph(graph) {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();
    const path = [];
    
    const dfs = (node) => {
      if (recStack.has(node)) {
        // Found a cycle - extract it from the path
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }
      
      if (visited.has(node)) return;
      
      visited.add(node);
      recStack.add(node);
      path.push(node);
      
      const outEdges = graph.outEdges(node) || [];
      for (const edge of outEdges) {
        dfs(edge.w);
      }
      
      path.pop();
      recStack.delete(node);
    };
    
    for (const node of graph.nodes()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    
    return cycles;
  }

  /**
   * Search for symbols/functions across all graphs
   */
  async searchBySymbols(keywords) {
    const results = [];
    const searchTerms = keywords.map(k => k.toLowerCase());
    
    for (const [language, graph] of this.graphs) {
      for (const nodeId of graph.nodes()) {
        const nodeData = graph.node(nodeId);
        const searchText = [
          nodeId,
          nodeData?.label,
          nodeData?.name,
          nodeData?.file
        ].filter(Boolean).join(' ').toLowerCase();
        
        const matches = searchTerms.filter(term => searchText.includes(term));
        if (matches.length > 0) {
          results.push({
            id: nodeId,
            file: nodeData?.file,
            type: nodeData?.type,
            language,
            relevance: matches.length / searchTerms.length,
            matches
          });
        }
      }
    }
    
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Check if graphs are available and healthy
   */
  isHealthy() {
    return this.graphs.size > 0 && this.metadata !== null;
  }

  /**
   * Get basic statistics
   */
  getStats() {
    const stats = {
      totalGraphs: this.graphs.size,
      totalNodes: 0,
      totalEdges: 0,
      languages: [],
      lastUpdate: this.lastUpdate
    };
    
    for (const [language, graph] of this.graphs) {
      const nodeCount = graph.nodeCount();
      const edgeCount = graph.edgeCount();
      
      stats.totalNodes += nodeCount;
      stats.totalEdges += edgeCount;
      stats.languages.push({
        language,
        nodes: nodeCount,
        edges: edgeCount
      });
    }
    
    return stats;
  }
}
# Codebase Graph Intelligence

This codebase has been analyzed with claude-code-graph for intelligent navigation.

**Compression**: 31 files → 5 clusters (6:1)

## Cluster Overview

The codebase is organized into these semantic clusters:

### c0: ., src modules (js) - graph, ContextOptimizer, tools
- **Files**: 8 | **Languages**: js
- **Key Files**: index.js, graph/ContextOptimizer.js, tools/daemon-control.js
- **Importance**: 8

### c2: ., tools modules (js) - tools, generate-supergraph, graph
- **Files**: 5 | **Languages**: js
- **Key Files**: tools/generate-supergraph.js, graph/GraphService.js, graph/GraphClustering.js
- **Importance**: 6

### c3: ., src modules (js) - graph, ClusterTools, test-openspiel-clusters
- **Files**: 3 | **Languages**: js
- **Key Files**: graph/ClusterTools.js, test-openspiel-clusters.js, bin/cluster-test.js
- **Importance**: 5

### c1: graph modules (js) - graph, ClusterTools, GraphAwareToolSelector
- **Files**: 7 | **Languages**: js
- **Key Files**: index.js, graph/ClusterTools.js, graph/GraphAwareToolSelector.js
- **Importance**: 4

### misc: Miscellaneous files (js, py)
- **Files**: 8 | **Languages**: js, py
- **Key Files**: tools/fast-treesitter.js, bin/doctor.js, bin/init.js
- **Importance**: 2

## Navigation Commands

Use these commands to navigate efficiently:

- `/clusters` - Show all clusters
- `/cluster <id>` - Expand specific cluster
- `/csearch <query>` - Search clusters
- `/cfile <path>` - Get detailed file info

## Usage

Instead of scanning thousands of files, use the cluster overview to understand the codebase architecture, then drill down to specific areas using the navigation commands.
